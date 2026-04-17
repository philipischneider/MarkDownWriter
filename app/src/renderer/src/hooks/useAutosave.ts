import { useEffect, useRef, useCallback } from 'react'
import type { Project } from '../../../shared/types'

interface AutosaveOptions {
  projectDir: string | null
  project: Project | null
  chaptersContent: Record<string, string>
  isDirty: boolean
  onSaved: () => void
}

export function useAutosave({ projectDir, project, chaptersContent, isDirty, onSaved }: AutosaveOptions) {
  const saveInProgress = useRef(false)
  const isDirtyRef = useRef(isDirty)
  const chaptersRef = useRef(chaptersContent)
  const projectRef = useRef(project)
  const projectDirRef = useRef(projectDir)

  isDirtyRef.current = isDirty
  chaptersRef.current = chaptersContent
  projectRef.current = project
  projectDirRef.current = projectDir

  const save = useCallback(async () => {
    const dir = projectDirRef.current
    const proj = projectRef.current
    if (!dir || !proj || saveInProgress.current) return
    saveInProgress.current = true
    try {
      await Promise.all(
        proj.chapters.map(chapter =>
          window.api.chapter.write(dir, chapter.id, chaptersRef.current[chapter.id] ?? '')
        )
      )
      await window.api.project.saveMeta(dir, proj)
      onSaved()
    } finally {
      saveInProgress.current = false
    }
  }, [onSaved])

  // Auto-save periódico (intervalo configurável)
  useEffect(() => {
    if (!project) return
    const interval = (project.settings.autosaveInterval ?? 30) * 1000
    const timer = setInterval(() => {
      if (isDirtyRef.current) save()
    }, interval)
    return () => clearInterval(timer)
  }, [project?.settings.autosaveInterval, save])

  // Auto-save por debounce na digitação (2s de pausa)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isDirty) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (isDirtyRef.current) save()
    }, 2000)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [isDirty, chaptersContent, save])

  // Salvar ao fechar
  useEffect(() => {
    const handler = () => { if (isDirtyRef.current) save() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [save])

  // Backup automático a cada 5 minutos
  useEffect(() => {
    if (!project || !projectDir) return
    const timer = setInterval(async () => {
      await save()
      if (projectDirRef.current && projectRef.current) {
        await window.api.backup.create(projectDirRef.current, projectRef.current)
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [project, projectDir, save])

  return { save }
}
