import { Schema, NodeSpec, MarkSpec } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'

// ─── Nós customizados ────────────────────────────────────────────────────────

const footnote: NodeSpec = {
  inline: true,
  group: 'inline',
  attrs: {
    content: { default: '' },
    id: { default: '' }
  },
  toDOM: node => ['footnote', { 'data-content': node.attrs.content, 'data-id': node.attrs.id }],
  parseDOM: [{
    tag: 'footnote',
    getAttrs: el => ({
      content: (el as HTMLElement).getAttribute('data-content') ?? '',
      id: (el as HTMLElement).getAttribute('data-id') ?? ''
    })
  }]
}

// Um grupo de versões alternativas de uma seção
const version_group: NodeSpec = {
  content: 'version+',
  group: 'block',
  attrs: { activeIndex: { default: 0 } },
  toDOM: node => ['div', { class: 'version-group', 'data-active': node.attrs.activeIndex }, 0],
  parseDOM: [{
    tag: 'div.version-group',
    getAttrs: el => ({ activeIndex: parseInt((el as HTMLElement).getAttribute('data-active') ?? '0') })
  }]
}

// Uma versão dentro de um grupo
const version: NodeSpec = {
  content: 'block+',
  attrs: {
    label: { default: 'Versão 1' }
  },
  toDOM: node => ['div', { class: 'version', 'data-label': node.attrs.label }, 0],
  parseDOM: [{
    tag: 'div.version',
    getAttrs: el => ({ label: (el as HTMLElement).getAttribute('data-label') ?? 'Versão 1' })
  }]
}

// ─── Marks customizados ──────────────────────────────────────────────────────

const entity_ref: MarkSpec = {
  attrs: {
    entityId:   { default: '' },
    entityType: { default: 'characters' },
    entityName: { default: '' },
    color:      { default: '' }
  },
  inclusive: false,
  toDOM: node => ['span', {
    class: 'entity-ref',
    'data-entity-id':   node.attrs.entityId,
    'data-entity-type': node.attrs.entityType,
    'data-entity-name': node.attrs.entityName,
    style: node.attrs.color ? `--entity-color:${node.attrs.color}` : ''
  }, 0],
  parseDOM: [{
    tag: 'span.entity-ref',
    getAttrs: el => ({
      entityId:   (el as HTMLElement).getAttribute('data-entity-id')   ?? '',
      entityType: (el as HTMLElement).getAttribute('data-entity-type') ?? 'characters',
      entityName: (el as HTMLElement).getAttribute('data-entity-name') ?? '',
      color:      (el as HTMLElement).style.getPropertyValue('--entity-color') ?? ''
    })
  }]
}

const comment: MarkSpec = {
  attrs: {
    text: { default: '' },
    id: { default: '' }
  },
  inclusive: false,
  toDOM: node => ['span', {
    class: 'comment-mark',
    'data-comment': node.attrs.text,
    'data-id': node.attrs.id
  }, 0],
  parseDOM: [{
    tag: 'span.comment-mark',
    getAttrs: el => ({
      text: (el as HTMLElement).getAttribute('data-comment') ?? '',
      id: (el as HTMLElement).getAttribute('data-id') ?? ''
    })
  }]
}

// ─── Schema completo ─────────────────────────────────────────────────────────

const baseNodes = addListNodes(basicSchema.spec.nodes as any, 'paragraph block*', 'block')

export const schema = new Schema({
  nodes: baseNodes
    .addBefore('image', 'footnote', footnote)
    .append({ version_group, version }),
  marks: (basicSchema.spec.marks as any).append({ comment, entity_ref })
})

export type EditorSchema = typeof schema
