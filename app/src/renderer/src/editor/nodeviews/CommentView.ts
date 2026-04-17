import { Mark } from 'prosemirror-model'
import { EditorView } from 'prosemirror-view'

export class CommentView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private popup: HTMLElement | null = null
  private mark: Mark
  private view: EditorView
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null

  constructor(mark: Mark, view: EditorView) {
    this.mark = mark
    this.view = view

    this.dom = document.createElement('span')
    this.dom.className = 'comment-mark'
    this.dom.setAttribute('data-id', mark.attrs.id || '')
    this.dom.setAttribute('data-comment', mark.attrs.text || '')

    this.contentDOM = this.dom

    this.dom.addEventListener('mousedown', e => {
      if (this.popup && this.popup.contains(e.target as Node)) return
      e.preventDefault()
    })
    this.dom.addEventListener('click', e => {
      if (this.popup && this.popup.contains(e.target as Node)) return
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
    this.popup.className = 'comment-popup'
    this.popup.innerHTML = `
      <div class="comment-popup-header">
        <span>Comentário</span>
        <button class="comment-popup-close" title="Fechar">×</button>
      </div>
      <textarea class="comment-popup-input" rows="3" placeholder="Digite o comentário...">${this.mark.attrs.text || ''}</textarea>
    `

    // Mount on body so it's outside the contenteditable
    document.body.appendChild(this.popup)
    this.positionPopup()

    const textarea = this.popup.querySelector('textarea')!
    const closeBtn = this.popup.querySelector('.comment-popup-close')!

    textarea.addEventListener('input', () => {
      this.updateMarkText(textarea.value)
    })

    closeBtn.addEventListener('mousedown', e => {
      e.preventDefault()
      this.closePopup()
    })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }, 0)

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

  private updateMarkText(newText: string) {
    const { state, dispatch } = this.view
    const { doc, tr } = state
    const markId = this.mark.attrs.id
    const markType = state.schema.marks.comment
    if (!markType) return

    doc.descendants((node, pos) => {
      node.marks.forEach(m => {
        if (m.type === markType && m.attrs.id === markId) {
          const newMark = markType.create({ ...m.attrs, text: newText })
          tr.removeMark(pos, pos + node.nodeSize, markType)
          tr.addMark(pos, pos + node.nodeSize, newMark)
        }
      })
    })

    if (tr.docChanged) dispatch(tr)
    this.mark = markType.create({ ...this.mark.attrs, text: newText })
  }

  destroy() {
    this.closePopup()
  }

  stopEvent(event: Event) {
    if (this.popup && this.popup.contains(event.target as Node)) return true
    return false
  }

  ignoreMutation() { return false }
}
