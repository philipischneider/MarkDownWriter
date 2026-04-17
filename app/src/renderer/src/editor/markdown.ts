import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown'
// @ts-ignore
import MarkdownIt from 'markdown-it'
import { schema } from './schema'
import { Node as ProsemirrorNode } from 'prosemirror-model'

// ─── Parser ──────────────────────────────────────────────────────────────────

export const mdParser = new MarkdownParser(
  schema,
  MarkdownIt('commonmark', { html: true }),
  {
    ...defaultMarkdownParser.tokens,
    // Inline HTML (entity-ref spans, comment spans, footnote elements):
    // ignore the tags — the text content inside them is preserved as normal text tokens.
    // This prevents the parser from throwing on content serialized with custom HTML marks.
    html_inline: { ignore: true },
    // Block HTML (version group comments, etc.): ignore markers,
    // text content inside version blocks is preserved as regular paragraph tokens.
    html_block: { ignore: true },
  }
)

// ─── Serializer ──────────────────────────────────────────────────────────────

export const mdSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,

    bullet_list(state, node) {
      state.renderList(node, '  ', () => '- ')
    },
    ordered_list(state, node) {
      const start = (node.attrs['order'] as number) || 1
      const maxW = String(start + node.childCount - 1).length
      const space = state.repeat(' ', maxW + 2)
      state.renderList(node, space, i => {
        const nStr = String(start + i)
        return state.repeat(' ', maxW - nStr.length) + nStr + '. '
      })
    },
    list_item(state, node) {
      state.renderContent(node)
    },

    // Nota de rodapé: serializada como marcador HTML para preservar no arquivo
    footnote(state, node) {
      const id = node.attrs.id || 'fn-' + Math.random().toString(36).slice(2, 6)
      const content = (node.attrs.content as string).replace(/"/g, '&quot;')
      state.write(`<footnote data-id="${id}" data-content="${content}"></footnote>`)
    },

    // Grupo de versões
    version_group(state, node) {
      state.write('<!-- versions:start -->\n')
      node.forEach((child, _offset, index) => {
        const label = (child.attrs.label as string).replace(/"/g, '\\"')
        const isActive = index === (node.attrs.activeIndex as number)
        state.write(`<!-- version:"${label}"${isActive ? ':active' : ''} -->\n\n`)
        state.renderContent(child)
        state.write('\n')
      })
      state.write('<!-- versions:end -->\n')
    },

    version(state, node) {
      // Não deve ser chamado diretamente — gerenciado por version_group
      state.renderContent(node)
    }
  },
  {
    ...defaultMarkdownSerializer.marks,

    // Referência a entidade: serializada como span HTML
    entity_ref: {
      open(_state, mark) {
        const id   = (mark.attrs.entityId   as string)
        const type = (mark.attrs.entityType as string)
        const name = (mark.attrs.entityName as string).replace(/"/g, '&quot;')
        const color = (mark.attrs.color as string)
        return `<span class="entity-ref" data-entity-id="${id}" data-entity-type="${type}" data-entity-name="${name}"${color ? ` style="--entity-color:${color}"` : ''}>`
      },
      close: () => '</span>',
      mixable: true,
      expelEnclosingWhitespace: true
    },

    // Comentário: serializado como HTML comment span
    comment: {
      open(_state, mark) {
        const id = (mark.attrs.id as string) || 'c-' + Math.random().toString(36).slice(2, 6)
        const text = (mark.attrs.text as string).replace(/"/g, '&quot;')
        return `<span class="comment-mark" data-id="${id}" data-comment="${text}">`
      },
      close: () => '</span>',
      mixable: true,
      expelEnclosingWhitespace: true
    }
  }
)

// ─── Version group pre-processor ─────────────────────────────────────────────

/**
 * Strips version_group HTML comment markers from markdown, keeping only the
 * content of the active version (marked with :active). Used before parsing
 * (edit mode round-trip) and before preview rendering.
 */
export function keepActiveVersionOnly(md: string): string {
  const lines = md.split('\n')
  const result: string[] = []
  let depth = 0
  let keepCurrent = false  // inside a version_group, are we in the active version?

  for (const line of lines) {
    const t = line.trim()

    if (t === '<!-- versions:start -->') {
      depth++
      if (depth > 1 && keepCurrent) result.push(line)
      continue
    }
    if (t === '<!-- versions:end -->') {
      if (depth > 1 && keepCurrent) result.push(line)
      depth--
      if (depth === 0) keepCurrent = false
      continue
    }

    if (depth === 1) {
      const m = t.match(/^<!-- version:"([^"]*)"(:active)? -->$/)
      if (m) {
        keepCurrent = !!m[2]
        continue
      }
    }

    if (depth === 0 || keepCurrent) result.push(line)
  }

  return result.join('\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Serializa um documento para Markdown */
export function serializeDoc(doc: ProsemirrorNode): string {
  return mdSerializer.serialize(doc)
}

/** Parseia Markdown para documento ProseMirror */
export function parseMarkdown(md: string): ProsemirrorNode {
  try {
    return mdParser.parse(keepActiveVersionOnly(md) || ' ') ?? schema.topNodeType.createAndFill()!
  } catch {
    return schema.topNodeType.createAndFill()!
  }
}
