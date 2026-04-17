import styles from './Toolbar.module.css'
import type { Theme } from '../../../shared/types'

interface ToolbarProps {
  projectTitle: string
  theme: Theme
  fontSize: number
  isDirty: boolean
  saving: boolean
  panelOpen: boolean
  entityPanelOpen: boolean
  ollamaPanelOpen: boolean
  onTogglePanel: () => void
  onToggleEntityPanel: () => void
  onToggleOllamaPanel: () => void
  onSave: () => void
  onExport: () => void
  onThemeToggle: () => void
  onFontSizeIncrease: () => void
  onFontSizeDecrease: () => void
}

export function Toolbar({
  projectTitle, theme, fontSize, isDirty, saving,
  panelOpen, entityPanelOpen, ollamaPanelOpen,
  onTogglePanel, onToggleEntityPanel, onToggleOllamaPanel,
  onSave, onExport, onThemeToggle,
  onFontSizeIncrease, onFontSizeDecrease
}: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button
          className={styles.iconBtn}
          onClick={onTogglePanel}
          title={panelOpen ? 'Fechar painel' : 'Abrir painel'}
        >
          {panelOpen ? '◧' : '▣'}
        </button>
        <span className={styles.title}>{projectTitle}</span>
        {isDirty && !saving && <span className={styles.dot} title="Alterações não salvas" />}
        {saving && <span className={styles.saving}>salvando...</span>}
      </div>

      <div className={styles.right}>
        <div className={styles.fontControls}>
          <button className={styles.iconBtn} onClick={onFontSizeDecrease} title="Diminuir fonte">A-</button>
          <span className={styles.fontSize}>{fontSize}px</span>
          <button className={styles.iconBtn} onClick={onFontSizeIncrease} title="Aumentar fonte">A+</button>
        </div>
        <button className={styles.iconBtn} onClick={onThemeToggle} title="Alternar tema">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          className={styles.iconBtn + (entityPanelOpen ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleEntityPanel}
          title="Painel de entidades"
        >
          @
        </button>
        <button
          className={styles.iconBtn + (ollamaPanelOpen ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleOllamaPanel}
          title="Sugestões LLM (Ollama)"
        >
          ✦
        </button>
        <button className={styles.iconBtn} onClick={onExport} title="Exportar (PDF, DOCX, EPUB…)">
          ⬆
        </button>
        <button className={styles.iconBtn} onClick={onSave} title="Salvar (Ctrl+S)">
          ↓
        </button>
      </div>
    </div>
  )
}
