export type ChapterStatus = 'rascunho' | 'provisório' | 'final' | 'arquivado'
export type EntityType = 'characters' | 'places' | 'organizations' | 'other'
export type Theme = 'light' | 'dark'

export interface Chapter {
  id: string
  title: string
  status: ChapterStatus
  created: string
  modified: string
}

export interface EntityField {
  key: string
  label: string
  value: string
}

export interface Entity {
  id: string
  type: EntityType
  name: string
  aliases: string[]   // nomes alternativos usados no texto
  color: string       // cor do highlight no texto (hex)
  description: string
  fields: EntityField[]
  created: string
  modified: string
}

// Mantido para compatibilidade com project.json legado
export type EntityRef = Pick<Entity, 'id' | 'type' | 'name' | 'aliases'>

export interface TypographySettings {
  fontProse: string
  fontHeading: string
  lineHeight: number          // e.g. 1.8
  paragraphSpacing: number    // em units, e.g. 1.2
  columnWidth: number         // ch units, e.g. 70
  h1Size: number              // em units, e.g. 1.6
  h2Size: number
  h3Size: number
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontProse: 'Georgia, "Times New Roman", serif',
  fontHeading: 'inherit',
  lineHeight: 1.8,
  paragraphSpacing: 1.2,
  columnWidth: 70,
  h1Size: 1.6,
  h2Size: 1.3,
  h3Size: 1.1,
}

export interface ProjectSettings {
  autosaveInterval: number
  backupRetentionHours: number
  backupMaxSnapshots: number
  theme: Theme
  fontSize: number
  typography: TypographySettings
}

export interface Project {
  version: number
  title: string
  author: string
  chapters: Chapter[]
  entities: Entity[]
  settings: ProjectSettings
}

export interface LoadedProject {
  projectDir: string
  project: Project
  chaptersContent: Record<string, string>
}
