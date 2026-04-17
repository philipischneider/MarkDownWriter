import { useState, useEffect } from 'react'
import { Welcome } from './components/Welcome'
import { Editor } from './components/Editor'
import { RecoveryDialog } from './components/RecoveryDialog'
import { useProjectStore } from './store/projectStore'
import { useAutosave } from './hooks/useAutosave'
import type { LoadedProject } from '../../shared/types'
import { DEFAULT_TYPOGRAPHY } from '../../shared/types'

export default function App() {
  const store = useProjectStore()
  const { state, loadProject, markClean } = store
  const [recoverySnapshot, setRecoverySnapshot] = useState<string | null>(null)
  const [pendingProjectDir, setPendingProjectDir] = useState<string | null>(null)

  const { save } = useAutosave({
    projectDir: state.projectDir,
    project: state.project,
    chaptersContent: state.chaptersContent,
    isDirty: state.isDirty,
    onSaved: markClean
  })

  const handleProjectLoaded = async (loaded: { projectDir: string; project: import('../../shared/types').Project }) => {
    // Verificar recovery antes de carregar
    const snapshot = await window.api.backup.checkRecovery(loaded.projectDir)
    if (snapshot) {
      setRecoverySnapshot(snapshot)
      setPendingProjectDir(loaded.projectDir)
      return
    }
    await openProject(loaded)
  }

  const openProject = async (loaded: { projectDir: string; project: import('../../shared/types').Project }) => {
    // Carregar conteúdo de todos os capítulos
    const chaptersContent: Record<string, string> = {}
    await Promise.all(
      loaded.project.chapters.map(async chapter => {
        chaptersContent[chapter.id] = await window.api.chapter.read(loaded.projectDir, chapter.id)
      })
    )
    const fullLoaded: LoadedProject = { ...loaded, chaptersContent }
    await loadProject(fullLoaded)
  }

  const handleRecoveryAccept = async () => {
    if (!recoverySnapshot || !pendingProjectDir) return
    await window.api.backup.restore(pendingProjectDir, recoverySnapshot)
    const reloaded = await window.api.project.load(pendingProjectDir + '/project.json')
    if (reloaded) await openProject(reloaded)
    setRecoverySnapshot(null)
    setPendingProjectDir(null)
  }

  const handleRecoveryDecline = async () => {
    if (!pendingProjectDir) return
    const reloaded = await window.api.project.load(pendingProjectDir + '/project.json')
    if (reloaded) await openProject(reloaded)
    setRecoverySnapshot(null)
    setPendingProjectDir(null)
  }

  // Aplicar tema ao <html>
  useEffect(() => {
    const theme = state.project?.settings.theme ?? 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  }, [state.project?.settings.theme])

  // Aplicar tamanho de fonte
  useEffect(() => {
    const size = state.project?.settings.fontSize ?? 18
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`)
  }, [state.project?.settings.fontSize])

  // Aplicar tipografia
  useEffect(() => {
    const t = state.project?.settings.typography ?? DEFAULT_TYPOGRAPHY
    const el = document.documentElement
    el.style.setProperty('--font-prose', t.fontProse)
    el.style.setProperty('--font-heading', t.fontHeading)
    el.style.setProperty('--line-height-prose', String(t.lineHeight))
    el.style.setProperty('--editor-paragraph-spacing', `${t.paragraphSpacing}em`)
    el.style.setProperty('--editor-column-width', `${t.columnWidth}ch`)
    el.style.setProperty('--editor-h1-size', `${t.h1Size}em`)
    el.style.setProperty('--editor-h2-size', `${t.h2Size}em`)
    el.style.setProperty('--editor-h3-size', `${t.h3Size}em`)
  }, [state.project?.settings.typography])

  if (recoverySnapshot) {
    return (
      <RecoveryDialog
        snapshotName={recoverySnapshot}
        onAccept={handleRecoveryAccept}
        onDecline={handleRecoveryDecline}
      />
    )
  }

  if (!state.project || !state.projectDir) {
    return <Welcome onProjectLoaded={handleProjectLoaded} />
  }

  return (
    <Editor
      store={store}
      onSave={save}
    />
  )
}
