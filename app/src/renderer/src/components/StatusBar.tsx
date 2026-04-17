import styles from './StatusBar.module.css'

interface StatusBarProps {
  activeChapterWords: number
  totalWords: number
  activeChapterTitle: string
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function StatusBar({ activeChapterWords, totalWords, activeChapterTitle }: StatusBarProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.chapterName}>{activeChapterTitle}</span>
      <div className={styles.counts}>
        <span className={styles.count} title="Palavras no capítulo ativo">
          {fmt(activeChapterWords)} pal.
        </span>
        <span className={styles.sep}>·</span>
        <span className={styles.count} title="Palavras no projeto todo">
          {fmt(totalWords)} total
        </span>
      </div>
    </div>
  )
}
