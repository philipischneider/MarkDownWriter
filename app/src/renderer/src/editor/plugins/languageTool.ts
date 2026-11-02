import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { Node as PmNode } from 'prosemirror-model'

const LT_URL = 'http://localhost:8081/v2/check'
const DEBOUNCE_MS = 1500

interface LtMatch {
  message: string
  shortMessage: string
  from: number
  to: number
  replacements: string[]
  issueType: string
  ruleId: string
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
  let firstBlock = true

  doc.descendants((node, pos) => {
    if (node.isBlock && node.isTextblock) {
      if (!firstBlock) {
        text += '\n'
        posMap.push(-1)
      }
      firstBlock = false
    }
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
    shortMessage?: string
    replacements: { value: string }[]
    rule: { issueType: string; id: string }
  },
  posMap: number[]
): LtMatch | null {
  if (m.offset >= posMap.length) return null
  const from = posMap[m.offset]
  if (from < 0) return null
  const endIdx = Math.min(m.offset + m.length - 1, posMap.length - 1)
  const to = posMap[endIdx] + 1
  if (from >= to) return null
  return {
    message: m.message,
    shortMessage: m.shortMessage ?? '',
    from,
    to,
    replacements: m.replacements.map(r => r.value),
    issueType: m.rule.issueType,
    ruleId: m.rule.id
  }
}

function buildDecos(matches: LtMatch[], doc: PmNode): DecorationSet {
  const decos = matches.map(m => {
    const cls =
      m.issueType === 'misspelling' ? 'lt-spelling' :
      m.issueType === 'grammar'     ? 'lt-grammar'  : 'lt-style'
    return Decoration.inline(m.from, m.to, { class: `lt-match ${cls}` })
  })
  return DecorationSet.create(doc, decos)
}

// ─── Context-menu popup ───────────────────────────────────────────────────────

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

const TYPE_LABEL: Record<string, string> = {
  misspelling: 'Ortografia',
  grammar:     'Gramática',
  style:       'Estilo',
  typographical: 'Tipografia',
  locale_violation: 'Localização',
}

function showLtPopup(x: number, y: number, match: LtMatch, view: EditorView): void {
  closeLtPopup()

  const popup = document.createElement('div')
  popup.className = 'lt-popup'
  ltPopup = popup

  // ── Header: type badge + short message ──
  const header = document.createElement('div')
  header.className = 'lt-popup-header'

  const badge = document.createElement('span')
  badge.className = `lt-popup-badge lt-popup-badge--${match.issueType === 'misspelling' ? 'spelling' : match.issueType === 'grammar' ? 'grammar' : 'style'}`
  badge.textContent = TYPE_LABEL[match.issueType] ?? 'Sugestão'
  header.appendChild(badge)

  popup.appendChild(header)

  // ── Error message ──
  const msg = document.createElement('div')
  msg.className = 'lt-popup-msg'
  msg.textContent = match.shortMessage || match.message
  popup.appendChild(msg)

  // ── Full explanation (if short ≠ full) ──
  if (match.shortMessage && match.shortMessage !== match.message) {
    const detail = document.createElement('div')
    detail.className = 'lt-popup-detail'
    detail.textContent = match.message
    popup.appendChild(detail)
  }

  // ── Suggestions ──
  if (match.replacements.length > 0) {
    const sep = document.createElement('div')
    sep.className = 'lt-popup-sep'
    popup.appendChild(sep)

    const sugLabel = document.createElement('div')
    sugLabel.className = 'lt-popup-section-label'
    sugLabel.textContent = 'Sugestões'
    popup.appendChild(sugLabel)

    match.replacements.slice(0, 6).forEach(r => {
      const btn = document.createElement('button')
      btn.className = 'lt-popup-suggestion'
      btn.innerHTML = `<span class="lt-popup-sug-arrow">→</span><span>${r}</span>`
      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        closeLtPopup()
        const { state, dispatch } = view
        dispatch(state.tr.insertText(r, match.from, match.to))
        view.focus()
      })
      popup.appendChild(btn)
    })
  }

  // ── Ignore ──
  const sep2 = document.createElement('div')
  sep2.className = 'lt-popup-sep'
  popup.appendChild(sep2)

  const ignoreBtn = document.createElement('button')
  ignoreBtn.className = 'lt-popup-ignore'
  ignoreBtn.textContent = 'Ignorar este erro'
  ignoreBtn.addEventListener('mousedown', e => {
    e.preventDefault()
    closeLtPopup()
    view.dispatch(
      view.state.tr.setMeta(ltKey, { type: 'dismissMatch', from: match.from, to: match.to })
    )
    view.focus()
  })
  popup.appendChild(ignoreBtn)

  document.body.appendChild(popup)

  // Position: prefer below-right of cursor, flip if near edges
  const pw = Math.max(popup.offsetWidth, 280)
  const ph = popup.offsetHeight
  let left = x + 2
  let top  = y + 2
  if (left + pw > window.innerWidth - 8)  left = x - pw - 2
  if (top  + ph > window.innerHeight - 8) top  = y - ph - 2
  popup.style.position = 'fixed'
  popup.style.left = Math.max(4, left) + 'px'
  popup.style.top  = Math.max(4, top)  + 'px'
  popup.style.zIndex = '9999'

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
      const body = new URLSearchParams({ language: 'pt-BR', text, level: 'picky' })
      const resp = await fetch(LT_URL, { method: 'POST', body })
      if (!resp.ok) return

      type LtApiMatch = {
        offset: number
        length: number
        message: string
        shortMessage?: string
        replacements: { value: string }[]
        rule: { issueType: string; id: string }
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
          | { type: 'dismissMatch'; from: number; to: number }
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

        if (meta?.type === 'dismissMatch') {
          const matches = prev.matches.filter(
            m => !(m.from === meta.from && m.to === meta.to)
          )
          return { ...prev, matches, decos: buildDecos(matches, newState.doc) }
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
        contextmenu(view, event) {
          const target = event.target as HTMLElement
          const matchEl = target.closest('.lt-match') as HTMLElement | null
          if (!matchEl) return false

          event.preventDefault()
          const coords = { left: event.clientX, top: event.clientY }
          const posData = view.posAtCoords(coords)
          if (posData) {
            const st = ltKey.getState(view.state)
            const match = st?.matches.find(m => m.from <= posData.pos && posData.pos <= m.to)
            if (match) {
              showLtPopup(event.clientX, event.clientY, match, view)
              return true
            }
          }
          return false
        },
        // Close popup on plain left-click outside
        mousedown(_view, event) {
          if (ltPopup && !ltPopup.contains(event.target as Node)) closeLtPopup()
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
