import styles from './Toolbar.module.css'
import type { Theme } from '../../../shared/types'

export type ViewMode = 'edit' | 'source' | 'preview'

interface ToolbarProps {
  projectTitle: string
  theme: Theme
  fontSize: number
  isDirty: boolean
  saving: boolean
  panelOpen: boolean
  entityPanelOpen: boolean
  ollamaPanelOpen: boolean
  typographyPanelOpen: boolean
  grammarEnabled: boolean
  numberingEnabled: boolean
  focusMode: boolean
  viewMode: ViewMode
  onTogglePanel: () => void
  onToggleEntityPanel: () => void
  onToggleOllamaPanel: () => void
  onToggleTypographyPanel: () => void
  onToggleGrammar: () => void
  onToggleNumbering: () => void
  onToggleFocusMode: () => void
  onSetViewMode: (mode: ViewMode) => void
  onSave: () => void
  onExport: () => void
  onThemeToggle: () => void
  onFontSizeIncrease: () => void
  onFontSizeDecrease: () => void
  onFind: () => void
  onEditProjectInfo: () => void
}

export function Toolbar({
  projectTitle, theme, fontSize, isDirty, saving,
  panelOpen, entityPanelOpen, ollamaPanelOpen, typographyPanelOpen, grammarEnabled, numberingEnabled, focusMode, viewMode,
  onTogglePanel, onToggleEntityPanel, onToggleOllamaPanel, onToggleTypographyPanel,
  onToggleGrammar, onToggleNumbering, onToggleFocusMode, onSetViewMode,
  onSave, onExport, onThemeToggle,
  onFontSizeIncrease, onFontSizeDecrease,
  onFind, onEditProjectInfo
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
        <span
          className={styles.title}
          title="Editar informações do projeto"
          onClick={onEditProjectInfo}
          style={{ cursor: 'pointer' }}
        >
          {projectTitle}
        </span>
        {isDirty && !saving && <span className={styles.dot} title="Alterações não salvas" />}
        {saving && <span className={styles.saving}>salvando...</span>}
      </div>

      <div className={styles.center}>
        <div className={styles.viewToggle}>
          <button
            className={styles.viewBtn + (viewMode === 'edit' ? ' ' + styles.viewBtnActive : '')}
            onClick={() => onSetViewMode('edit')}
            title="Modo edição (WYSIWYG)"
          >
            Editar
          </button>
          <button
            className={styles.viewBtn + (viewMode === 'source' ? ' ' + styles.viewBtnActive : '')}
            onClick={() => onSetViewMode('source')}
            title="Código fonte Markdown"
          >
            Fonte
          </button>
          <button
            className={styles.viewBtn + (viewMode === 'preview' ? ' ' + styles.viewBtnActive : '')}
            onClick={() => onSetViewMode('preview')}
            title="Pré-visualização renderizada"
          >
            Preview
          </button>
        </div>
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
        <button className={styles.iconBtn} onClick={onFind} title="Buscar e substituir (Ctrl+F)">
          ⌕
        </button>
        <button
          className={styles.iconBtn + (numberingEnabled ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleNumbering}
          title="Numeração hierárquica de seções"
        >
          §
        </button>
        <button
          className={styles.iconBtn + (grammarEnabled ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleGrammar}
          title="Verificação gramatical LanguageTool (requer servidor em localhost:8081)"
        >
          ABC
        </button>
        <button
          className={styles.iconBtn + (typographyPanelOpen ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleTypographyPanel}
          title="Editor de tipografia"
        >
          Aa
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
        <button
          className={styles.iconBtn + (focusMode ? ' ' + styles.iconBtnActive : '')}
          onClick={onToggleFocusMode}
          title="Modo foco (Ctrl+Shift+F)"
        >
          ⛶
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
