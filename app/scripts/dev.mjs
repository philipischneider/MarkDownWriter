// Launcher de desenvolvimento que remove ELECTRON_RUN_AS_NODE do ambiente
// antes de iniciar o electron-vite, garantindo que o processo Electron
// não herde essa variável do VSCode.
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proc = spawn('cmd.exe', ['/c', 'electron-vite', 'dev'], {
  cwd: root,
  env,
  stdio: 'inherit'
})

proc.on('exit', (code) => process.exit(code ?? 0))
proc.on('error', (err) => {
  console.error('Erro ao iniciar electron-vite:', err.message)
  process.exit(1)
})
