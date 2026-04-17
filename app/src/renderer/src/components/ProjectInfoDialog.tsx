import { useState } from 'react'
import styles from './ProjectInfoDialog.module.css'

interface ProjectInfoDialogProps {
  title: string
  author: string
  onSave: (title: string, author: string) => void
  onClose: () => void
}

export function ProjectInfoDialog({ title, author, onSave, onClose }: ProjectInfoDialogProps) {
  const [t, setT] = useState(title)
  const [a, setA] = useState(author)

  const handleSave = () => {
    if (t.trim()) onSave(t.trim(), a.trim())
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>Informações do projeto</span>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <label className={styles.label}>Título</label>
          <input
            className={styles.input}
            value={t}
            onChange={e => setT(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />

          <label className={styles.label}>Autor</label>
          <input
            className={styles.input}
            value={a}
            onChange={e => setA(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!t.trim()}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
