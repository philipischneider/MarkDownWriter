import { useState, useRef } from 'react'
import type { Chapter, ChapterStatus } from '../../../shared/types'
import styles from './ChapterPanel.module.css'

interface ChapterPanelProps {
  chapters: Chapter[]
  activeChapterId: string | null
  onSelectChapter: (id: string) => void
  onAddChapter: () => void
  onDeleteChapter: (id: string) => void
  onRenameChapter: (id: string, title: string) => void
  onReorder: (chapters: Chapter[]) => void
  onStatusChange: (id: string, status: ChapterStatus) => void
  onMergeWithPrevious: (id: string) => void
}

const STATUS_OPTIONS: ChapterStatus[] = ['rascunho', 'provisório', 'final', 'arquivado']

export function ChapterPanel({
  chapters, activeChapterId, onSelectChapter, onAddChapter,
  onDeleteChapter, onRenameChapter, onReorder, onStatusChange, onMergeWithPrevious
}: ChapterPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = (index: number) => { dragItem.current = index }
  const handleDragEnter = (index: number) => { dragOverItem.current = index }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return
    const reordered = [...chapters]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    onReorder(reordered)
  }

  const startEdit = (chapter: Chapter) => {
    setEditingId(chapter.id)
    setEditingTitle(chapter.title)
    setContextMenu(null)
  }

  const commitEdit = (id: string) => {
    if (editingTitle.trim()) onRenameChapter(id, editingTitle.trim())
    setEditingId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }

  const closeContext = () => setContextMenu(null)

  return (
    <div className={styles.panel} onClick={closeContext}>
      <div className={styles.header}>
        <span className={styles.heading}>Capítulos</span>
        <button className={styles.addBtn} onClick={onAddChapter} title="Novo capítulo">+</button>
      </div>

      <ul className={styles.list}>
        {chapters.map((chapter, index) => (
          <li
            key={chapter.id}
            className={`${styles.item} ${chapter.id === activeChapterId ? styles.active : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            onClick={() => onSelectChapter(chapter.id)}
            onContextMenu={e => handleContextMenu(e, chapter.id)}
          >
            <span className={styles.dragHandle} title="Arrastar">⠿</span>

            {editingId === chapter.id ? (
              <input
                className={styles.titleInput}
                value={editingTitle}
                autoFocus
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={() => commitEdit(chapter.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(chapter.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className={styles.title} onDoubleClick={() => startEdit(chapter)}>
                {chapter.title}
              </span>
            )}

            <span className={styles.statusDot} data-status={chapter.status} title={chapter.status} />
          </li>
        ))}
      </ul>

      {contextMenu && (() => {
        const chapter = chapters.find(c => c.id === contextMenu.id)
        if (!chapter) return null
        return (
          <div
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => startEdit(chapter)}>Renomear</button>
            <div className={styles.contextDivider} />
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                className={chapter.status === s ? styles.activeStatus : ''}
                onClick={() => { onStatusChange(chapter.id, s); closeContext() }}
              >
                {s === chapter.status ? '✓ ' : ''}{s}
              </button>
            ))}
            <div className={styles.contextDivider} />
            <button
              onClick={() => {
                const idx = chapters.findIndex(c => c.id === chapter.id)
                if (idx > 0) { onMergeWithPrevious(chapter.id); closeContext() }
              }}
              disabled={chapters.findIndex(c => c.id === chapter.id) === 0}
            >
              Mesclar com anterior
            </button>
            <div className={styles.contextDivider} />
            <button
              className={styles.deleteBtn}
              onClick={() => { onDeleteChapter(chapter.id); closeContext() }}
              disabled={chapters.length <= 1}
            >
              Excluir capítulo
            </button>
          </div>
        )
      })()}
    </div>
  )
}
