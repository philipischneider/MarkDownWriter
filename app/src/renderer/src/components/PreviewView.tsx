import { useMemo } from 'react'
import MarkdownIt from 'markdown-it'
import styles from './PreviewView.module.css'
import type { Chapter } from '../../../shared/types'

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

interface PreviewViewProps {
  chapters: Chapter[]
  chaptersContent: Record<string, string>
}

export function PreviewView({ chapters, chaptersContent }: PreviewViewProps) {
  const html = useMemo(() => {
    return chapters.map(ch => {
      const content = chaptersContent[ch.id] ?? ''
      return { id: ch.id, title: ch.title, html: md.render(content) }
    })
  }, [chapters, chaptersContent])

  return (
    <div className={styles.container}>
      {html.map(ch => (
        <div key={ch.id} className={styles.chapter} id={`preview-${ch.id}`}>
          <div className={styles.divider}>
            <span className={styles.chapterTitle}>{ch.title}</span>
          </div>
          <div
            className={styles.prose}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        </div>
      ))}
    </div>
  )
}
