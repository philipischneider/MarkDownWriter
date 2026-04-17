import { Node as PmNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'

export class VersionGroupView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private node: PmNode
  private view: EditorView
  private getPos: () => number | undefined
  private switcher: HTMLElement
  private body: HTMLElement
  private observer: MutationObserver

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'version-group'
    this.dom.setAttribute('data-active', String(node.attrs.activeIndex ?? 0))

    this.switcher = document.createElement('div')
    this.switcher.className = 'version-switcher'
    this.switcher.setAttribute('contenteditable', 'false')
    this.dom.appendChild(this.switcher)

    this.body = document.createElement('div')
    this.body.className = 'version-body'
    this.dom.appendChild(this.body)

    this.contentDOM = this.body
    this.renderSwitcher()

    // Watch for ProseMirror adding/updating version children in contentDOM,
    // then immediately apply display styles. This is more reliable than
    // CSS nth-child selectors whose timing with ProseMirror rendering is uncertain.
    this.observer = new MutationObserver(() => {
      this.syncVersionDisplay()
    })
    this.observer.observe(this.body, { childList: true, subtree: false })
  }

  private syncVersionDisplay() {
    const activeIndex = this.node.attrs.activeIndex as number
    const children = Array.from(this.body.children) as HTMLElement[]
    children.forEach((el, i) => {
      el.style.display = i === activeIndex ? '' : 'none'
    })
  }

  private renderSwitcher() {
    this.switcher.innerHTML = ''
    const activeIndex = this.node.attrs.activeIndex as number

    this.node.forEach((child, _offset, index) => {
      const pill = document.createElement('button')
      pill.className = 'v-pill' + (index === activeIndex ? ' v-pill--active' : '')
      pill.textContent = child.attrs.label as string
      pill.title = `Versão: ${child.attrs.label} (duplo clique para renomear)`
      pill.setAttribute('contenteditable', 'false')

      pill.addEventListener('mousedown', e => {
        e.preventDefault()
        if (index !== (this.node.attrs.activeIndex as number)) {
          this.setActiveVersion(index)
        }
      })
      pill.addEventListener('dblclick', e => {
        e.preventDefault()
        this.renameVersion(index, pill)
      })

      this.switcher.appendChild(pill)
    })

    const addBtn = document.createElement('button')
    addBtn.className = 'v-pill v-pill--add'
    addBtn.textContent = '+'
    addBtn.title = 'Adicionar versão'
    addBtn.setAttribute('contenteditable', 'false')
    addBtn.addEventListener('mousedown', e => {
      e.preventDefault()
      this.addVersion()
    })
    this.switcher.appendChild(addBtn)

    if (this.node.childCount > 1) {
      const delBtn = document.createElement('button')
      delBtn.className = 'v-pill v-pill--del'
      delBtn.textContent = '×'
      delBtn.title = 'Remover esta versão'
      delBtn.setAttribute('contenteditable', 'false')
      delBtn.addEventListener('mousedown', e => {
        e.preventDefault()
        this.deleteActiveVersion()
      })
      this.switcher.appendChild(delBtn)
    }
  }

  private setActiveVersion(index: number) {
    const pos = this.getPos()
    if (pos === undefined) return
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        activeIndex: index
      })
    )
  }

  private addVersion() {
    const pos = this.getPos()
    if (pos === undefined) return
    const { state } = this.view
    const { schema } = state
    const versionType = schema.nodes.version
    if (!versionType) return

    const newIndex = this.node.childCount
    const newLabel = `Versão ${newIndex + 1}`
    const paragraph = schema.nodes.paragraph.createAndFill()!
    const newVersion = versionType.create({ label: newLabel }, paragraph)

    const insertPos = pos + this.node.nodeSize - 1
    const tr = state.tr
      .insert(insertPos, newVersion)
      .setNodeMarkup(pos, undefined, { ...this.node.attrs, activeIndex: newIndex })

    this.view.dispatch(tr)
  }

  private deleteActiveVersion() {
    const pos = this.getPos()
    if (pos === undefined) return
    if (this.node.childCount <= 1) return

    const activeIndex = this.node.attrs.activeIndex as number
    const { state } = this.view

    let childOffset = pos + 1
    for (let i = 0; i < activeIndex; i++) {
      childOffset += this.node.child(i).nodeSize
    }
    const childSize = this.node.child(activeIndex).nodeSize
    const newActive = activeIndex > 0 ? activeIndex - 1 : 0

    this.view.dispatch(
      state.tr
        .delete(childOffset, childOffset + childSize)
        .setNodeMarkup(pos, undefined, { ...this.node.attrs, activeIndex: newActive })
    )
  }

  private renameVersion(index: number, pill: HTMLButtonElement) {
    const currentLabel = this.node.child(index).attrs.label as string
    const input = document.createElement('input')
    input.className = 'v-pill-rename'
    input.value = currentLabel
    input.style.width = Math.max(50, currentLabel.length * 8) + 'px'
    pill.replaceWith(input)
    input.focus()
    input.select()

    const commit = () => {
      const newLabel = input.value.trim() || currentLabel
      const pos = this.getPos()
      if (pos !== undefined) {
        let childOffset = pos + 1
        for (let i = 0; i < index; i++) childOffset += this.node.child(i).nodeSize
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(childOffset, undefined, {
            ...this.node.child(index).attrs,
            label: newLabel
          })
        )
      }
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
      if (e.key === 'Escape') { input.value = currentLabel; input.blur() }
    })
  }

  update(node: PmNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    const active = node.attrs.activeIndex as number
    this.dom.setAttribute('data-active', String(active))
    this.renderSwitcher()
    // ProseMirror updates contentDOM children after update() returns.
    // syncVersionDisplay() will be triggered by the MutationObserver.
    // Force it immediately too for already-present children (attr-only updates).
    this.syncVersionDisplay()
    return true
  }

  destroy() {
    this.observer.disconnect()
  }

  stopEvent(event: Event) {
    return this.switcher.contains(event.target as Node)
  }

  ignoreMutation() {
    // ProseMirror fully manages contentDOM; switcher is non-editable.
    // Always ignore to prevent re-parse loops when a new group is inserted.
    return true
  }
}
