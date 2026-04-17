import { IpcMain } from 'electron'
import https from 'https'
import http from 'http'

const OLLAMA_BASE = 'http://127.0.0.1:11434'

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function httpPost(url: string, body: string, onChunk: (text: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }
    const req = http.request(options, res => {
      res.on('data', chunk => {
        const lines = chunk.toString('utf-8').split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            if (obj.response) onChunk(obj.response)
            if (obj.done) resolve()
          } catch { /* skip malformed */ }
        }
      })
      res.on('end', resolve)
      res.on('error', reject)
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export function registerOllamaHandlers(ipcMain: IpcMain): void {
  // Check if Ollama is running and list available models
  ipcMain.handle('ollama:status', async () => {
    try {
      const raw = await httpGet(`${OLLAMA_BASE}/api/tags`)
      const data = JSON.parse(raw) as { models?: { name: string }[] }
      const models = (data.models ?? []).map(m => m.name)
      return { running: true, models }
    } catch {
      return { running: false, models: [] }
    }
  })

  // Streaming generate — sends chunks via IPC event
  ipcMain.handle('ollama:generate', async (event, model: string, prompt: string) => {
    const body = JSON.stringify({
      model,
      prompt,
      stream: true,
      options: { temperature: 0.8, num_predict: 400 }
    })

    try {
      await httpPost(`${OLLAMA_BASE}/api/generate`, body, chunk => {
        event.sender.send('ollama:chunk', chunk)
      })
      event.sender.send('ollama:done')
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      event.sender.send('ollama:error', msg)
      return { success: false, error: msg }
    }
  })
}
