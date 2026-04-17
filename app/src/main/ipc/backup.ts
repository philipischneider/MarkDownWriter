import { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Project } from '../../shared/types'

export function registerBackupHandlers(ipcMain: IpcMain): void {
  // Criar snapshot de backup
  ipcMain.handle('backup:create', async (_, projectDir: string, project: Project) => {
    const backupDir = path.join(projectDir, '.backup')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const snapshotDir = path.join(backupDir, timestamp)

    fs.mkdirSync(snapshotDir, { recursive: true })

    // Copiar project.json
    fs.writeFileSync(path.join(snapshotDir, 'project.json'), JSON.stringify(project, null, 2))

    // Copiar todos os capítulos
    const chaptersDir = path.join(projectDir, 'chapters')
    if (fs.existsSync(chaptersDir)) {
      const snapshotChaptersDir = path.join(snapshotDir, 'chapters')
      fs.mkdirSync(snapshotChaptersDir, { recursive: true })
      for (const file of fs.readdirSync(chaptersDir)) {
        fs.copyFileSync(path.join(chaptersDir, file), path.join(snapshotChaptersDir, file))
      }
    }

    // Limpar snapshots antigos
    await pruneBackups(backupDir, project.settings.backupMaxSnapshots, project.settings.backupRetentionHours)

    return timestamp
  })

  // Listar backups disponíveis
  ipcMain.handle('backup:list', async (_, projectDir: string) => {
    const backupDir = path.join(projectDir, '.backup')
    if (!fs.existsSync(backupDir)) return []

    return fs.readdirSync(backupDir)
      .filter(name => fs.statSync(path.join(backupDir, name)).isDirectory())
      .sort()
      .reverse()
  })

  // Verificar se existe recovery pendente (backup mais recente que arquivo salvo)
  ipcMain.handle('backup:check-recovery', async (_, projectDir: string) => {
    const backupDir = path.join(projectDir, '.backup')
    const projectJsonPath = path.join(projectDir, 'project.json')

    if (!fs.existsSync(backupDir) || !fs.existsSync(projectJsonPath)) return null

    const snapshots = fs.readdirSync(backupDir)
      .filter(name => fs.statSync(path.join(backupDir, name)).isDirectory())
      .sort()
      .reverse()

    if (snapshots.length === 0) return null

    const latestSnapshot = snapshots[0]
    const snapshotTime = new Date(latestSnapshot.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z').replace(/(\d{4})-(\d{2})-(\d{2})T/, '$1-$2-$3T'))
    const savedTime = fs.statSync(projectJsonPath).mtime

    if (snapshotTime > savedTime) {
      return latestSnapshot
    }
    return null
  })

  // Restaurar backup
  ipcMain.handle('backup:restore', async (_, projectDir: string, snapshotName: string) => {
    const snapshotDir = path.join(projectDir, '.backup', snapshotName)
    if (!fs.existsSync(snapshotDir)) return false

    // Restaurar project.json
    const snapshotProjectJson = path.join(snapshotDir, 'project.json')
    if (fs.existsSync(snapshotProjectJson)) {
      fs.copyFileSync(snapshotProjectJson, path.join(projectDir, 'project.json'))
    }

    // Restaurar capítulos
    const snapshotChaptersDir = path.join(snapshotDir, 'chapters')
    if (fs.existsSync(snapshotChaptersDir)) {
      const chaptersDir = path.join(projectDir, 'chapters')
      fs.mkdirSync(chaptersDir, { recursive: true })
      for (const file of fs.readdirSync(snapshotChaptersDir)) {
        fs.copyFileSync(path.join(snapshotChaptersDir, file), path.join(chaptersDir, file))
      }
    }

    return true
  })
}

async function pruneBackups(backupDir: string, maxSnapshots: number, _retentionHours: number): Promise<void> {
  const entries = fs.readdirSync(backupDir)
    .filter(name => {
      const fullPath = path.join(backupDir, name)
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('deleted_')
    })
    .sort()
    .reverse()

  entries.forEach((name, index) => {
    if (index >= maxSnapshots) {
      fs.rmSync(path.join(backupDir, name), { recursive: true })
      return
    }
    // Manter pelo menos os últimos maxSnapshots, mesmo que antigos
  })
}
