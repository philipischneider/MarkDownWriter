import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { Node as PmNode } from 'prosemirror-model'

const LT_URL = 'http://localhost:8081/v2/check'
const DEBOUNCE_MS = 1500

interface LtMatch {
  message: string
  from: number
  to: number
  replacements: string[]
  issueType: string
}

interface LtPluginState {
  enabled: boolean
  matches: LtMatch[]
  decos: DecorationSet
}

export const ltKey = new PluginKey<LtPluginState>('languageTool')

export function setLtEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch(view.state.tr.setMeta(ltKey, { type: 'setEnabled', enabled }))
}

function extractText(doc: PmNode): { text: string; posMap: number[] } {
  const posMap: number[] = []
  let text = ''
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        posMap.push(pos + i)
        text += node.text[i]
      }
    }
  })
  return { text, posMap }
}

function mapLtMatch(
  m: {
    offset: number
    length: number
    message: string
    replacements: { value: string }[]
    rule: { issueType: string }
  },
  posMap: number[]
): LtMatch | null {
  if (m.offset >= posMap.length) return null
  const from = posMap[m.offset]
  const endIdx = Math.min(m.offset + m.length - 1, posMap.length - 1)
  const to = posMap[endIdx] + 1
  if (from >= to) return null
  return {
    message: m.message,
    from,
    to,
    replacements: m.replacements.map(r => r.value),
    issueType: m.rule.issueType
  }
}

function buildDecos(matches: LtMatch[], doc: PmNode): DecorationSet {
  const decos = matches.map(m => {
    const cls =
      m.issueType === 'misspelling' ? 'lt-spelling' :
      m.issueType === 'grammar' ? 'lt-grammar' : 'lt-style'
    return Decoration.inline(m.from, m.to, {
      class: `lt-match ${cls}`,
    })
  })
  return DecorationSet.create(doc, decos)
}

// ─── Popup ────────────────────────────────────────────────────────────────────

let ltPopup: HTMLElement | null = null
let ltOutsideHandler: ((e: MouseEvent) => void) | null = null

export function closeLtPopup(): void {
  if (ltOutsideHandler) {
    document.removeEventListener('mousedown', ltOutsideHandler)
    ltOutsideHandler = null
  }
  ltPopup?.remove()
  ltPopup = null
}

function showLtPopup(anchor: HTMLElement, match: LtMatch, view: EditorView): void {
  closeLtPopup()

  ltPopup = document.createElement('div')
  ltPopup.className = 'lt-popup'

  const msgEl = document.createElement('div')
  msgEl.className = 'lt-popup-msg'
  msgEl.textContent = match.message
  ltPopup.appendChild(msgEl)

  if (match.replacements.length > 0) {
    const list = document.createElement('div')
    list.className = 'lt-popup-replacements'
    match.replacements.slice(0, 5).forEach(r => {
      const btn = document.createElement('button')
      btn.className = 'lt-popup-repl-btn'
      btn.textContent = r
      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        closeLtPopup()
        const { state, dispatch } = view
        dispatch(state.tr.insertText(r, match.from, match.to))
        view.focus()
      })
      list.appendChild(btn)
    })
    ltPopup.appendChild(list)
  }

  document.body.appendChild(ltPopup)

  const rect = anchor.getBoundingClientRect()
  const popupWidth = 260
  let left = rect.left
  if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - popupWidth - 8
  ltPopup.style.position = 'fixed'
  ltPopup.style.left = left + 'px'
  ltPopup.style.top = (rect.bottom + 4) + 'px'
  ltPopup.style.zIndex = '9999'

  setTimeout(() => {
    ltOutsideHandler = (e: MouseEvent) => {
      if (ltPopup && !ltPopup.contains(e.target as Node)) closeLtPopup()
    }
    document.addEventListener('mousedown', ltOutsideHandler)
  }, 0)
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function languageToolPlugin(): Plugin {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pluginView: EditorView | null = null

  function scheduleCheck(doc: PmNode): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      runCheck(doc)
    }, DEBOUNCE_MS)
  }

  async function runCheck(doc: PmNode): Promise<void> {
    if (!pluginView) return
    const st = ltKey.getState(pluginView.state)
    if (!st?.enabled) return

    const { text, posMap } = extractText(doc)
    if (!text.trim()) return

    try {
      const body = new URLSearchParams({ language: 'pt-BR', text })
      const resp = await fetch(LT_URL, { method: 'POST', body })
      if (!resp.ok) return

      type LtApiMatch = {
        offset: number
        length: number
        message: string
        replacements: { value: string }[]
        rule: { issueType: string }
      }
      const data = await resp.json() as { matches: LtApiMatch[] }
      if (!pluginView) return
      const curr = ltKey.getState(pluginView.state)
      if (!curr?.enabled) return

      const matches = data.matches
        .map(m => mapLtMatch(m, posMap))
        .filter((m): m is LtMatch => m !== null)

      pluginView.dispatch(
        pluginView.state.tr.setMeta(ltKey, { type: 'setMatches', matches })
      )
    } catch {
      // LanguageTool server unavailable — silently ignore
    }
  }

  return new Plugin<LtPluginState>({
    key: ltKey,

    state: {
      init(): LtPluginState {
        return { enabled: false, matches: [], decos: DecorationSet.empty }
      },
      apply(tr, prev, _oldState, newState): LtPluginState {
        type LtMeta =
          | { type: 'setEnabled'; enabled: boolean }
          | { type: 'setMatches'; matches: LtMatch[] }
        const meta = tr.getMeta(ltKey) as LtMeta | undefined

        if (meta?.type === 'setEnabled') {
          if (!meta.enabled) {
            if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
            closeLtPopup()
            return { enabled: false, matches: [], decos: DecorationSet.empty }
          }
          scheduleCheck(newState.doc)
          return { enabled: true, matches: [], decos: DecorationSet.empty }
        }

        if (meta?.type === 'setMatches') {
          return { ...prev, matches: meta.matches, decos: buildDecos(meta.matches, newState.doc) }
        }

        if (!prev.enabled) return prev

        if (tr.docChanged) {
          scheduleCheck(newState.doc)
          return { ...prev, decos: prev.decos.map(tr.mapping, newState.doc) }
        }

        return prev
      }
    },

    props: {
      decorations(state) {
        return ltKey.getState(state)?.decos ?? DecorationSet.empty
      },
      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement
          const matchEl = target.closest('.lt-match') as HTMLElement | null
          if (matchEl) {
            const coords = { left: event.clientX, top: event.clientY }
            const posData = view.posAtCoords(coords)
            if (posData) {
              const st = ltKey.getState(view.state)
              const match = st?.matches.find(m => m.from <= posData.pos && posData.pos <= m.to)
              if (match) {
                showLtPopup(matchEl, match, view)
                return true
              }
            }
          } else {
            closeLtPopup()
          }
          return false
        }
      }
    },

    view(view) {
      pluginView = view
      return {
        destroy() {
          pluginView = null
          if (debounceTimer) clearTimeout(debounceTimer)
          closeLtPopup()
        }
      }
    }
  })
}
