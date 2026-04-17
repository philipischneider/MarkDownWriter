import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { exampleSetup } from 'prosemirror-example-setup'
import { schema } from '../editor/schema'
import { mdSerializer, parseMarkdown } from '../editor/markdown'
import { buildInputRules } from '../editor/inputRules'
import { wordRepeatPlugin } from '../editor/plugins/wordRepeat'
import { findReplacePlugin, setQuery, findNext, findPrev, replaceCurrent, replaceAll } from '../editor/plugins/findReplace'
import { languageToolPlugin, setLtEnabled } from '../editor/plugins/languageTool'
import { outlinePlugin, outlinePluginKey } from '../editor/outlinePlugin'
import { FootnoteView, resetFootnoteCounter } from '../editor/nodeviews/FootnoteView'
import { CommentView } from '../editor/nodeviews/CommentView'
import { VersionGroupView } from '../editor/nodeviews/VersionGroupView'
import styles from './ProseMirrorEditor.module.css'

function buildPlugins(chapterIndex: number, numberingEnabled: boolean) {
  return [
    ...exampleSetup({ schema, menuBar: false }),
    buildInputRules(schema),
    wordRepeatPlugin(),
    findReplacePlugin(),
    languageToolPlugin(),
    outlinePlugin(chapterIndex, numberingEnabled)
  ]
}

export interface EditorCommands {
  insertFootnote: () => void
  insertComment: () => void
  insertVersionGroup: () => void
  insertEntityMark: (entityId: string, entityType: string, entityName: string, color: string) => void
  hasSelection: () => boolean
  getSelectedText: () => string
  getContextText: (chars?: number) => string
  insertTextAtCursor: (text: string) => void
  findSetQuery: (query: string) => void
  findNext: () => void
  findPrev: () => void
  findReplaceCurrent: (replacement: string) => void
  findReplaceAll: (replacement: string) => void
  setLtEnabled: (enabled: boolean) => void
  scrollToHeading: (index: number) => void
}

interface ProseMirrorEditorProps {
  chapterId: string
  chapterIndex: number
  numberingEnabled: boolean
  content: string
  onChange: (content: string) => void
  onFocus: () => void
  onSplitRequest?: (contentBefore: string, contentAfter: string) => void
}

