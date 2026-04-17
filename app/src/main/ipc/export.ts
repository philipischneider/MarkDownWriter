import { IpcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type ExportFormat = 'pdf' | 'docx' | 'epub' | 'html' | 'odt'

interface ExportOptions {
  format: ExportFormat
  projectDir: string
  projectTitle: string
  author: string
  chapterIds: string[]   // ordered list of chapter IDs to include
}

const FORMAT_EXT: Record<ExportFormat, string> = {
  pdf:  'pdf',
  docx: 'docx',
  epub: 'epub',
  html: 'html',
  odt:  'odt'
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf:  'PDF',
  docx: 'Word (DOCX)',
  epub: 'EPUB',
  html: 'HTML',
  odt:  'LibreOffice (ODT)'
}

function findPandoc(): string {
  // Common install locations on Windows
  const candidates = [
    'pandoc',
    'C:\\Program Files\\Pandoc\\pandoc.exe',
    'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
  ]
  for (const c of candidates) {
    try {
      // Just return the first one; execFile will fail if not found
      if (c === 'pandoc' || fs.existsSync(c)) return c
    } catch { /* */ }
  }
  return 'pandoc'
}

export function registerExportHandlers(ipcMain: IpcMain): void {
  // Check if pandoc is available
  ipcMain.handle('export:check-pandoc', async () => {
    try {
      const { stdout } = await execFileAsync(findPandoc(), ['--version'])
      const match = stdout.match(/pandoc\s+([\d.]+)/)
      return { available: true, version: match?.[1] ?? 'unknown' }
    } catch {
      return { available: false, version: null }
    }
  })

  // Export project to file
  ipcMain.handle('export:run', async (_, opts: ExportOptions) => {
    const { format, projectDir, projectTitle, author, chapterIds } = opts
    const ext = FORMAT_EXT[format]
    const label = FORMAT_LABEL[format]

    // Ask user where to save
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: `Exportar como ${label}`,
      defaultPath: path.join(projectDir, `${projectTitle}.${ext}`),
      filters: [{ name: label, extensions: [ext] }]
    })

    if (canceled || !filePath) return { success: false, reason: 'canceled' }

    // Concatenate chapter markdown files into one temp file
    const tempMd = path.join(projectDir, '.export_temp.md')

    try {
      const parts: string[] = []

      // YAML front matter for epub/pdf metadata
      parts.push(`---
title: "${projectTitle.replace(/"/g, '\\"')}"
author: "${author.replace(/"/g, '\\"')}"
lang: pt-BR
---
`)

      for (const id of chapterIds) {
        const mdPath = path.join(projectDir, 'chapters', `${id}.md`)
        if (fs.existsSync(mdPath)) {
          const content = fs.readFileSync(mdPath, 'utf-8').trim()
          if (content) {
            parts.push(content)
            parts.push('\n\n')
          }
        }
      }

      fs.writeFileSync(tempMd, parts.join('\n'), 'utf-8')

      // Build pandoc args
      const args: string[] = [
        tempMd,
        '-o', filePath,
        '--standalone',
        '--from', 'markdown+raw_html',
        '-V', 'lang=pt-BR',
      ]

      if (format === 'pdf') {
        // Use HTML intermediary for better Portuguese support
        args.push('--pdf-engine=wkhtmltopdf')
      }

      if (format === 'epub') {
        args.push('--toc', '--toc-depth=1')
      }

      await execFileAsync(findPandoc(), args)
      return { success: true, filePath }
    } catch (err: unknown) {
      // Retry PDF with different engine if wkhtmltopdf fails
      if (format === 'pdf') {
        try {
          const fallbackArgs = [tempMd, '-o', filePath, '--standalone', '--from', 'markdown+raw_html']
          await execFileAsync(findPandoc(), fallbackArgs)
          return { success: true, filePath }
        } catch { /* ignore */ }
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, reason: msg }
    } finally {
      if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd)
    }
  })
}
