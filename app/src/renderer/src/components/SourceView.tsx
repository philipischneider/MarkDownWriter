import styles from './SourceView.module.css'
import type { Chapter } from '../../../shared/types'

interface SourceViewProps {
  chapters: Chapter[]
  chaptersContent: Record<string, string>
  onChange: (chapterId: string, content: string) => void
  activeChapterId: string | null
  onFocus: (chapterId: string) => void
}

export function SourceView({ chapters, chaptersContent, onChange, activeChapterId, onFocus }: SourceViewProps) {
  return (
    <div className={styles.container}>
      {chapters.map(chapter => (
        <div key={chapter.id} className={styles.block} id={`source-${chapter.id}`}>
          <div className={styles.header}>
            <span className={styles.title}>{chapter.title}</span>
            <span className={styles.badge}>markdown</span>
          </div>
          <textarea
            className={styles.textarea + (activeChapterId === chapter.id ? ' ' + styles.active : '')}
            value={chaptersContent[chapter.id] ?? ''}
            onChange={e => onChange(chapter.id, e.target.value)}
            onFocus={() => onFocus(chapter.id)}
            spellCheck={false}
          />
        </div>
      ))}
    </div>
  )
}
