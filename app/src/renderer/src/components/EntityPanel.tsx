import React, { useState, useMemo } from 'react'
import type { Entity, EntityType, EntityField } from '../../../shared/types'
import styles from './EntityPanel.module.css'

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  characters:    'Personagens',
  places:        'Lugares',
  organizations: 'Organizações',
  other:         'Outros'
}

const DEFAULT_FIELDS: Record<EntityType, { key: string; label: string }[]> = {
  characters:    [
    { key: 'age',          label: 'Idade' },
    { key: 'appearance',   label: 'Aparência' },
    { key: 'personality',  label: 'Personalidade' },
    { key: 'motivation',   label: 'Motivação' },
  ],
  places:        [
    { key: 'location',     label: 'Localização' },
    { key: 'climate',      label: 'Clima' },
    { key: 'inhabitants',  label: 'Habitantes' },
  ],
  organizations: [
    { key: 'objective',    label: 'Objetivo' },
    { key: 'members',      label: 'Membros' },
    { key: 'founded',      label: 'Fundação' },
  ],
  other: []
}

const ENTITY_COLORS = [
  '#5b8dee', '#e05252', '#4caf7d', '#e0a035',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e8c',
]

function newEntity(type: EntityType): Entity {
  const id = Math.random().toString(36).slice(2, 10)
  const now = new Date().toISOString()
  return {
    id,
    type,
    name: '',
    aliases: [],
    color: ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)],
    description: '',
    fields: DEFAULT_FIELDS[type].map(f => ({ ...f, value: '' })),
    created: now,
    modified: now
  }
}

interface EntityPanelProps {
  entities: Entity[]
  chaptersContent: Record<string, string>
  onAdd: (entity: Entity) => void
  onUpdate: (entity: Entity) => void
  onDelete: (entityId: string) => void
  onMarkInText: (entity: Entity) => void
}

