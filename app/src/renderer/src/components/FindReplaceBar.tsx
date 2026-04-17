import { useEffect, useRef, useState } from 'react'
import styles from './FindReplaceBar.module.css'
import type { EditorCommands } from './ProseMirrorEditor'

interface FindReplaceBarProps {
  editor: EditorCommands | undefined
  onClose: () => void
  matchCount?: number
  currentMatch?: number
}

export function FindReplaceBar({ editor, onClose, matchCount = 0, currentMatch = -1 }: FindReplaceBarProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    editor?.findSetQuery(query)
  }, [query, editor])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter') {
      e.shiftKey ? editor?.findPrev() : editor?.findNext()
    }
  }

  const hasMatches = matchCount > 0

  return (
    <div className={styles.bar}>
      <button
        className={styles.toggle}
        title={showReplace ? 'Esconder substituição' : 'Mostrar substituição'}
        onClick={() => setShowReplace(v => !v)}
      >
        {showReplace ? '▾' : '▸'}
      </button>

      <div className={styles.fields}>
        <div className={styles.fieldRow}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Buscar…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.count}>
            {query ? (hasMatches ? `${currentMatch + 1}/${matchCount}` : 'sem resultados') : ''}
          </span>
          <button className={styles.navBtn} title="Anterior (Shift+Enter)" onClick={() => editor?.findPrev()} disabled={!hasMatches}>↑</button>
          <button className={styles.navBtn} title="Próximo (Enter)" onClick={() => editor?.findNext()} disabled={!hasMatches}>↓</button>
        </div>

        {showReplace && (
          <div className={styles.fieldRow}>
            <input
              className={styles.input}
              placeholder="Substituir por…"
              value={replacement}
              onChange={e => setReplacement(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            />
            <button
              className={styles.replaceBtn}
              onClick={() => editor?.findReplaceCurrent(replacement)}
              disabled={!hasMatches}
            >
              Substituir
            </button>
            <button
              className={styles.replaceBtn}
              onClick={() => editor?.findReplaceAll(replacement)}
              disabled={!hasMatches}
            >
              Todos
            </button>
          </div>
        )}
      </div>

      <button className={styles.close} title="Fechar (Esc)" onClick={onClose}>×</button>
    </div>
  )
}
