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

export interface EntityRef {
  id: string
  type: EntityType
  name: string
  aliases: string[]
}

export interface ProjectSettings {
  autosaveInterval: number      // segundos
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
  entities: EntityRef[]
  settings: ProjectSettings
}

export interface LoadedProject {
  projectDir: string
  project: Project
  chaptersContent: Record<string, string>
}
