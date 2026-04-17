import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from 'prosemirror-inputrules'
import type { EditorSchema } from './schema'

export function buildInputRules(s: EditorSchema) {
  const rules: InputRule[] = []

  // **bold**
  if (s.marks.strong) {
    rules.push(new InputRule(/(?:^|[^*])\*\*([^*\n]+)\*\*$/, (state, match, start, end) => {
      const markStart = start + match[0].indexOf('**')
      const content = match[1]
      return state.tr
        .delete(markStart, end)
        .insertText(content, markStart)
        .addMark(markStart, markStart + content.length, s.marks.strong.create())
    }))
  }

  // *italic* ou _italic_
  if (s.marks.em) {
    rules.push(new InputRule(/(?:^|[\s([{])[*_]([^*_\n]+)[*_]$/, (state, match, start, end) => {
      const sigil = match[0].includes('_') ? '_' : '*'
      const markStart = start + match[0].indexOf(sigil)
      const content = match[1]
      return state.tr
        .delete(markStart, end)
        .insertText(content, markStart)
        .addMark(markStart, markStart + content.length, s.marks.em.create())
    }))
  }

  // `code`
  if (s.marks.code) {
    rules.push(new InputRule(/`([^`\n]+)`$/, (state, match, start, end) => {
      const markStart = start + match[0].indexOf('`')
      const content = match[1]
      return state.tr
        .delete(markStart, end)
        .insertText(content, markStart)
        .addMark(markStart, markStart + content.length, s.marks.code.create())
    }))
  }

  // # Título
  if (s.nodes.heading) {
    rules.push(textblockTypeInputRule(/^(#{1,6})\s$/, s.nodes.heading, match => ({
      level: match[1].length
    })))
  }

  // > blockquote
  if (s.nodes.blockquote) {
    rules.push(wrappingInputRule(/^\s*>\s$/, s.nodes.blockquote))
  }

  // - / * lista
  if (s.nodes.bullet_list) {
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, s.nodes.bullet_list))
  }

  // 1. lista numerada
  if (s.nodes.ordered_list) {
    rules.push(wrappingInputRule(
      /^(\d+)\.\s$/,
      s.nodes.ordered_list,
      match => ({ order: +match[1] }),
      (match, node) => node.childCount + node.attrs['order'] === +match[1]
    ))
  }

  return inputRules({ rules })
}
