import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Projeto
  project: {
    create: (title: string, targetDir: string) =>
      ipcRenderer.invoke('project:create', title, targetDir),
    openDialog: () =>
      ipcRenderer.invoke('project:open-dialog'),
    load: (projectJsonPath: string) =>
      ipcRenderer.invoke('project:load', projectJsonPath),
    saveMeta: (projectDir: string, project: unknown) =>
      ipcRenderer.invoke('project:save-meta', projectDir, project),
    recents: () =>
      ipcRenderer.invoke('project:recents'),
  },

  // Capítulos
  chapter: {
    read: (projectDir: string, chapterId: string) =>
      ipcRenderer.invoke('chapter:read', projectDir, chapterId),
    write: (projectDir: string, chapterId: string, content: string) =>
      ipcRenderer.invoke('chapter:write', projectDir, chapterId, content),
    create: (projectDir: string) =>
      ipcRenderer.invoke('chapter:create', projectDir),
    delete: (projectDir: string, chapterId: string) =>
      ipcRenderer.invoke('chapter:delete', projectDir, chapterId),
  },

  // Entidades
  entity: {
    read: (projectDir: string, entityType: string, entityId: string) =>
      ipcRenderer.invoke('entity:read', projectDir, entityType, entityId),
    write: (projectDir: string, entityType: string, entityId: string, content: string) =>
      ipcRenderer.invoke('entity:write', projectDir, entityType, entityId, content),
  },

  // Backup
  backup: {
    create: (projectDir: string, project: unknown) =>
      ipcRenderer.invoke('backup:create', projectDir, project),
    list: (projectDir: string) =>
      ipcRenderer.invoke('backup:list', projectDir),
    checkRecovery: (projectDir: string) =>
      ipcRenderer.invoke('backup:check-recovery', projectDir),
    restore: (projectDir: string, snapshotName: string) =>
      ipcRenderer.invoke('backup:restore', projectDir, snapshotName),
  },

  // Diálogos
  dialog: {
    chooseDir: () =>
      ipcRenderer.invoke('dialog:choose-dir'),
  },

  // Ollama LLM
  ollama: {
    status: () =>
      ipcRenderer.invoke('ollama:status') as Promise<{ running: boolean; models: string[] }>,
    generate: (model: string, prompt: string) =>
      ipcRenderer.invoke('ollama:generate', model, prompt) as Promise<{ success: boolean; error?: string }>,
    onChunk: (cb: (text: string) => void) => {
      ipcRenderer.on('ollama:chunk', (_e, t) => cb(t))
    },
    onDone: (cb: () => void) => {
      ipcRenderer.once('ollama:done', cb)
    },
    onError: (cb: (msg: string) => void) => {
      ipcRenderer.once('ollama:error', (_e, m) => cb(m))
    },
    removeChunkListener: () => {
      ipcRenderer.removeAllListeners('ollama:chunk')
    }
  },

  // Exportação Pandoc
  export: {
    checkPandoc: () =>
      ipcRenderer.invoke('export:check-pandoc') as Promise<{ available: boolean; version: string | null }>,
    run: (opts: {
      format: string
      projectDir: string
      projectTitle: string
      author: string
      chapterIds: string[]
    }) => ipcRenderer.invoke('export:run', opts) as Promise<{ success: boolean; filePath?: string; reason?: string }>
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
