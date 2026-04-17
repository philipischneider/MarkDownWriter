import { Node as PmNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

let footnoteCounter = 0
const footnoteMap = new Map<string, number>()

export function resetFootnoteCounter() {
  footnoteCounter = 0
  footnoteMap.clear()
}

export class FootnoteView implements NodeView {
  dom: HTMLElement
  private popup: HTMLElement | null = null
  private node: PmNode
  private view: EditorView
  private getPos: () => number | undefined
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    const id = node.attrs.id || 'fn-unknown'
    if (!footnoteMap.has(id)) {
      footnoteMap.set(id, ++footnoteCounter)
    }
    const num = footnoteMap.get(id)!

    this.dom = document.createElement('footnote')
    this.dom.className = 'footnote-ref'
    this.dom.setAttribute('data-id', id)
    this.dom.setAttribute('data-content', node.attrs.content)
    this.dom.innerHTML = `<sup class="footnote-num">[${num}]</sup>`
    this.dom.setAttribute('title', node.attrs.content || 'Clique para editar')

    this.dom.addEventListener('mousedown', e => {
      e.preventDefault() // Prevent editor from stealing focus
    })
    this.dom.addEventListener('click', e => {
      e.stopPropagation()
      this.togglePopup()
    })
  }

  openPopup() {
    if (!this.popup) this.togglePopup()
  }

  private togglePopup() {
    if (this.popup) {
      this.closePopup()
      return
    }

    this.popup = document.createElement('div')
    this.popup.className = 'footnote-popup'
    this.popup.innerHTML = `
      <div class="footnote-popup-header">
        <span>Nota de rodapé</span>
        <button class="footnote-popup-close" title="Fechar">×</button>
      </div>
      <textarea class="footnote-popup-input" rows="3" placeholder="Digite o texto da nota...">${this.node.attrs.content || ''}</textarea>
    `

    // Mount on body so it's outside the contenteditable
    document.body.appendChild(this.popup)
    this.positionPopup()

    const textarea = this.popup.querySelector('textarea')!
    const closeBtn = this.popup.querySelector('.footnote-popup-close')!

    textarea.addEventListener('input', () => {
      const pos = this.getPos()
      if (pos === undefined) return
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          content: textarea.value
        })
      )
    })

    closeBtn.addEventListener('mousedown', e => {
      e.preventDefault()
      this.closePopup()
    })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }, 0)

    // Close on outside click
    this.outsideClickHandler = (e: MouseEvent) => {
      if (
        this.popup &&
        !this.popup.contains(e.target as Node) &&
        !this.dom.contains(e.target as Node)
      ) {
        this.closePopup()
      }
    }
    setTimeout(() => {
      document.addEventListener('mousedown', this.outsideClickHandler!)
    }, 0)
  }

  private positionPopup() {
    if (!this.popup) return
    const rect = this.dom.getBoundingClientRect()
    const popupWidth = 300
    let left = rect.left
    if (left + popupWidth > window.innerWidth - 8) {
      left = window.innerWidth - popupWidth - 8
    }
    this.popup.style.position = 'fixed'
    this.popup.style.left = left + 'px'
    this.popup.style.top = (rect.bottom + 6) + 'px'
    this.popup.style.width = popupWidth + 'px'
    this.popup.style.zIndex = '9999'
  }

  private closePopup() {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    this.popup?.remove()
    this.popup = null
  }

  update(node: PmNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.dom.setAttribute('data-content', node.attrs.content)
    this.dom.setAttribute('title', node.attrs.content || 'Clique para editar')
    const textarea = this.popup?.querySelector('textarea')
    if (textarea && textarea !== document.activeElement) {
      textarea.value = node.attrs.content
    }
    return true
  }

  destroy() {
    this.closePopup()
  }

  stopEvent(event: Event) {
    if (this.popup && this.popup.contains(event.target as Node)) return true
    return false
  }

  ignoreMutation() { return true }
}
