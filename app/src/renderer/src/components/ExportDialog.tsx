import { useState, useEffect } from 'react'
import type { Chapter } from '../../../shared/types'
import styles from './ExportDialog.module.css'

type ExportFormat = 'pdf' | 'docx' | 'epub' | 'html' | 'odt'

const FORMATS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'docx', label: 'Word (.docx)',      desc: 'Compatível com Microsoft Word e LibreOffice' },
  { id: 'pdf',  label: 'PDF',               desc: 'Requer wkhtmltopdf ou outro motor PDF' },
  { id: 'epub', label: 'EPUB',              desc: 'E-reader (Kindle, Kobo, etc.)' },
  { id: 'html', label: 'HTML',              desc: 'Página web, fácil de compartilhar' },
  { id: 'odt',  label: 'LibreOffice (.odt)', desc: 'Formato aberto de processador de texto' },
]

interface ExportDialogProps {
  projectTitle: string
  author: string
  projectDir: string
  chapters: Chapter[]
  onClose: () => void
}

export function ExportDialog({ projectTitle, author, projectDir, chapters, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('docx')
  const [selectedIds, setSelectedIds] = useState<string[]>(chapters.map(c => c.id))
  const [pandocAvailable, setPandocAvailable] = useState<boolean | null>(null)
  const [pandocVersion, setPandocVersion] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; filePath?: string; reason?: string } | null>(null)

  useEffect(() => {
    window.api.export.checkPandoc().then(res => {
      setPandocAvailable(res.available)
      setPandocVersion(res.version)
    })
  }, [])

  const toggleChapter = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  // Preserve chapter order from `chapters` array
  const orderedSelected = chapters.filter(c => selectedIds.includes(c.id)).map(c => c.id)

  const handleExport = async () => {
    setRunning(true)
    setResult(null)
    const res = await window.api.export.run({
      format,
      projectDir,
      projectTitle,
      author,
      chapterIds: orderedSelected
    })
    setResult(res)
    setRunning(false)
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>Exportar projeto</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {pandocAvailable === false && (
          <div className={styles.warning}>
            Pandoc não encontrado. Instale em{' '}
            <strong>pandoc.org/installing</strong> e reinicie o app.
          </div>
        )}

        {pandocAvailable === true && (
          <div className={styles.pandocOk}>Pandoc {pandocVersion} disponível</div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Formato</div>
          <div className={styles.formatGrid}>
            {FORMATS.map(f => (
              <button
                key={f.id}
                className={styles.formatBtn + (f.id === format ? ' ' + styles.formatBtnActive : '')}
                onClick={() => setFormat(f.id)}
              >
                <span className={styles.formatLabel}>{f.label}</span>
                <span className={styles.formatDesc}>{f.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Capítulos a incluir</div>
          <div className={styles.chapterList}>
            <button
              className={styles.toggleAll}
              onClick={() =>
                setSelectedIds(selectedIds.length === chapters.length ? [] : chapters.map(c => c.id))
              }
            >
              {selectedIds.length === chapters.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            {chapters.map(c => (
              <label key={c.id} className={styles.chapterRow}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggleChapter(c.id)}
                />
                <span>{c.title}</span>
                <span className={styles.chapterStatus} data-status={c.status}>{c.status}</span>
              </label>
            ))}
          </div>
        </div>

        {result && (
          <div className={result.success ? styles.success : styles.error}>
            {result.success
              ? `Exportado: ${result.filePath}`
              : `Erro: ${result.reason}`
            }
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={running || pandocAvailable === false || orderedSelected.length === 0}
          >
            {running ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  )
}
