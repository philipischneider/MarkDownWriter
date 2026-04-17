import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { exampleSetup } from 'prosemirror-example-setup'
import { schema } from '../editor/schema'
import { mdParser, mdSerializer } from '../editor/markdown'
import { buildInputRules } from '../editor/inputRules'
import { wordRepeatPlugin } from '../editor/plugins/wordRepeat'
import { FootnoteView, resetFootnoteCounter } from '../editor/nodeviews/FootnoteView'
import { CommentView } from '../editor/nodeviews/CommentView'
import { VersionGroupView } from '../editor/nodeviews/VersionGroupView'
import styles from './ProseMirrorEditor.module.css'

function buildPlugins() {
  return [
    ...exampleSetup({ schema, menuBar: false }),
    buildInputRules(schema),
    wordRepeatPlugin()
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
}

interface ProseMirrorEditorProps {
  chapterId: string
  content: string
  onChange: (content: string) => void
  onFocus: () => void
  onSplitRequest?: (contentBefore: string, contentAfter: string) => void
}

export const ProseMirrorEditor = forwardRef<EditorCommands, ProseMirrorEditorProps>(
  function ProseMirrorEditor(
    { chapterId, content, onChange, onFocus, onSplitRequest },
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

    // Expose commands to parent
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
        // Auto-open popup after insertion
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
        // Auto-open popup after mark is applied
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

        const { $from } = state.selection

        // Find the direct child block of the document
        let targetDepth = 1
        for (let d = 1; d <= $from.depth; d++) {
          if ($from.node(d - 1).type === schema.nodes.doc) {
            targetDepth = d
            break
          }
        }

        const blockNode = $from.node(targetDepth)
        const blockStart = $from.before(targetDepth)
        const blockEnd = $from.after(targetDepth)

        // Wrap the existing block into version 1
        const v1 = vType.create({ label: 'Versão 1' }, blockNode)
        const v2 = vType.create({ label: 'Versão 2' }, schema.nodes.paragraph.createAndFill()!)
        const group = vgType.create({ activeIndex: 0 }, [v1, v2])

        dispatch(state.tr.replaceWith(blockStart, blockEnd, group))
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
        dispatch(state.tr.replaceSelectionWith(
          state.schema.text(text)
        ))
        view.focus()
      }
    }), [])

    // Create / recreate editor when chapter changes
    useEffect(() => {
      if (!mountRef.current) return

      resetFootnoteCounter()

      let doc
      try {
        doc = mdParser.parse(content || ' ') ?? schema.topNodeType.createAndFill()!
      } catch {
        doc = schema.topNodeType.createAndFill()!
      }

      const state = EditorState.create({ doc, plugins: buildPlugins() })

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
            } catch { /* ignore serialization errors */ }
          }
        },
        handleDOMEvents: {
          focus: () => { onFocusRef.current(); return false },
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
      return () => { view.destroy(); viewRef.current = null }
    }, [chapterId])

    // Sync external content changes (e.g. backup restore)
    useEffect(() => {
      if (!viewRef.current) return
      if (content === lastContentRef.current) return
      try {
        resetFootnoteCounter()
        const doc = mdParser.parse(content || ' ') ?? schema.topNodeType.createAndFill()!
        const state = EditorState.create({ doc, plugins: buildPlugins() })
        viewRef.current.updateState(state)
        lastContentRef.current = content
      } catch { /* ignore */ }
    }, [content])

    return <div ref={mountRef} className={styles.editor} />
  }
)
