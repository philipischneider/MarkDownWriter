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

export interface ProjectSettings {
  autosaveInterval: number
  backupRetentionHours: number
  backupMaxSnapshots: number
  theme: Theme
  fontSize: number
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
