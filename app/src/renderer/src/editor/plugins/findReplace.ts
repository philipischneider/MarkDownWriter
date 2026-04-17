import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const findReplaceKey = new PluginKey<FindReplaceState>('findReplace')

export interface FindReplaceState {
  query: string
  matches: Array<{ from: number; to: number }>
  current: number  // index of the highlighted match
}

function buildDecorations(doc: import('prosemirror-model').Node, state: FindReplaceState): DecorationSet {
  if (!state.query) return DecorationSet.empty
  const decos: Decoration[] = []
  state.matches.forEach((m, i) => {
    decos.push(
      Decoration.inline(m.from, m.to, {
        class: i === state.current ? 'find-current' : 'find-match'
      })
    )
  })
  return DecorationSet.create(doc, decos)
}

function findMatches(doc: import('prosemirror-model').Node, query: string): Array<{ from: number; to: number }> {
  if (!query) return []
  const matches: Array<{ from: number; to: number }> = []
  const text = doc.textContent
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let idx = 0
  while ((idx = lower.indexOf(q, idx)) !== -1) {
    // Convert text offset → doc position
    let pos = 0
    let found = false
    doc.nodesBetween(0, doc.content.size, (node, nodePos): boolean | void => {
      if (found) return false
      if (!node.isText) return
      const end = pos + node.text!.length
      if (pos <= idx && idx < end) {
        const offset = idx - pos
        const from = nodePos + offset
        const to = from + query.length
        matches.push({ from, to })
        found = true
      }
      pos = end
    })
    idx += q.length
  }
  return matches
}

export const findReplacePlugin = () => new Plugin<FindReplaceState>({
  key: findReplaceKey,
  state: {
    init: () => ({ query: '', matches: [], current: -1 }),
    apply(tr, prev) {
      const meta = tr.getMeta(findReplaceKey)
      if (meta !== undefined) return meta as FindReplaceState
      if (!tr.docChanged) return prev
      // Recompute matches when doc changes
      if (!prev.query) return prev
      const matches = findMatches(tr.doc, prev.query)
      return { ...prev, matches, current: Math.min(prev.current, matches.length - 1) }
    }
  },
  props: {
    decorations(state) {
      const s = findReplaceKey.getState(state)
      if (!s) return DecorationSet.empty
      return buildDecorations(state.doc, s)
    }
  }
})

// ─── Commands ────────────────────────────────────────────────────────────────

export function setQuery(view: import('prosemirror-view').EditorView, query: string) {
  const matches = findMatches(view.state.doc, query)
  const current = matches.length > 0 ? 0 : -1
  const meta: FindReplaceState = { query, matches, current }
  view.dispatch(view.state.tr.setMeta(findReplaceKey, meta))
  if (matches.length > 0) scrollToMatch(view, matches[0])
}

export function findNext(view: import('prosemirror-view').EditorView) {
  const s = findReplaceKey.getState(view.state)
  if (!s || s.matches.length === 0) return
  const current = (s.current + 1) % s.matches.length
  view.dispatch(view.state.tr.setMeta(findReplaceKey, { ...s, current }))
  scrollToMatch(view, s.matches[current])
}

export function findPrev(view: import('prosemirror-view').EditorView) {
  const s = findReplaceKey.getState(view.state)
  if (!s || s.matches.length === 0) return
  const current = (s.current - 1 + s.matches.length) % s.matches.length
  view.dispatch(view.state.tr.setMeta(findReplaceKey, { ...s, current }))
  scrollToMatch(view, s.matches[current])
}

export function replaceCurrent(view: import('prosemirror-view').EditorView, replacement: string) {
  const s = findReplaceKey.getState(view.state)
  if (!s || s.matches.length === 0 || s.current < 0) return
  const m = s.matches[s.current]
  const tr = view.state.tr.replaceWith(m.from, m.to, view.state.schema.text(replacement))
  // Recompute
  const newMatches = findMatches(tr.doc, s.query)
  const newCurrent = Math.min(s.current, newMatches.length - 1)
  tr.setMeta(findReplaceKey, { query: s.query, matches: newMatches, current: newCurrent })
  view.dispatch(tr)
}

export function replaceAll(view: import('prosemirror-view').EditorView, replacement: string) {
  const s = findReplaceKey.getState(view.state)
  if (!s || s.matches.length === 0) return
  let tr = view.state.tr
  // Replace in reverse order to preserve positions
  for (let i = s.matches.length - 1; i >= 0; i--) {
    const m = s.matches[i]
    tr = tr.replaceWith(m.from, m.to, view.state.schema.text(replacement))
  }
  tr.setMeta(findReplaceKey, { query: s.query, matches: [], current: -1 })
  view.dispatch(tr)
}

function scrollToMatch(view: import('prosemirror-view').EditorView, match: { from: number; to: number }) {
  const coords = view.coordsAtPos(match.from)
  const el = view.dom.closest('.scrollArea') ?? view.dom.parentElement
  if (el) {
    const elRect = el.getBoundingClientRect()
    const offset = coords.top - elRect.top + el.scrollTop - elRect.height / 2
    el.scrollTo({ top: offset, behavior: 'smooth' })
  }
}
