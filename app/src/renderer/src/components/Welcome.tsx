import { useState, useEffect } from 'react'
import type { Project } from '../../../shared/types'
import styles from './Welcome.module.css'

interface RecentProject {
  title: string
  projectJsonPath: string
  lastOpened: string
}

interface WelcomeProps {
  onProjectLoaded: (loaded: { projectDir: string; project: Project }) => void
}

export function Welcome({ onProjectLoaded }: WelcomeProps) {
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentProject[]>([])

  useEffect(() => {
    window.api.project.recents().then(setRecents).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setError(null)
    setCreating(true)
    try {
      const targetDir = await window.api.dialog.chooseDir()
      if (!targetDir) { setCreating(false); return }
      const result = await window.api.project.create(newTitle.trim(), targetDir)
      if (result) onProjectLoaded(result)
    } catch (e) {
      setError('Erro ao criar projeto.')
    } finally {
      setCreating(false)
    }
  }

  const handleOpen = async () => {
    setError(null)
    const result = await window.api.project.openDialog()
    if (result) onProjectLoaded(result)
  }

  const handleOpenRecent = async (recent: RecentProject) => {
    setError(null)
    try {
      const result = await window.api.project.load(recent.projectJsonPath)
      if (result) onProjectLoaded(result)
      else setError(`Projeto não encontrado: ${recent.projectJsonPath}`)
    } catch {
      setError('Erro ao abrir projeto recente.')
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch { return '' }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>MarkdownWriter</h1>
        <p className={styles.subtitle}>Editor de texto literário</p>

        <div className={styles.section}>
          <h2>Novo projeto</h2>
          <input
            className={styles.input}
            type="text"
            placeholder="Título do projeto"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button
            className={styles.btnPrimary}
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? 'Criando...' : 'Criar projeto'}
          </button>
        </div>

        <div className={styles.divider} />

        {recents.length > 0 && (
          <>
            <div className={styles.section}>
              <h2>Recentes</h2>
              <ul className={styles.recentsList}>
                {recents.map(r => (
                  <li key={r.projectJsonPath}>
                    <button className={styles.recentItem} onClick={() => handleOpenRecent(r)}>
                      <span className={styles.recentTitle}>{r.title}</span>
                      <span className={styles.recentDate}>{formatDate(r.lastOpened)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.divider} />
          </>
        )}

        <div className={styles.section}>
          <h2>Abrir projeto</h2>
          <button className={styles.btnSecondary} onClick={handleOpen}>
            Procurar arquivo project.json...
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
