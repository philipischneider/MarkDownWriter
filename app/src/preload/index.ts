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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
