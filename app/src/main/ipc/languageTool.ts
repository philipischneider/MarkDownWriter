import { IpcMain, dialog, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'

const LT_PORT = 8081
const CONFIG_PATH = () => path.join(app.getPath('userData'), 'lt-config.json')

let ltProcess: ChildProcess | null = null

interface LtConfig {
  jarPath: string
}

function readConfig(): LtConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf-8')) as LtConfig
  } catch {
    return null
  }
}

function writeConfig(config: LtConfig): void {
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(config, null, 2), 'utf-8')
}

function checkRunning(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${LT_PORT}/v2/languages`, res => {
      resolve(res.statusCode === 200)
      res.resume()
    })
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
    req.on('error', () => resolve(false))
  })
}

function spawnServer(jarPath: string): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    if (!fs.existsSync(jarPath)) {
      resolve({ success: false, error: `JAR não encontrado: ${jarPath}` })
      return
    }

    let settled = false
    const done = (result: { success: boolean; error?: string }) => {
      if (!settled) { settled = true; resolve(result) }
    }

    // stdio: 'ignore' evita que buffers não consumidos travem o processo filho
    ltProcess = spawn('java', ['-jar', jarPath, '--port', String(LT_PORT)], {
      detached: false,
      stdio: 'ignore'
    })

    ltProcess.on('error', err => {
      ltProcess = null
      done({ success: false, error: `Java não encontrado ou falhou: ${err.message}` })
    })

    ltProcess.on('exit', code => {
      ltProcess = null
      done({ success: false, error: `Processo encerrou com código ${code} antes de responder` })
    })

    // Aguarda até 30s para o servidor responder
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (await checkRunning()) {
        clearInterval(poll)
        done({ success: true })
      } else if (attempts >= 60) {
        clearInterval(poll)
        done({ success: false, error: 'Servidor não respondeu em 30 segundos' })
      }
    }, 500)
  })
}

export function stopLtServer(): void {
  if (ltProcess) {
    ltProcess.kill()
    ltProcess = null
  }
}

export async function autoStartLt(): Promise<void> {
  const config = readConfig()
  if (!config?.jarPath) return
  if (await checkRunning()) return  // already running (user started manually)
  await spawnServer(config.jarPath)
}

export function registerLanguageToolHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('lt:status', async () => {
    const running = await checkRunning()
    const config = readConfig()
    return { running, jarPath: config?.jarPath ?? null, managed: ltProcess !== null }
  })

  ipcMain.handle('lt:start', async () => {
    if (await checkRunning()) return { success: true }
    const config = readConfig()
    if (!config?.jarPath) return { success: false, error: 'Caminho do JAR não configurado' }
    return spawnServer(config.jarPath)
  })

  ipcMain.handle('lt:stop', () => {
    stopLtServer()
    return { success: true }
  })

  ipcMain.handle('lt:browse-jar', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar JAR do LanguageTool Server',
      filters: [{ name: 'Java Archive', extensions: ['jar'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const jarPath = result.filePaths[0]
    writeConfig({ jarPath })
    return jarPath
  })

  ipcMain.handle('lt:get-jar-path', () => readConfig()?.jarPath ?? null)

  ipcMain.handle('lt:set-jar-path', (_e, jarPath: string) => {
    writeConfig({ jarPath })
    return { success: true }
  })
}
