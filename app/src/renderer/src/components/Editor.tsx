import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { ChapterPanel } from './ChapterPanel'
import { ProseMirrorEditor, EditorCommands } from './ProseMirrorEditor'
import { Toolbar, ViewMode } from './Toolbar'
import { StatusBar } from './StatusBar'
import { EntityPanel, EntityPicker } from './EntityPanel'
import { ExportDialog } from './ExportDialog'
import { OllamaPanel } from './OllamaPanel'
import { SourceView } from './SourceView'
import { PreviewView } from './PreviewView'
import { ThemeEditorPanel } from './ThemeEditorPanel'
import { FindReplaceBar } from './FindReplaceBar'
import { ProjectInfoDialog } from './ProjectInfoDialog'
import { countWords } from '../editor/plugins/wordRepeat'
import { extractHeadings, moveSection } from '../editor/headingUtils'
import type { useProjectStore } from '../store/projectStore'
import type { Chapter, Entity } from '../../../shared/types'
import { DEFAULT_TYPOGRAPHY } from '../../../shared/types'
import styles from './Editor.module.css'

interface EditorProps {
  store: ReturnType<typeof useProjectStore>
  onSave: () => Promise<void>
}

export function Editor({ store, onSave }: EditorProps) {
  const {
    state, updateChapterContent, updateProject, setActiveChapter,
    addChapter, reorderChapters, deleteChapter,
    addEntity, updateEntity, deleteEntity
  } = store
  const { project, projectDir, chaptersContent, activeChapterId } = state

  const [panelOpen, setPanelOpen] = useState(true)
  const [entityPanelOpen, setEntityPanelOpen] = useState(false)
  const [typographyPanelOpen, setTypographyPanelOpen] = useState(false)
  const [ollamaPanelOpen, setOllamaPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [findOpen, setFindOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [projectInfoOpen, setProjectInfoOpen] = useState(false)
  const [grammarEnabled, setGrammarEnabled] = useState(false)
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setFindOpen(v => !v)
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setFocusMode(v => !v)
      }
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, focusMode])

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
    const prefix = viewMode === 'source' ? 'source' : viewMode === 'preview' ? 'preview' : 'chapter'
    const el = document.getElementById(`${prefix}-${chapterId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveChapter(chapterId)
  }

  const handleScrollToHeading = (chapterId: string, headingIndex: number) => {
    handleScrollToChapter(chapterId)
    setTimeout(() => {
      editorRefs.current.get(chapterId)?.scrollToHeading(headingIndex)
    }, 120)
  }

  const handleReorderSections = async (chapterId: string, fromIdx: number, toIdx: number) => {
    const markdown = chaptersContent[chapterId] ?? ''
    const headings = extractHeadings(markdown, chapterId)
    const newMarkdown = moveSection(markdown, headings, fromIdx, toIdx)
    if (newMarkdown === markdown) return
    updateChapterContent(chapterId, newMarkdown)
    await window.api.chapter.write(projectDir, chapterId, newMarkdown)
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

  const handleToggleGrammar = () => {
    const next = !grammarEnabled
    setGrammarEnabled(next)
    for (const cmd of editorRefs.current.values()) {
      cmd.setLtEnabled(next)
    }
  }

  const handleToggleNumbering = () => {
    updateProject(p => ({
      ...p,
      settings: { ...p.settings, numberingEnabled: !(p.settings.numberingEnabled ?? false) }
    }))
  }

  const handleTypographyChange = (typography: typeof DEFAULT_TYPOGRAPHY) => {
    updateProject(p => ({ ...p, settings: { ...p.settings, typography } }))
  }

  const handleProjectInfoSave = (title: string, author: string) => {
    updateProject(p => ({ ...p, title, author }))
    setProjectInfoOpen(false)
  }

  const wordCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [id, md] of Object.entries(chaptersContent)) {
      counts[id] = countWords(md)
    }
    return counts
  }, [chaptersContent])

  const totalWords = useMemo(
    () => Object.values(wordCounts).reduce((a, b) => a + b, 0),
    [wordCounts]
  )

  const activeChapter = project.chapters.find(c => c.id === activeChapterId)

  const handleEntityMarkInText = (entity: Entity) => {
    activeEditor()?.insertEntityMark(entity.id, entity.type, entity.name, entity.color)
  }

  const handleOpenEntityPicker = (e: React.MouseEvent) => {
    if (!activeEditor()?.hasSelection()) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPickerPos({ top: rect.bottom + 6, left: rect.left })
    setPickerVisible(true)
  }

  const typography = project.settings.typography ?? DEFAULT_TYPOGRAPHY
  const numberingEnabled = project.settings.numberingEnabled ?? false

  // CSS variables for heading colors (theme-aware via --hcolor-* CSS vars)
  const headingColorVars = {
    '--heading-h1-color': `var(--hcolor-${typography.h1Color ?? 'default'})`,
    '--heading-h2-color': `var(--hcolor-${typography.h2Color ?? 'default'})`,
    '--heading-h3-color': `var(--hcolor-${typography.h3Color ?? 'default'})`,
  } as React.CSSProperties

  return (
    <div className={styles.shell + (focusMode ? ' ' + styles.focusMode : '')} style={headingColorVars}>
      {!focusMode && (
        <Toolbar
          projectTitle={project.title}
          theme={project.settings.theme}
          fontSize={project.settings.fontSize}
          isDirty={state.isDirty}
          saving={saving}
          panelOpen={panelOpen}
          entityPanelOpen={entityPanelOpen}
          ollamaPanelOpen={ollamaPanelOpen}
          typographyPanelOpen={typographyPanelOpen}
          grammarEnabled={grammarEnabled}
          numberingEnabled={numberingEnabled}
          focusMode={focusMode}
          viewMode={viewMode}
          onTogglePanel={() => setPanelOpen(v => !v)}
          onToggleEntityPanel={() => setEntityPanelOpen(v => !v)}
          onToggleOllamaPanel={() => setOllamaPanelOpen(v => !v)}
          onToggleTypographyPanel={() => setTypographyPanelOpen(v => !v)}
          onToggleGrammar={handleToggleGrammar}
          onToggleNumbering={handleToggleNumbering}
          onToggleFocusMode={() => setFocusMode(v => !v)}
          onSetViewMode={setViewMode}
          onSave={handleSave}
          onExport={() => setExportOpen(true)}
          onThemeToggle={handleThemeToggle}
          onFontSizeIncrease={() => handleFontSizeChange(1)}
          onFontSizeDecrease={() => handleFontSizeChange(-1)}
          onFind={() => setFindOpen(v => !v)}
          onEditProjectInfo={() => setProjectInfoOpen(true)}
        />
      )}

      {/* Formatting bar — only in edit mode */}
      {viewMode === 'edit' && !focusMode && (
        <FormattingBar
          onInsertFootnote={() => activeEditor()?.insertFootnote()}
          onInsertComment={() => activeEditor()?.insertComment()}
          onInsertVersionGroup={() => activeEditor()?.insertVersionGroup()}
          onInsertEntity={handleOpenEntityPicker}
        />
      )}

      {/* Find/replace bar */}
      {findOpen && viewMode === 'edit' && (
        <FindReplaceBar
          editor={activeEditor()}
          onClose={() => {
            setFindOpen(false)
            activeEditor()?.findSetQuery('')
          }}
        />
      )}

      <div className={styles.body}>
        {panelOpen && !focusMode && (
          <ChapterPanel
            chapters={project.chapters}
            activeChapterId={activeChapterId}
            chaptersContent={chaptersContent}
            numberingEnabled={numberingEnabled}
            onSelectChapter={handleScrollToChapter}
            onScrollToHeading={handleScrollToHeading}
            onReorderSections={handleReorderSections}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onRenameChapter={handleRenameChapter}
            onReorder={reorderChapters}
            onStatusChange={handleStatusChange}
            onMergeWithPrevious={handleMergeWithPrevious}
          />
        )}

        {/* Source view */}
        {viewMode === 'source' && (
          <SourceView
            chapters={project.chapters}
            chaptersContent={chaptersContent}
            onChange={updateChapterContent}
            activeChapterId={activeChapterId}
            onFocus={setActiveChapter}
          />
        )}

        {/* Preview view */}
        {viewMode === 'preview' && (
          <PreviewView
            chapters={project.chapters}
            chaptersContent={chaptersContent}
          />
        )}

        {/* Edit (WYSIWYG) view */}
        {viewMode === 'edit' && (
          <div className={styles.scrollArea} ref={scrollRef}>
            <div className={styles.editorContent}>
              {project.chapters.map((chapter, index) => (
                <div key={chapter.id} id={`chapter-${chapter.id}`} className={styles.chapterBlock}>
                  <ChapterHeader
                    chapter={chapter}
                    chapterNumber={numberingEnabled ? index + 1 : undefined}
                    isFirst={index === 0}
                    onSplit={(before, after) => handleSplitChapter(chapter.id, before, after)}
                  />
                  <ProseMirrorEditor
                    ref={cmds => {
                      if (cmds) {
                        editorRefs.current.set(chapter.id, cmds)
                        if (grammarEnabled) cmds.setLtEnabled(true)
                      } else {
                        editorRefs.current.delete(chapter.id)
                      }
                    }}
                    chapterId={chapter.id}
                    chapterIndex={index + 1}
                    numberingEnabled={numberingEnabled}
                    content={chaptersContent[chapter.id] ?? ''}
                    onChange={content => updateChapterContent(chapter.id, content)}
                    onFocus={() => setActiveChapter(chapter.id)}
                    onSplitRequest={(before, after) => handleSplitChapter(chapter.id, before, after)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {ollamaPanelOpen && !focusMode && (
          <OllamaPanel
            selectedText={activeEditor()?.getSelectedText() ?? ''}
            contextText={activeEditor()?.getContextText() ?? ''}
            onInsertText={text => activeEditor()?.insertTextAtCursor(text)}
          />
        )}

        {typographyPanelOpen && !focusMode && (
          <ThemeEditorPanel
            typography={typography}
            onChange={handleTypographyChange}
          />
        )}

        {entityPanelOpen && !focusMode && (
          <EntityPanel
            entities={project.entities}
            chaptersContent={chaptersContent}
            onAdd={addEntity}
            onUpdate={updateEntity}
            onDelete={deleteEntity}
            onMarkInText={handleEntityMarkInText}
          />
        )}
      </div>

      {!focusMode && (
        <StatusBar
          activeChapterTitle={activeChapter?.title ?? ''}
          activeChapterWords={activeChapterId ? (wordCounts[activeChapterId] ?? 0) : 0}
          totalWords={totalWords}
        />
      )}

      {focusMode && (
        <div style={{
          position: 'fixed', bottom: 16, right: 20,
          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          pointerEvents: 'none'
        }}>
          Esc · Ctrl+Shift+F — sair do modo foco
        </div>
      )}

      {exportOpen && projectDir && (
        <ExportDialog
          projectTitle={project.title}
          author={project.author}
          projectDir={projectDir}
          chapters={project.chapters}
          onClose={() => setExportOpen(false)}
        />
      )}

      {pickerVisible && (
        <EntityPicker
          entities={project.entities}
          onPick={entity => {
            handleEntityMarkInText(entity)
            setPickerVisible(false)
          }}
          onClose={() => setPickerVisible(false)}
          style={{ top: pickerPos.top, left: pickerPos.left }}
        />
      )}

      {projectInfoOpen && (
        <ProjectInfoDialog
          title={project.title}
          author={project.author}
          onSave={handleProjectInfoSave}
          onClose={() => setProjectInfoOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Formatting bar ───────────────────────────────────────────────────────────

interface FormattingBarProps {
  onInsertFootnote: () => void
  onInsertComment: () => void
  onInsertVersionGroup: () => void
  onInsertEntity: (e: React.MouseEvent) => void
}

function FormattingBar({ onInsertFootnote, onInsertComment, onInsertVersionGroup, onInsertEntity }: FormattingBarProps) {
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
      <button
        className={styles.fmtBtn}
        title="Marcar trecho como entidade (selecione texto primeiro)"
        onMouseDown={e => { e.preventDefault(); onInsertEntity(e) }}
      >
        @
      </button>
    </div>
  )
}

// ─── Chapter header ───────────────────────────────────────────────────────────

function ChapterHeader({
  chapter,
  chapterNumber,
  isFirst,
  onSplit: _onSplit
}: {
  chapter: Chapter
  chapterNumber?: number
  isFirst: boolean
  onSplit: (before: string, after: string) => void
}) {
  return (
    <div className={isFirst ? styles.firstChapterHeader : styles.chapterDivider}>
      {chapterNumber !== undefined && (
        <span className={styles.chapterNumber}>{chapterNumber}.</span>
      )}
      <span className={styles.chapterLabel}>{chapter.title}</span>
      <span className={styles.chapterStatus} data-status={chapter.status}>
        {chapter.status}
      </span>
    </div>
  )
}
