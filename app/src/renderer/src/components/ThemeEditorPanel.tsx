import { useState } from 'react'
import styles from './ThemeEditorPanel.module.css'
import type { TypographySettings } from '../../../shared/types'
import { DEFAULT_TYPOGRAPHY } from '../../../shared/types'

const STORAGE_KEY = 'mw_typography_themes'

const FONT_OPTIONS = [
  { label: 'Georgia (serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Palatino (serif)', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Garamond (serif)', value: 'Garamond, "EB Garamond", serif' },
  { label: 'System sans-serif', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Helvetica (sans)', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Monospace', value: '"Fira Code", Consolas, monospace' },
  { label: 'Inherit', value: 'inherit' },
]

function loadThemes(): Record<string, TypographySettings> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveThemes(themes: Record<string, TypographySettings>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes))
}

interface ThemeEditorPanelProps {
  typography: TypographySettings
  onChange: (t: TypographySettings) => void
}

export function ThemeEditorPanel({ typography, onChange }: ThemeEditorPanelProps) {
  const [themes, setThemes] = useState<Record<string, TypographySettings>>(loadThemes)
  const [saveName, setSaveName] = useState('')

  const set = <K extends keyof TypographySettings>(key: K, value: TypographySettings[K]) => {
    onChange({ ...typography, [key]: value })
  }

  const handleSaveTheme = () => {
    const name = saveName.trim()
    if (!name) return
    const updated = { ...themes, [name]: { ...typography } }
    setThemes(updated)
    saveThemes(updated)
    setSaveName('')
  }

  const handleLoadTheme = (name: string) => {
    if (themes[name]) onChange({ ...themes[name] })
  }

  const handleDeleteTheme = (name: string) => {
    const updated = { ...themes }
    delete updated[name]
    setThemes(updated)
    saveThemes(updated)
  }

  const handleReset = () => onChange({ ...DEFAULT_TYPOGRAPHY })

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Tipografia</span>
      </div>

      <div className={styles.body}>
        <Section label="Fontes">
          <Row label="Corpo">
            <select className={styles.select} value={typography.fontProse} onChange={e => set('fontProse', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Row>
          <Row label="Títulos">
            <select className={styles.select} value={typography.fontHeading} onChange={e => set('fontHeading', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Row>
        </Section>

        <Section label="Espaçamento">
          <SliderRow
            label="Entrelinha"
            value={typography.lineHeight}
            min={1.2} max={2.8} step={0.05}
            display={v => v.toFixed(2)}
            onChange={v => set('lineHeight', v)}
          />
          <SliderRow
            label="Entre parágrafos"
            value={typography.paragraphSpacing}
            min={0.4} max={3} step={0.05}
            display={v => `${v.toFixed(2)}em`}
            onChange={v => set('paragraphSpacing', v)}
          />
          <SliderRow
            label="Largura da coluna"
            value={typography.columnWidth}
            min={40} max={120} step={1}
            display={v => `${v}ch`}
            onChange={v => set('columnWidth', v)}
          />
        </Section>

        <Section label="Tamanho dos títulos">
          <SliderRow
            label="H1"
            value={typography.h1Size}
            min={1} max={3} step={0.05}
            display={v => `${v.toFixed(2)}em`}
            onChange={v => set('h1Size', v)}
          />
          <SliderRow
            label="H2"
            value={typography.h2Size}
            min={1} max={2.5} step={0.05}
            display={v => `${v.toFixed(2)}em`}
            onChange={v => set('h2Size', v)}
          />
          <SliderRow
            label="H3"
            value={typography.h3Size}
            min={1} max={2} step={0.05}
            display={v => `${v.toFixed(2)}em`}
            onChange={v => set('h3Size', v)}
          />
        </Section>

        <Section label="Temas salvos">
          <div className={styles.saveRow}>
            <input
              className={styles.input}
              placeholder="Nome do tema…"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveTheme()}
            />
            <button className={styles.btn} onClick={handleSaveTheme} disabled={!saveName.trim()}>
              Salvar
            </button>
          </div>

          {Object.keys(themes).length === 0 && (
            <p className={styles.empty}>Nenhum tema salvo.</p>
          )}

          {Object.keys(themes).map(name => (
            <div key={name} className={styles.themeRow}>
              <button className={styles.themeLoad} onClick={() => handleLoadTheme(name)}>{name}</button>
              <button className={styles.themeDel} onClick={() => handleDeleteTheme(name)} title="Excluir">×</button>
            </div>
          ))}

          <button className={styles.resetBtn} onClick={handleReset}>
            Restaurar padrão
          </button>
        </Section>
      </div>
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

function SliderRow({
  label, value, min, max, step, display, onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.rowLabel}>{label}</span>
      <input
        type="range"
        className={styles.slider}
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <span className={styles.sliderValue}>{display(value)}</span>
    </div>
  )
}
