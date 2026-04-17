import { useRef, useState, useEffect, useCallback } from 'react'
import { ChapterPanel } from './ChapterPanel'
import { ProseMirrorEditor, EditorCommands } from './ProseMirrorEditor'
import { Toolbar } from './Toolbar'
import type { useProjectStore } from '../store/projectStore'
import type { Chapter } from '../../../shared/types'
import styles from './Editor.module.css'

interface EditorProps {
  store: ReturnType<typeof useProjectStore>
  onSave: () => Promise<void>
}

export function Editor({ store, onSave }: EditorProps) {
  const { state, updateChapterContent, updateProject, setActiveChapter, addChapter, reorderChapters, deleteChapter } = store
  const { project, projectDir, chaptersContent, activeChapterId } = state
  const [panelOpen, setPanelOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Map chapterId → editor command ref
  const editorRefs = useRef<Map<string, EditorCommands>>(new Map())

  if (!project || !projectDir) return null

  const activeEditor = () => activeChapterId ? editorRefs.current.get(activeChapterId) : undefined

  const handleSave = useCallback(async () => {
    setSaving(true)
    await onSave()
    setSaving(false)
  }, [onSave])

  // Ctrl+S global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleAddChapter = async () => {
    const chapter = await window.api.chapter.create(projectDir)
    addChapter(chapter)
    await window.api.project.saveMeta(projectDir, {
      ...project,
      chapters: [...project.chapters, chapter]
    })
    setTimeout(() => {
      const el = document.getElementById(`chapter-${chapter.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleDeleteChapter = async (chapterId: string) => {
    if (project.chapters.length <= 1) return
    await window.api.chapter.delete(projectDir, chapterId)
    deleteChapter(chapterId)
    editorRefs.current.delete(chapterId)
  }

  const handleSplitChapter = async (chapterId: string, beforeContent: string, afterContent: string) => {
    const newChapter = await window.api.chapter.create(projectDir)
    const idx = project.chapters.findIndex(c => c.id === chapterId)

    updateChapterContent(chapterId, beforeContent)
    await window.api.chapter.write(projectDir, chapterId, beforeContent)

    const newChapters = [...project.chapters]
    newChapters.splice(idx + 1, 0, newChapter)

    updateProject(p => ({ ...p, chapters: newChapters }))
    updateChapterContent(newChapter.id, afterContent)
    await window.api.chapter.write(projectDir, newChapter.id, afterContent)
    await window.api.project.saveMeta(projectDir, { ...project, chapters: newChapters })

    setTimeout(() => {
      const el = document.getElementById(`chapter-${newChapter.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleMergeWithPrevious = async (chapterId: string) => {
    const idx = project.chapters.findIndex(c => c.id === chapterId)
    if (idx === 0) return
    const prevChapter = project.chapters[idx - 1]
    const prevContent = chaptersContent[prevChapter.id] ?? ''
    const currContent = chaptersContent[chapterId] ?? ''
    const merged = prevContent + '\n\n' + currContent

    updateChapterContent(prevChapter.id, merged)
    await window.api.chapter.write(projectDir, prevChapter.id, merged)
    await window.api.chapter.delete(projectDir, chapterId)
    deleteChapter(chapterId)
    editorRefs.current.delete(chapterId)
  }

  const handleScrollToChapter = (chapterId: string) => {
    const el = document.getElementById(`chapter-${chapterId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveChapter(chapterId)
  }

  const handleFontSizeChange = (delta: number) => {
    updateProject(p => ({
      ...p,
      settings: { ...p.settings, fontSize: Math.max(12, Math.min(32, p.settings.fontSize + delta)) }
    }))
  }

  const handleThemeToggle = () => {
    updateProject(p => ({
      ...p,
      settings: { ...p.settings, theme: p.settings.theme === 'dark' ? 'light' : 'dark' }
    }))
  }

  const handleRenameChapter = (id: string, title: string) => {
    updateProject(p => ({
      ...p,
      chapters: p.chapters.map(c => c.id === id ? { ...c, title } : c)
    }))
  }

  const handleStatusChange = (id: string, status: Chapter['status']) => {
    updateProject(p => ({
      ...p,
      chapters: p.chapters.map(c => c.id === id ? { ...c, status } : c)
    }))
  }

  return (
    <div className={styles.shell}>
      <Toolbar
        projectTitle={project.title}
        theme={project.settings.theme}
        fontSize={project.settings.fontSize}
        isDirty={state.isDirty}
        saving={saving}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen(v => !v)}
        onSave={handleSave}
        onThemeToggle={handleThemeToggle}
        onFontSizeIncrease={() => handleFontSizeChange(1)}
        onFontSizeDecrease={() => handleFontSizeChange(-1)}
      />

      {/* Formatting bar */}
      <FormattingBar
        onInsertFootnote={() => activeEditor()?.insertFootnote()}
        onInsertComment={() => activeEditor()?.insertComment()}
        onInsertVersionGroup={() => activeEditor()?.insertVersionGroup()}
      />

      <div className={styles.body}>
        {panelOpen && (
          <ChapterPanel
            chapters={project.chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={handleScrollToChapter}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onRenameChapter={handleRenameChapter}
            onReorder={reorderChapters}
            onStatusChange={handleStatusChange}
            onMergeWithPrevious={handleMergeWithPrevious}
          />
        )}

        <div className={styles.scrollArea} ref={scrollRef}>
          <div className={styles.editorContent}>
            {project.chapters.map((chapter, index) => (
              <div key={chapter.id} id={`chapter-${chapter.id}`} className={styles.chapterBlock}>
                <ChapterHeader
                  chapter={chapter}
                  isFirst={index === 0}
                  onSplit={(before, after) => handleSplitChapter(chapter.id, before, after)}
                />
                <ProseMirrorEditor
                  ref={cmds => {
                    if (cmds) editorRefs.current.set(chapter.id, cmds)
                    else editorRefs.current.delete(chapter.id)
                  }}
                  chapterId={chapter.id}
                  content={chaptersContent[chapter.id] ?? ''}
                  onChange={content => updateChapterContent(chapter.id, content)}
                  onFocus={() => setActiveChapter(chapter.id)}
                  onSplitRequest={(before, after) => handleSplitChapter(chapter.id, before, after)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Formatting bar ───────────────────────────────────────────────────────────

interface FormattingBarProps {
  onInsertFootnote: () => void
  onInsertComment: () => void
  onInsertVersionGroup: () => void
}

function FormattingBar({ onInsertFootnote, onInsertComment, onInsertVersionGroup }: FormattingBarProps) {
  return (
    <div className={styles.formattingBar}>
      <button
        className={styles.fmtBtn}
        title="Inserir nota de rodapé"
        onMouseDown={e => { e.preventDefault(); onInsertFootnote() }}
      >
        [fn]
      </button>
      <button
        className={styles.fmtBtn}
        title="Marcar trecho como comentário (selecione texto primeiro)"
        onMouseDown={e => { e.preventDefault(); onInsertComment() }}
      >
        {/* comment icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2h12v9H9l-3 3v-3H2z" />
        </svg>
      </button>
      <button
        className={styles.fmtBtn}
        title="Inserir grupo de versões"
        onMouseDown={e => { e.preventDefault(); onInsertVersionGroup() }}
      >
        v1|v2
      </button>
    </div>
  )
}

// ─── Chapter header ───────────────────────────────────────────────────────────

function ChapterHeader({
  chapter,
  isFirst,
  onSplit: _onSplit
}: {
  chapter: Chapter
  isFirst: boolean
  onSplit: (before: string, after: string) => void
}) {
  return (
    <div className={isFirst ? styles.firstChapterHeader : styles.chapterDivider}>
      <span className={styles.chapterLabel}>{chapter.title}</span>
      <span className={styles.chapterStatus} data-status={chapter.status}>
        {chapter.status}
      </span>
    </div>
  )
}
