import { useState, useCallback, useRef } from 'react'
import type { Project, Chapter, Entity, LoadedProject } from '../../../shared/types'
import { DEFAULT_TYPOGRAPHY } from '../../../shared/types'

export interface ProjectState {
  projectDir: string | null
  project: Project | null
  chaptersContent: Record<string, string>
  activeChapterId: string | null
  isDirty: boolean
}

export function useProjectStore() {
  const [state, setState] = useState<ProjectState>({
    projectDir: null,
    project: null,
    chaptersContent: {},
    activeChapterId: null,
    isDirty: false
  })

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadProject = useCallback(async (loaded: LoadedProject) => {
    setState({
      projectDir: loaded.projectDir,
      project: {
        ...loaded.project,
        entities: loaded.project.entities ?? [],
        settings: {
          ...loaded.project.settings,
          typography: loaded.project.settings.typography ?? DEFAULT_TYPOGRAPHY
        }
      },
      chaptersContent: loaded.chaptersContent,
      activeChapterId: loaded.project.chapters[0]?.id ?? null,
      isDirty: false
    })
  }, [])

  const updateChapterContent = useCallback((chapterId: string, content: string) => {
    setState(prev => ({
      ...prev,
      chaptersContent: { ...prev.chaptersContent, [chapterId]: content },
      isDirty: true
    }))
  }, [])

  const updateProject = useCallback((updater: (p: Project) => Project) => {
    setState(prev => {
      if (!prev.project) return prev
      return { ...prev, project: updater(prev.project), isDirty: true }
    })
  }, [])

  const setActiveChapter = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeChapterId: id }))
  }, [])

  const addChapter = useCallback((chapter: Chapter) => {
    setState(prev => {
      if (!prev.project) return prev
      return {
        ...prev,
        project: { ...prev.project, chapters: [...prev.project.chapters, chapter] },
        chaptersContent: { ...prev.chaptersContent, [chapter.id]: '' },
        activeChapterId: chapter.id,
        isDirty: true
      }
    })
  }, [])

  const reorderChapters = useCallback((chapters: Chapter[]) => {
    setState(prev => {
      if (!prev.project) return prev
      return { ...prev, project: { ...prev.project, chapters }, isDirty: true }
    })
  }, [])

  const deleteChapter = useCallback((chapterId: string) => {
    setState(prev => {
      if (!prev.project) return prev
      const chapters = prev.project.chapters.filter(c => c.id !== chapterId)
      const content = { ...prev.chaptersContent }
      delete content[chapterId]
      const activeChapterId =
        prev.activeChapterId === chapterId ? (chapters[0]?.id ?? null) : prev.activeChapterId
      return { ...prev, project: { ...prev.project, chapters }, chaptersContent: content, activeChapterId, isDirty: true }
    })
  }, [])

  // ─── Entidades ──────────────────────────────────────────────────────────────

  const addEntity = useCallback((entity: Entity) => {
    setState(prev => {
      if (!prev.project) return prev
      return {
        ...prev,
        project: { ...prev.project, entities: [...prev.project.entities, entity] },
        isDirty: true
      }
    })
  }, [])

  const updateEntity = useCallback((entity: Entity) => {
    setState(prev => {
      if (!prev.project) return prev
      return {
        ...prev,
        project: {
          ...prev.project,
          entities: prev.project.entities.map(e => e.id === entity.id ? entity : e)
        },
        isDirty: true
      }
    })
  }, [])

  const deleteEntity = useCallback((entityId: string) => {
    setState(prev => {
      if (!prev.project) return prev
      return {
        ...prev,
        project: {
          ...prev.project,
          entities: prev.project.entities.filter(e => e.id !== entityId)
        },
        isDirty: true
      }
    })
  }, [])

  const markClean = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: false }))
  }, [])

  return {
    state,
    loadProject,
    updateChapterContent,
    updateProject,
    setActiveChapter,
    addChapter,
    reorderChapters,
    deleteChapter,
    addEntity,
    updateEntity,
    deleteEntity,
    markClean,
    autosaveTimer
  }
}