export const ProseMirrorEditor = forwardRef<EditorCommands, ProseMirrorEditorProps>(
  function ProseMirrorEditor(
    { chapterId, chapterIndex, numberingEnabled, content, onChange, onFocus, onSplitRequest },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onFocusRef = useRef(onFocus)
    const onSplitRef = useRef(onSplitRequest)
    const lastContentRef = useRef(content)

    onChangeRef.current = onChange
    onFocusRef.current = onFocus
    onSplitRef.current = onSplitRequest

    useImperativeHandle(ref, () => ({
      insertFootnote() {
        const view = viewRef.current
        if (!view) return
        const { state, dispatch } = view
        const fnType = state.schema.nodes.footnote
        if (!fnType) return
        const id = 'fn-' + Math.random().toString(36).slice(2, 8)
        const node = fnType.create({ id, content: '' })
        dispatch(state.tr.replaceSelectionWith(node))
        requestAnimationFrame(() => {
          const el = view.dom.querySelector(`footnote[data-id="${id}"]`) as HTMLElement | null
          el?.click()
        })
      },

      insertComment() {
        const view = viewRef.current
        if (!view) return
        const { state, dispatch } = view
        const markType = state.schema.marks.comment
        if (!markType) return
        const { from, to } = state.selection
        if (from === to) return
        const id = 'c-' + Math.random().toString(36).slice(2, 8)
        dispatch(state.tr.addMark(from, to, markType.create({ id, text: '' })))
        requestAnimationFrame(() => {
          const el = view.dom.querySelector(`.comment-mark[data-id="${id}"]`) as HTMLElement | null
          el?.click()
        })
      },

      insertVersionGroup() {
        const view = viewRef.current
        if (!view) return
        const { state, dispatch } = view
        const { schema } = state
        const vgType = schema.nodes.version_group
        const vType = schema.nodes.version
        if (!vgType || !vType) return

        let $pos = state.selection.$from
        if ($pos.depth === 0) {
          const inner = state.selection.from + 1
          if (inner > state.doc.content.size) return
          $pos = state.doc.resolve(inner)
          if ($pos.depth === 0) return
        }

        for (let d = 0; d <= $pos.depth; d++) {
          if ($pos.node(d).type === vgType) return
        }

        let blockDepth = $pos.depth
        while (blockDepth > 0 && !$pos.node(blockDepth).isTextblock) {
          blockDepth--
        }
        if (blockDepth === 0) return

        const blockNode = $pos.node(blockDepth)
        const blockStart = $pos.before(blockDepth)
        const blockEnd = $pos.after(blockDepth)

        try {
          const paragraph = schema.nodes.paragraph.createAndFill()
          if (!paragraph) return

          const v1 = vType.create({ label: 'Versão 1' }, blockNode)
          const v2 = vType.create({ label: 'Versão 2' }, paragraph)
          const group = vgType.create({ activeIndex: 0 }, [v1, v2])
          const tr = state.tr.replaceWith(blockStart, blockEnd, group)
          const cursorPos = Math.min(blockStart + 2, tr.doc.content.size)
          tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)))
          dispatch(tr.scrollIntoView())
        } catch {
          return
        }

        view.focus()
      },

      insertEntityMark(entityId, entityType, entityName, color) {
        const view = viewRef.current
        if (!view) return
        const { state, dispatch } = view
        const markType = state.schema.marks.entity_ref
        if (!markType) return
        const { from, to } = state.selection
        if (from === to) return
        dispatch(state.tr.addMark(from, to, markType.create({ entityId, entityType, entityName, color })))
        view.focus()
      },

      hasSelection() {
        const view = viewRef.current
        if (!view) return false
        const { from, to } = view.state.selection
        return from !== to
      },

      getSelectedText() {
        const view = viewRef.current
        if (!view) return ''
        const { from, to } = view.state.selection
        if (from === to) return ''
        return view.state.doc.textBetween(from, to, ' ')
      },

      getContextText(chars = 500) {
        const view = viewRef.current
        if (!view) return ''
        const pos = view.state.selection.anchor
        const start = Math.max(0, pos - chars)
        return view.state.doc.textBetween(start, pos, ' ')
      },

      insertTextAtCursor(text: string) {
        const view = viewRef.current
        if (!view) return
        const { state, dispatch } = view
        dispatch(state.tr.replaceSelectionWith(state.schema.text(text)))
        view.focus()
      },

      findSetQuery(query: string) {
        if (viewRef.current) setQuery(viewRef.current, query)
      },
      findNext() {
        if (viewRef.current) findNext(viewRef.current)
      },
      findPrev() {
        if (viewRef.current) findPrev(viewRef.current)
      },
      findReplaceCurrent(replacement: string) {
        if (viewRef.current) replaceCurrent(viewRef.current, replacement)
      },
      findReplaceAll(replacement: string) {
        if (viewRef.current) replaceAll(viewRef.current, replacement)
      },
      setLtEnabled(enabled: boolean) {
        if (viewRef.current) setLtEnabled(viewRef.current, enabled)
      },

      scrollToHeading(index: number) {
        const view = viewRef.current
        if (!view) return
        let count = 0
        view.state.doc.forEach((node, offset) => {
          if (node.type.name !== 'heading' || count++ !== index) return
          try {
            const { node: domNode } = view.domAtPos(offset + 1)
            const el = domNode.nodeType === Node.ELEMENT_NODE
              ? domNode as HTMLElement
              : (domNode as Node).parentElement
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          } catch { /* ignore */ }
        })
      }
    }), [])

    // Update outline plugin when numbering or chapter index changes (without recreating editor)
    useEffect(() => {
      if (!viewRef.current) return
      const tr = viewRef.current.state.tr
      tr.setMeta(outlinePluginKey, { chapterIndex, enabled: numberingEnabled })
      viewRef.current.dispatch(tr)
    }, [numberingEnabled, chapterIndex])

    useEffect(() => {
      if (!mountRef.current) return

      resetFootnoteCounter()

      let doc
      try {
        doc = parseMarkdown(content || ' ')
      } catch {
        doc = schema.topNodeType.createAndFill()!
      }

      const state = EditorState.create({ doc, plugins: buildPlugins(chapterIndex, numberingEnabled) })

      const view = new EditorView(mountRef.current, {
        state,
        nodeViews: {
          footnote: (node, view, getPos) => new FootnoteView(node, view, getPos),
          version_group: (node, view, getPos) => new VersionGroupView(node, view, getPos)
        },
        markViews: {
          comment: (mark, view) => new CommentView(mark, view)
        },
        dispatchTransaction(tr) {
          const newState = view.state.apply(tr)
          view.updateState(newState)
          if (tr.docChanged) {
            try {
              const md = mdSerializer.serialize(newState.doc)
              lastContentRef.current = md
              onChangeRef.current(md)
            } catch {
              /* ignore serialization errors */
            }
          }
        },
        handleDOMEvents: {
          focus: () => {
            onFocusRef.current()
            return false
          },
          keydown: (view, event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && onSplitRef.current) {
              event.preventDefault()
              const { state } = view
              const pos = state.selection.anchor
              const fullMd = mdSerializer.serialize(state.doc)

              const beforeDoc = state.doc.cut(0, pos)
              const afterDoc = state.doc.cut(pos)
              try {
                const before = mdSerializer.serialize(beforeDoc)
                const after = mdSerializer.serialize(afterDoc)
                onSplitRef.current(before.trim(), after.trim())
              } catch {
                const half = Math.floor(fullMd.length / 2)
                const breakPoint = fullMd.indexOf('\n\n', half)
                if (breakPoint > 0) {
                  onSplitRef.current(fullMd.slice(0, breakPoint).trim(), fullMd.slice(breakPoint).trim())
                }
              }
              return true
            }
            return false
          }
        }
      })

      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [chapterId])

    useEffect(() => {
      if (!viewRef.current) return
      if (content === lastContentRef.current) return
      try {
        resetFootnoteCounter()
        const doc = parseMarkdown(content || ' ')
        const state = EditorState.create({ doc, plugins: buildPlugins(chapterIndex, numberingEnabled) })
        viewRef.current.updateState(state)
        lastContentRef.current = content
      } catch {
        /* ignore */
      }
    }, [content])

    return <div ref={mountRef} className={`${styles.editor}${numberingEnabled ? ' ' + styles.numberingActive : ''}`} />
  }
)
