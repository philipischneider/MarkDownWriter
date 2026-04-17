import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'

interface OutlineMeta {
  chapterIndex?: number
  enabled?: boolean
}

interface OutlineState {
  chapterIndex: number
  enabled: boolean
  decorations: DecorationSet
}

export const outlinePluginKey = new PluginKey<OutlineState>('outline')

function buildDecorations(doc: Node, chapterIndex: number, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty
  const decos: Decoration[] = []
  let h1 = 0, h2 = 0, h3 = 0

  doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return
    const level: number = node.attrs.level
    let num = ''
    if (level === 1) {
      h1++; h2 = 0; h3 = 0
      num = `${chapterIndex}.${h1}`
    } else if (level === 2) {
      h2++; h3 = 0
      num = `${chapterIndex}.${h1}.${h2}`
    } else if (level === 3) {
      h3++
      num = `${chapterIndex}.${h1}.${h2}.${h3}`
    }
    if (num) {
      decos.push(Decoration.node(offset, offset + node.nodeSize, { 'data-outline-num': num }))
    }
  })

  return DecorationSet.create(doc, decos)
}

export function outlinePlugin(initialChapterIndex: number, initialEnabled: boolean): Plugin {
  return new Plugin<OutlineState>({
    key: outlinePluginKey,
    state: {
      init(_, { doc }) {
        return {
          chapterIndex: initialChapterIndex,
          enabled: initialEnabled,
          decorations: buildDecorations(doc, initialChapterIndex, initialEnabled)
        }
      },
      apply(tr, prev) {
        const meta = tr.getMeta(outlinePluginKey) as OutlineMeta | undefined
        const chapterIndex = meta?.chapterIndex ?? prev.chapterIndex
        const enabled = meta?.enabled ?? prev.enabled
        if (!tr.docChanged && !meta) return prev
        return {
          chapterIndex,
          enabled,
          decorations: buildDecorations(tr.doc, chapterIndex, enabled)
        }
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations ?? DecorationSet.empty
      }
    }
  })
}
