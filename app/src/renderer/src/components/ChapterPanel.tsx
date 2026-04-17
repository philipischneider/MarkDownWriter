import { useState, useRef, useMemo } from 'react'
import type { Chapter, ChapterStatus } from '../../../shared/types'
import { extractHeadings } from '../editor/headingUtils'
import styles from './ChapterPanel.module.css'

interface ChapterPanelProps {
  chapters: Chapter[]
  activeChapterId: string | null
  chaptersContent: Record<string, string>
  onSelectChapter: (id: string) => void
  onScrollToHeading: (chapterId: string, index: number) => void
  onReorderSections: (chapterId: string, fromIdx: number, toIdx: number) => void
  onAddChapter: () => void
  onDeleteChapter: (id: string) => void
  onRenameChapter: (id: string, title: string) => void
  onReorder: (chapters: Chapter[]) => void
  onStatusChange: (id: string, status: ChapterStatus) => void
  onMergeWithPrevious: (id: string) => void
}

const STATUS_OPTIONS: ChapterStatus[] = ['rascunho', 'provisório', 'final', 'arquivado']

const HEADING_INDENT: Record<number, number> = { 1: 20, 2: 30, 3: 40 }

export function ChapterPanel({
  chapters, activeChapterId, chaptersContent,
  onSelectChapter, onScrollToHeading, onReorderSections,
  onAddChapter, onDeleteChapter, onRenameChapter,
  onReorder, onStatusChange, onMergeWithPrevious
}: ChapterPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())
  const [headingDropTarget, setHeadingDropTarget] = useState<string | null>(null)

  // Chapter drag state
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  // Heading drag state
  const dragHeadingFrom = useRef<{ chapterId: string; idx: number } | null>(null)

  // Compute headings for each chapter
  const chapterHeadings = useMemo(() => {
    const result: Record<string, ReturnType<typeof extractHeadings>> = {}
    for (const chapter of chapters) {
      const md = chaptersContent[chapter.id] ?? ''
      result[chapter.id] = extractHeadings(md, chapter.id)
    }
    return result
  }, [chapters, chaptersContent])

  // ── Chapter drag ──────────────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    if (dragHeadingFrom.current) return
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    if (dragHeadingFrom.current) return
    dragOverItem.current = index
  }

  const handleDragEnd = () => {
    if (dragHeadingFrom.current) return
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null
      dragOverItem.current = null
      return
    }
    const reordered = [...chapters]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    onReorder(reordered)
  }

  // ── Heading drag ──────────────────────────────────────────────────────────

  const handleHeadingDragStart = (e: React.DragEvent, chapterId: string, idx: number) => {
    e.stopPropagation()
    dragHeadingFrom.current = { chapterId, idx }
  }

  const handleHeadingDragEnter = (e: React.DragEvent, chapterId: string, target: number | 'end') => {
    e.stopPropagation()
    if (dragHeadingFrom.current?.chapterId !== chapterId) return
    setHeadingDropTarget(`${chapterId}|${target}`)
  }

  const handleHeadingDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    const from = dragHeadingFrom.current
    if (from && headingDropTarget) {
      const [targetChapter, targetIdx] = headingDropTarget.split('|')
      if (targetChapter === from.chapterId) {
        const headings = chapterHeadings[from.chapterId] ?? []
        const toIdx = targetIdx === 'end' ? headings.length : parseInt(targetIdx, 10)
        if (!isNaN(toIdx)) {
          onReorderSections(from.chapterId, from.idx, toIdx)
        }
      }
    }
    dragHeadingFrom.current = null
    setHeadingDropTarget(null)
  }

  // ── Chapter collapse ──────────────────────────────────────────────────────

  const toggleCollapse = (chapterId: string) => {
    setCollapsedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  // ── Chapter edit / context menu ───────────────────────────────────────────

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
        {chapters.map((chapter, index) => {
          const headings = chapterHeadings[chapter.id] ?? []
          const isCollapsed = collapsedChapters.has(chapter.id)
          const showHeadings = headings.length > 0 && !isCollapsed

          return (
            <li
              key={chapter.id}
              className={styles.chapterGroup}
              onDragEnter={() => handleDragEnter(index)}
              onDragOver={e => { if (!dragHeadingFrom.current) e.preventDefault() }}
            >
              {/* Chapter header row */}
              <div
                className={`${styles.item} ${chapter.id === activeChapterId ? styles.active : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectChapter(chapter.id)}
                onContextMenu={e => handleContextMenu(e, chapter.id)}
              >
                {headings.length > 0 ? (
                  <button
                    className={styles.collapseBtn}
                    onClick={e => { e.stopPropagation(); toggleCollapse(chapter.id) }}
                    title={isCollapsed ? 'Expandir seções' : 'Recolher seções'}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                ) : (
                  <span className={styles.collapseSpacer} />
                )}

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
              </div>

              {/* Heading items */}
              {showHeadings && (
                <ul className={styles.headingList}>
                  {headings.map((heading, hIdx) => {
                    const dropKey = `${chapter.id}|${hIdx}`
                    return (
                      <li
                        key={heading.id}
                        className={`${styles.headingItem} ${headingDropTarget === dropKey ? styles.headingDropAbove : ''}`}
                        style={{ paddingLeft: HEADING_INDENT[heading.level] ?? 20 }}
                        draggable
                        onDragStart={e => handleHeadingDragStart(e, chapter.id, hIdx)}
                        onDragEnter={e => handleHeadingDragEnter(e, chapter.id, hIdx)}
                        onDragEnd={handleHeadingDragEnd}
                        onDragOver={e => { e.stopPropagation(); e.preventDefault() }}
                        onClick={e => { e.stopPropagation(); onScrollToHeading(chapter.id, hIdx) }}
                      >
                        <span className={styles.headingHandle}>⠿</span>
                        <span className={styles.headingTitle} data-level={heading.level}>
                          {heading.text}
                        </span>
                      </li>
                    )
                  })}
                  {/* End drop zone */}
                  <li
                    className={`${styles.headingDropZone} ${headingDropTarget === `${chapter.id}|end` ? styles.headingDropAbove : ''}`}
                    onDragEnter={e => handleHeadingDragEnter(e, chapter.id, 'end')}
                    onDragOver={e => { e.stopPropagation(); e.preventDefault() }}
                  />
                </ul>
              )}
            </li>
          )
        })}
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