export function EntityPanel({
  entities, chaptersContent, onAdd, onUpdate, onDelete, onMarkInText
}: EntityPanelProps) {
  const [activeType, setActiveType] = useState<EntityType>('characters')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Count occurrences per entity across all chapters
  const occurrences = useMemo(() => {
    const allText = Object.values(chaptersContent).join('\n').toLowerCase()
    const counts: Record<string, number> = {}
    for (const entity of entities) {
      const terms = [entity.name, ...entity.aliases].filter(Boolean)
      let count = 0
      for (const term of terms) {
        if (!term) continue
        const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const m = allText.match(re)
        if (m) count += m.length
      }
      counts[entity.id] = count
    }
    return counts
  }, [entities, chaptersContent])

  const filtered = entities.filter(e =>
    e.type === activeType &&
    (search === '' || e.name.toLowerCase().includes(search.toLowerCase()))
  )

  const selected = entities.find(e => e.id === selectedId) ?? null

  const handleAdd = () => {
    const entity = newEntity(activeType)
    onAdd(entity)
    setSelectedId(entity.id)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Entidades</span>
      </div>

      <div className={styles.typeTabs}>
        {(Object.keys(ENTITY_TYPE_LABELS) as EntityType[]).map(type => (
          <button
            key={type}
            className={styles.typeTab + (type === activeType ? ' ' + styles.typeTabActive : '')}
            onClick={() => { setActiveType(type); setSelectedId(null) }}
          >
            {ENTITY_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={styles.addBtn} onClick={handleAdd} title="Adicionar entidade">+</button>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 && (
          <p className={styles.empty}>Nenhuma {ENTITY_TYPE_LABELS[activeType].toLowerCase()}.</p>
        )}
        {filtered.map(entity => (
          <EntityRow
            key={entity.id}
            entity={entity}
            occurrences={occurrences[entity.id] ?? 0}
            isSelected={entity.id === selectedId}
            onSelect={() => setSelectedId(entity.id === selectedId ? null : entity.id)}
          />
        ))}
      </div>

      {selected && (
        <EntityDetail
          entity={selected}
          occurrences={occurrences[selected.id] ?? 0}
          onUpdate={onUpdate}
          onDelete={() => { onDelete(selected.id); setSelectedId(null) }}
          onMarkInText={() => onMarkInText(selected)}
        />
      )}
    </div>
  )
}

// ─── EntityRow ────────────────────────────────────────────────────────────────

function EntityRow({ entity, occurrences, isSelected, onSelect }: {
  entity: Entity
  occurrences: number
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={styles.row + (isSelected ? ' ' + styles.rowActive : '')}
      onClick={onSelect}
    >
      <span className={styles.dot} style={{ background: entity.color }} />
      <span className={styles.rowName}>{entity.name || <em>sem nome</em>}</span>
      {occurrences > 0 && (
        <span className={styles.occ} title="Ocorrências no texto">{occurrences}</span>
      )}
    </button>
  )
}

// ─── EntityDetail ─────────────────────────────────────────────────────────────

function EntityDetail({ entity, occurrences, onUpdate, onDelete, onMarkInText }: {
  entity: Entity
  occurrences: number
  onUpdate: (e: Entity) => void
  onDelete: () => void
  onMarkInText: () => void
}) {
  const change = (patch: Partial<Entity>) =>
    onUpdate({ ...entity, ...patch, modified: new Date().toISOString() })

  const setFieldValue = (key: string, value: string) =>
    change({
      fields: entity.fields.map(f => f.key === key ? { ...f, value } : f)
    })

  const addField = () =>
    change({
      fields: [...entity.fields, { key: `field_${Date.now()}`, label: 'Campo', value: '' }]
    })

  const removeField = (key: string) =>
    change({ fields: entity.fields.filter(f => f.key !== key) })

  const renameField = (key: string, label: string) =>
    change({ fields: entity.fields.map(f => f.key === key ? { ...f, label } : f) })

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.colorRow}>
          {ENTITY_COLORS.map(c => (
            <button
              key={c}
              className={styles.colorSwatch + (c === entity.color ? ' ' + styles.colorSwatchActive : '')}
              style={{ background: c }}
              onClick={() => change({ color: c })}
              title={c}
            />
          ))}
        </div>
        <div className={styles.detailActions}>
          <button
            className={styles.actionBtn}
            onClick={onMarkInText}
            title="Marcar trecho selecionado como esta entidade"
          >
            marcar no texto
          </button>
          <button
            className={styles.actionBtn + ' ' + styles.actionBtnDanger}
            onClick={() => { if (confirm(`Excluir "${entity.name}"?`)) onDelete() }}
            title="Excluir entidade"
          >
            excluir
          </button>
        </div>
      </div>

      <input
        className={styles.nameInput}
        value={entity.name}
        placeholder="Nome"
        onChange={e => change({ name: e.target.value })}
      />

      <input
        className={styles.aliasInput}
        value={entity.aliases.join(', ')}
        placeholder="Apelidos / nomes alternativos (separados por vírgula)"
        onChange={e =>
          change({ aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })
        }
      />

      <textarea
        className={styles.descInput}
        value={entity.description}
        placeholder="Descrição..."
        rows={3}
        onChange={e => change({ description: e.target.value })}
      />

      <div className={styles.fields}>
        {entity.fields.map(field => (
          <div key={field.key} className={styles.field}>
            <input
              className={styles.fieldLabel}
              value={field.label}
              onChange={e => renameField(field.key, e.target.value)}
            />
            <input
              className={styles.fieldValue}
              value={field.value}
              placeholder="..."
              onChange={e => setFieldValue(field.key, e.target.value)}
            />
            <button
              className={styles.fieldDel}
              onClick={() => removeField(field.key)}
              title="Remover campo"
            >×</button>
          </div>
        ))}
        <button className={styles.addFieldBtn} onClick={addField}>+ campo</button>
      </div>

      {occurrences > 0 && (
        <p className={styles.occLine}>
          {occurrences} ocorrência{occurrences !== 1 ? 's' : ''} no texto
        </p>
      )}
    </div>
  )
}

// ─── EntityPicker (used in FormattingBar) ────────────────────────────────────

interface EntityPickerProps {
  entities: Entity[]
  onPick: (entity: Entity) => void
  onClose: () => void
  style?: React.CSSProperties
}

export function EntityPicker({ entities, onPick, onClose, style }: EntityPickerProps) {
  const [search, setSearch] = useState('')
  const filtered = entities.filter(e =>
    search === '' || e.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.picker} style={style}>
      <div className={styles.pickerHeader}>
        <span>Marcar como entidade</span>
        <button className={styles.pickerClose} onMouseDown={e => { e.preventDefault(); onClose() }}>×</button>
      </div>
      <input
        className={styles.pickerSearch}
        autoFocus
        placeholder="Buscar entidade..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className={styles.pickerList}>
        {filtered.length === 0 && <p className={styles.empty}>Nenhuma entidade encontrada.</p>}
        {filtered.map(e => (
          <button
            key={e.id}
            className={styles.pickerItem}
            onMouseDown={ev => { ev.preventDefault(); onPick(e) }}
          >
            <span className={styles.dot} style={{ background: e.color }} />
            <span>{e.name}</span>
            <span className={styles.pickerType}>{ENTITY_TYPE_LABELS[e.type]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
