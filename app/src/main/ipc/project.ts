import { IpcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { Project, Chapter } from '../../shared/types'

const RECENTS_PATH = () => path.join(app.getPath('userData'), 'recent-projects.json')

function loadRecents(): Array<{ title: string; projectJsonPath: string; lastOpened: string }> {
  try {
    if (fs.existsSync(RECENTS_PATH())) {
      return JSON.parse(fs.readFileSync(RECENTS_PATH(), 'utf-8'))
    }
  } catch { /* ignora */ }
  return []
}

function saveToRecents(title: string, projectJsonPath: string): void {
  try {
    const recents = loadRecents().filter(r => r.projectJsonPath !== projectJsonPath)
    recents.unshift({ title, projectJsonPath, lastOpened: new Date().toISOString() })
    fs.writeFileSync(RECENTS_PATH(), JSON.stringify(recents.slice(0, 10), null, 2))
  } catch { /* ignora */ }
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  // Criar novo projeto
  ipcMain.handle('project:create', async (_, title: string, targetDir: string) => {
    const safeName = title.trim().replace(/[\\/:*?"<>|]/g, '').trim() || 'Projeto'
    const projectDir = path.join(targetDir, safeName)
    const chaptersDir = path.join(projectDir, 'chapters')
    const entitiesDir = path.join(projectDir, 'entities', 'characters')
    const placesDir = path.join(projectDir, 'entities', 'places')
    const orgsDir = path.join(projectDir, 'entities', 'organizations')
    const backupDir = path.join(projectDir, '.backup')

    fs.mkdirSync(chaptersDir, { recursive: true })
    fs.mkdirSync(entitiesDir, { recursive: true })
    fs.mkdirSync(placesDir, { recursive: true })
    fs.mkdirSync(orgsDir, { recursive: true })
    fs.mkdirSync(backupDir, { recursive: true })

    const firstChapterId = uuidv4().slice(0, 8)
    const now = new Date().toISOString()

    const project: Project = {
      version: 1,
      title,
      author: '',
      chapters: [
        {
          id: firstChapterId,
          title: 'Capítulo 1',
          status: 'rascunho',
          created: now,
          modified: now
        }
      ],
      entities: [],
      settings: {
        autosaveInterval: 30,
        backupRetentionHours: 24,
        backupMaxSnapshots: 20,
        theme: 'dark',
        fontSize: 18
      }
    }

    const projectJsonPath = path.join(projectDir, 'project.json')
    fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2))
    fs.writeFileSync(path.join(chaptersDir, `${firstChapterId}.md`), '')
    saveToRecents(title, projectJsonPath)

    return { projectDir, project, projectJsonPath }
  })

  // Abrir projeto existente
  ipcMain.handle('project:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Projeto MarkdownWriter', extensions: ['json'] }],
      title: 'Abrir projeto — selecione o arquivo project.json'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const projectJsonPath = result.filePaths[0]
    const loaded = loadProject(projectJsonPath)
    if (loaded) saveToRecents(loaded.project.title, projectJsonPath)
    return loaded
  })

  ipcMain.handle('project:load', async (_, projectJsonPath: string) => {
    const loaded = loadProject(projectJsonPath)
    if (loaded) saveToRecents(loaded.project.title, projectJsonPath)
    return loaded
  })

  // Listar projetos recentes
  ipcMain.handle('project:recents', async () => {
    return loadRecents().filter(r => fs.existsSync(r.projectJsonPath))
  })

  // Salvar project.json
  ipcMain.handle('project:save-meta', async (_, projectDir: string, project: Project) => {
    const projectJsonPath = path.join(projectDir, 'project.json')
    fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2))
    return true
  })

  // Ler conteúdo de um capítulo
  ipcMain.handle('chapter:read', async (_, projectDir: string, chapterId: string) => {
    const filePath = path.join(projectDir, 'chapters', `${chapterId}.md`)
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  })

  // Salvar conteúdo de um capítulo
  ipcMain.handle('chapter:write', async (_, projectDir: string, chapterId: string, content: string) => {
    const filePath = path.join(projectDir, 'chapters', `${chapterId}.md`)
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  // Criar capítulo
  ipcMain.handle('chapter:create', async (_, projectDir: string) => {
    const id = uuidv4().slice(0, 8)
    const filePath = path.join(projectDir, 'chapters', `${id}.md`)
    fs.writeFileSync(filePath, '', 'utf-8')
    const now = new Date().toISOString()
    const chapter: Chapter = {
      id,
      title: 'Novo Capítulo',
      status: 'rascunho',
      created: now,
      modified: now
    }
    return chapter
  })

  // Deletar capítulo (move para backup antes)
  ipcMain.handle('chapter:delete', async (_, projectDir: string, chapterId: string) => {
    const filePath = path.join(projectDir, 'chapters', `${chapterId}.md`)
    if (!fs.existsSync(filePath)) return true
    const backupPath = path.join(projectDir, '.backup', `deleted_${chapterId}_${Date.now()}.md`)
    fs.copyFileSync(filePath, backupPath)
    fs.unlinkSync(filePath)
    return true
  })

  // Ler entidade
  ipcMain.handle('entity:read', async (_, projectDir: string, entityType: string, entityId: string) => {
    const filePath = path.join(projectDir, 'entities', entityType, `${entityId}.md`)
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  })

  // Salvar entidade
  ipcMain.handle('entity:write', async (_, projectDir: string, entityType: string, entityId: string, content: string) => {
    const dirPath = path.join(projectDir, 'entities', entityType)
    fs.mkdirSync(dirPath, { recursive: true })
    fs.writeFileSync(path.join(dirPath, `${entityId}.md`), content, 'utf-8')
    return true
  })

  // Diálogo para escolher diretório de novo projeto
  ipcMain.handle('dialog:choose-dir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Escolha onde salvar o projeto'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

function loadProject(projectJsonPath: string): { projectDir: string; project: Project } | null {
  try {
    const raw = fs.readFileSync(projectJsonPath, 'utf-8')
    const project = JSON.parse(raw) as Project
    const projectDir = path.dirname(projectJsonPath)
    return { projectDir, project }
  } catch {
    return null
  }
}
