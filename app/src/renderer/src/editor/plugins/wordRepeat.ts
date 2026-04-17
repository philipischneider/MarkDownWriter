import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as PmNode } from 'prosemirror-model'

const pluginKey = new PluginKey('wordRepeat')

// Palavras comuns do português que não devem ser marcadas como repetição
const STOP_WORDS = new Set([
  'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
  'se','na','por','mais','as','dos','como','mas','ao','ele','das','à','seu',
  'sua','ou','quando','muito','nos','já','eu','também','só','pelo','pela',
  'até','isso','ela','entre','depois','sem','mesmo','aos','seus','quem',
  'nas','me','esse','eles','estava','depois','era','tinha','foi','ser','ter',
  'tem','são','está','foram','há','não','nem','lhe','nós','elas','lhes',
  'meu','minha','nosso','nossa','este','esta','estes','estas','aquele',
  'aquela','isso','aquilo','tudo','nada','algo','alguém','ninguém','cada',
  'todo','toda','todos','todas','outro','outra','outros','outras','tal',
  'tanto','tanta','tantos','tantas','que','qual','quais','onde','quando',
  'como','porque','porém','então','assim','pois','logo','todavia','contudo',
  'the','of','and','to','a','in','is','it','you','that','he','was','for',
  'on','are','with','as','his','they','be','at','one','have','this','from',
])

const WINDOW_SIZE = 50 // palavras de distância para considerar repetição
const MIN_WORD_LEN = 4  // ignorar palavras muito curtas

interface WordOccurrence {
  word: string
  from: number
  to: number
}

function extractWords(doc: PmNode): WordOccurrence[] {
  const words: WordOccurrence[] = []
  const regex = /\b[\wáéíóúàèìòùâêîôûãõçäëïöüñÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇÄËÏÖÜÑ]+\b/g

  doc.descendants((node, pos) => {
    if (!node.isText) return
    const text = node.text!
    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0]
      if (raw.length < MIN_WORD_LEN) continue
      const lower = raw.toLowerCase()
      if (STOP_WORDS.has(lower)) continue
      words.push({ word: lower, from: pos + match.index, to: pos + match.index + raw.length })
    }
  })

  return words
}

function buildDecorations(doc: PmNode): DecorationSet {
  const words = extractWords(doc)
  const repeated = new Set<number>()

  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length && j - i <= WINDOW_SIZE; j++) {
      if (words[j].word === words[i].word) {
        repeated.add(i)
        repeated.add(j)
      }
    }
  }

  const decos: Decoration[] = []
  for (const idx of repeated) {
    const w = words[idx]
    decos.push(Decoration.inline(w.from, w.to, { class: 'word-repeat' }))
  }

  return DecorationSet.create(doc, decos)
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function wordRepeatPlugin() {
  return new Plugin({
    key: pluginKey,
    state: {
      init(_, { doc }) {
        return buildDecorations(doc)
      },
      apply(tr, old) {
        if (!tr.docChanged) return old
        // Mapa as decorações existentes e agenda recálculo
        return old.map(tr.mapping, tr.doc)
      }
    },
    view() {
      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              const decos = buildDecorations(view.state.doc)
              const { tr } = view.state
              tr.setMeta(pluginKey, decos)
              view.dispatch(tr)
            }, 800)
          }
        }
      }
    },
    props: {
      decorations(state) {
        const meta = this.getState(state)
        if (meta && 'find' in meta) return meta as DecorationSet
        return DecorationSet.empty
      }
    }
  })
}

export function countWords(text: string): number {
  if (!text) return 0
  // Remove markdown syntax antes de contar
  const clean = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
  if (!clean) return 0
  return clean.split(/\s+/).filter(w => w.length > 0).length
}
