import { useState, useEffect, useRef } from 'react'
import styles from './OllamaPanel.module.css'

type TaskType = 'rewrite' | 'continue' | 'analyze' | 'summarize' | 'custom'

const TASKS: { id: TaskType; label: string; buildPrompt: (sel: string, ctx: string) => string }[] = [
  {
    id: 'rewrite',
    label: 'Reescrever trecho',
    buildPrompt: (sel, _ctx) =>
      `Reescreva o trecho abaixo em português, mantendo o sentido e o estilo narrativo mas melhorando a clareza e o ritmo:\n\n"${sel}"\n\nApenas o trecho reescrito, sem explicações:`
  },
  {
    id: 'continue',
    label: 'Continuar texto',
    buildPrompt: (_sel, ctx) =>
      `Continue a narrativa abaixo em português, com o mesmo estilo e tom. Escreva apenas a continuação (2-3 parágrafos):\n\n${ctx}`
  },
  {
    id: 'analyze',
    label: 'Analisar consistência',
    buildPrompt: (sel, _ctx) =>
      `Analise o trecho abaixo e aponte inconsistências de estilo, repetições ou problemas narrativos:\n\n"${sel}"`
  },
  {
    id: 'summarize',
    label: 'Resumir',
    buildPrompt: (sel, _ctx) =>
      `Escreva um resumo conciso do trecho abaixo em português:\n\n"${sel}"`
  },
  {
    id: 'custom',
    label: 'Instrução livre',
    buildPrompt: (_sel, _ctx) => ''
  }
]

interface OllamaPanelProps {
  selectedText: string
  contextText: string   // last ~500 chars of the chapter
  onInsertText: (text: string) => void
}

export function OllamaPanel({ selectedText, contextText, onInsertText }: OllamaPanelProps) {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null)
  const [task, setTask] = useState<TaskType>('rewrite')
  const [customPrompt, setCustomPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.ollama.status().then(res => {
      setOllamaRunning(res.running)
      setModels(res.models)
      if (res.models.length > 0) setSelectedModel(res.models[0])
    })
  }, [])

  const handleGenerate = async () => {
    if (!selectedModel || generating) return
    const taskDef = TASKS.find(t => t.id === task)!
    const prompt = task === 'custom'
      ? customPrompt
      : taskDef.buildPrompt(selectedText, contextText)

    if (!prompt.trim()) return

    setOutput('')
    setGenerating(true)

    window.api.ollama.removeChunkListener()
    window.api.ollama.onChunk(chunk => {
      setOutput(prev => prev + chunk)
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight
      }
    })
    window.api.ollama.onDone(() => setGenerating(false))
    window.api.ollama.onError(msg => {
      setOutput(`Erro: ${msg}`)
      setGenerating(false)
    })

    await window.api.ollama.generate(selectedModel, prompt)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Sugestões LLM</span>
        {ollamaRunning === true && <span className={styles.online}>● online</span>}
        {ollamaRunning === false && <span className={styles.offline}>● offline</span>}
      </div>

      {ollamaRunning === false && (
        <div className={styles.notice}>
          Ollama não está em execução.<br />
          Inicie com <code>ollama serve</code> no terminal.
        </div>
      )}

      {ollamaRunning === true && models.length === 0 && (
        <div className={styles.notice}>
          Nenhum modelo encontrado.<br />
          Instale com <code>ollama pull llama3.1</code>
        </div>
      )}

      {ollamaRunning === true && models.length > 0 && (
        <>
          <div className={styles.row}>
            <label className={styles.label}>Modelo</label>
            <select
              className={styles.select}
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className={styles.taskGrid}>
            {TASKS.map(t => (
              <button
                key={t.id}
                className={styles.taskBtn + (t.id === task ? ' ' + styles.taskBtnActive : '')}
                onClick={() => setTask(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {task === 'custom' && (
            <textarea
              className={styles.customInput}
              rows={3}
              placeholder="Digite a instrução para o modelo..."
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
            />
          )}

          {(task === 'rewrite' || task === 'analyze' || task === 'summarize') && !selectedText && (
            <p className={styles.hint}>Selecione texto no editor para usar esta tarefa.</p>
          )}

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating || (
              (task !== 'continue' && task !== 'custom') && !selectedText
            ) || (task === 'custom' && !customPrompt.trim())}
          >
            {generating ? 'Gerando…' : 'Gerar'}
          </button>

          {output && (
            <div className={styles.outputSection}>
              <div className={styles.outputHeader}>
                <span className={styles.outputTitle}>Resultado</span>
                <button
                  className={styles.insertBtn}
                  onClick={() => onInsertText(output)}
                  title="Inserir no editor na posição do cursor"
                >
                  inserir no texto
                </button>
                <button
                  className={styles.copyBtn}
                  onClick={() => navigator.clipboard.writeText(output)}
                  title="Copiar"
                >
                  copiar
                </button>
              </div>
              <div ref={outputRef} className={styles.output}>
                {output}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
