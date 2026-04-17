# Plano de Implementação — MarkdownWriter

Editor de texto literário em Markdown com WYSIWYG, gestão narrativa e integração com LLM local.

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Shell do app | **Electron** | Acesso nativo ao filesystem, processos externos (git, pandoc, ollama), sem restrições de browser |
| Frontend | **React + TypeScript** | Componentização, tipagem, ecossistema rico |
| Editor | **ProseMirror** | Modelo de documento estruturado, extensível, base de apps como Notion e Linear |
| Bundler | **Vite** | Build rápido, HMR no desenvolvimento |
| Estilos | **CSS Modules + CSS variables** | Temas via variáveis, sem overhead de biblioteca de UI |
| Git | **isomorphic-git** ou **git CLI via child_process** | Controle de versão integrado |
| Exportação | **Pandoc** (spawn) | Suporte a PDF, DOCX, EPUB, HTML |
| LLM | **Ollama** (API REST local) | Roda localmente, suporta GPU (RTX 5070 Ti), modelos como Llama 3.1 8B |
| Correção gramatical | **LanguageTool** (servidor local) | PT-BR nativo, detecção de repetições, regras morfológicas |

---

## Modelo de Dados do Projeto

### Estrutura de diretórios

```
meu-livro/
├── chapters/
│   ├── <uuid>.md          # conteúdo do capítulo em Markdown
│   └── ...
├── entities/
│   ├── characters/
│   │   └── <uuid>.md      # ficha de personagem
│   ├── places/
│   │   └── <uuid>.md      # ficha de lugar
│   └── organizations/
│       └── <uuid>.md
├── .backup/
│   ├── 2026-04-15T14-30-00/   # snapshot por timestamp
│   │   └── ...
│   └── ...
└── project.json
```

### project.json

```json
{
  "version": 1,
  "title": "Título do Livro",
  "author": "Nome do Autor",
  "chapters": [
    {
      "id": "b71de",
      "title": "A Chegada",
      "status": "final",
      "created": "2026-04-15T10:00:00Z",
      "modified": "2026-04-15T12:00:00Z"
    }
  ],
  "entities": [
    { "id": "e9a3c", "type": "character", "name": "Herói", "aliases": ["o herói", "ele"] }
  ],
  "settings": {
    "autosaveInterval": 30,
    "backupRetentionHours": 24,
    "backupMaxSnapshots": 20,
    "theme": "dark",
    "fontSize": 16
  }
}
```

---

## Modelo de Documento no Editor

O livro inteiro é carregado como **um único documento ProseMirror** com capítulos como nós de nível superior.

### Schema ProseMirror

```
doc
└── chapter (N vezes)
    ├── chapter_header     — título do capítulo (não editável inline; edit via painel)
    └── block+             — parágrafos, títulos, listas, etc.
        ├── paragraph
        ├── heading
        ├── blockquote
        ├── footnote
        ├── comment        — anotação fora do texto final
        └── alt_version    — contém dois filhos: version_a e version_b
```

### Nós customizados relevantes

- **`chapter`**: nó de nível superior com atributo `id` (referência ao arquivo .md) e `status`
- **`entity_ref`**: inline node que marca um termo como referência a uma entidade (personagem, lugar, etc.)
- **`comment`**: bloco de anotação que não aparece na exportação
- **`alt_version`**: bloco com duas versões alternativas, com toggle de qual está ativa

---

## Fases de Implementação

### Fase 1 — Fundação do Editor

**Objetivo:** App funcional com edição básica, persistência e UX core.

Tarefas:
- [ ] Inicializar projeto com Electron + Vite + React + TypeScript
- [ ] Configurar estrutura de diretórios e build pipeline (main process + renderer)
- [ ] Implementar tela de boas-vindas: criar novo projeto / abrir projeto existente
- [ ] Implementar leitura e escrita de `project.json`
- [ ] Implementar carregamento de capítulos em um único documento ProseMirror
- [ ] Configurar schema ProseMirror com nó `chapter`
- [ ] Renderização WYSIWYG de Markdown (negrito, itálico, títulos, listas, blockquote)
- [ ] Undo/redo (nativo ProseMirror, exposto via Ctrl+Z / Ctrl+Y)
- [ ] Separador visual entre capítulos (decoração ProseMirror, não editável)
- [ ] Serialização de cada capítulo de volta para arquivo .md no save
- [ ] Auto-save a cada 30s e ao detectar pausa na digitação (debounce 2s)
- [ ] Backup automático em `.backup/` com controle de retenção
- [ ] Crash recovery: detectar snapshot mais recente que arquivo salvo e oferecer restauração
- [ ] Temas claro e escuro via CSS variables
- [ ] Controle de tamanho de fonte (slider ou +/-)
- [ ] Atalhos de teclado básicos

**Entregável:** Editor que abre/cria projetos, edita capítulos em scroll contínuo, salva e recupera.

---

### Fase 2 — Gestão de Capítulos e Anotações

**Objetivo:** Painel de seções operacional e metadados de escrita.

Tarefas:
- [ ] Painel lateral de seções: lista de capítulos com título e status
- [ ] Drag-and-drop para reordenação (atualiza `project.json`, não renomeia arquivos)
- [ ] Criar capítulo (insere novo nó `chapter` no final ou após seleção)
- [ ] Renomear capítulo (edição do título via painel)
- [ ] Dividir capítulo na posição do cursor
- [ ] Mesclar capítulo com anterior/seguinte
- [ ] Excluir capítulo (com confirmação, move para .backup antes de deletar)
- [ ] Status de capítulo: rascunho / provisório / final / arquivado (visual no painel e no separador)
- [ ] Notas de rodapé (nó inline com popup de visualização)
- [ ] Comentários/anotações (nó de bloco, visível no editor mas excluído na exportação)
- [ ] Versões alternativas de parágrafo (nó `alt_version` com toggle A/B)
- [ ] Scroll automático ao clicar em capítulo no painel

**Entregável:** Estrutura narrativa completa gerenciável sem tocar em nomes de arquivo.

---

### Fase 3 — Correção e Monitoramento de Texto

**Objetivo:** Suporte a qualidade do texto em PT-BR.

Tarefas:
- [ ] Integrar LanguageTool como servidor local (iniciar processo ao abrir o app)
- [ ] Sublinhado de erros ortográficos e gramaticais via decorações ProseMirror
- [ ] Tooltip ao passar o mouse sobre erro com sugestões de correção
- [ ] Aceitar sugestão com clique
- [ ] Ignorar regra / adicionar palavra ao dicionário pessoal
- [ ] Detector de repetições com morfologia (usando LanguageTool ou stemmer PT-BR próprio)
- [ ] Destaque visual de termos repetidos em excesso no parágrafo atual e no contexto próximo
- [ ] Painel de estatísticas: contagem de palavras, caracteres, tempo estimado de leitura por capítulo e total

**Entregável:** Assistência de qualidade textual sem sair do editor.

---

### Fase 4 — Entidades e Wiki Integrada

**Objetivo:** Gestão de personagens, lugares e referências dentro do app.

Tarefas:
- [ ] Painel de entidades: lista por tipo (personagem, lugar, organização, outro)
- [ ] Criar / editar / excluir entidade (ficha em Markdown editável no painel)
- [ ] Campos estruturados da ficha: nome, aliases, descrição, notas livres
- [ ] Marcar termo no texto como referência a entidade (nó `entity_ref`)
- [ ] Ao clicar em `entity_ref` no texto: abre ficha da entidade no painel lateral
- [ ] Painel de ocorrências: para cada entidade, lista todos os capítulos/parágrafos onde aparece
- [ ] Substituição semântica: substituir todas as ocorrências de uma entidade (considerando aliases) por novo termo
- [ ] Links de referência rápida: digitar `[[Nome]]` no texto para criar `entity_ref` com autocomplete
- [ ] Importação de ficha: importar arquivo .docx via Pandoc → Markdown e criar entidade a partir dele
- [ ] Busca global dentro das fichas de entidades

**Entregável:** Wiki narrativa integrada, sem precisar sair do editor para consultar informações.

---

### Fase 5 — Git, GitHub e Exportação

**Objetivo:** Controle de versão e publicação em múltiplos formatos.

Tarefas:
- [ ] Inicializar repositório git no diretório do projeto
- [ ] Commit manual com mensagem customizável
- [ ] Commit automático opcional (ao salvar, com mensagem gerada)
- [ ] Push / pull para repositório GitHub remoto
- [ ] Visualização de histórico de commits com opção de restaurar versão
- [ ] Autenticação GitHub via token pessoal (armazenado no keychain do OS)
- [ ] Exportação via Pandoc: PDF, DOCX, EPUB, HTML, ODT
- [ ] Perfis de exportação (ex: "manuscrito A4", "ebook", "revisão")
- [ ] Excluir comentários e anotações da exportação
- [ ] Escolher quais capítulos incluir na exportação (ex: apenas capítulos com status "final")

**Entregável:** Controle de versão e publicação sem ferramentas externas.

---

### Fase 6 — LLM Local e Sugestões em Tempo Real

**Objetivo:** Assistente de escrita rodando localmente com GPU.

Tarefas:
- [ ] Verificar se Ollama está instalado e em execução ao iniciar o app
- [ ] Seleção de modelo (Llama 3.1 8B, Mistral 7B, etc.) nas configurações
- [ ] Ao pausar a digitação por ~1.5s: enviar parágrafo atual ao modelo com prompt de revisão literária em PT-BR
- [ ] Exibir sugestões em painel lateral não intrusivo (não bloqueia edição)
- [ ] Aceitar sugestão completa ou parcialmente (seleção de trecho)
- [ ] Modo de "completar frase": acionado por atalho, sugere continuação do parágrafo
- [ ] Histórico de sugestões por sessão
- [ ] Desligar LLM temporariamente (toggle) sem fechar o app
- [ ] Configuração de prompt de sistema (tom, gênero literário, instruções específicas)

**Entregável:** Assistente literário local com GPU, sem custo por token.

---

## Decisões de Arquitetura

### Comunicação Main ↔ Renderer

Usar **IPC do Electron** com canais tipados:

```typescript
// Exemplos de canais IPC
'project:open'        // abre projeto
'project:save'        // força save
'chapter:create'      // cria capítulo
'chapter:delete'      // deleta capítulo
'backup:list'         // lista backups disponíveis
'backup:restore'      // restaura backup
'git:commit'          // faz commit
'ollama:suggest'      // solicita sugestão ao LLM
'languagetool:check'  // verifica trecho de texto
'export:run'          // executa exportação via Pandoc
```

### Serialização Markdown

ProseMirror trabalha com um modelo de documento interno. A serialização para/de Markdown usa adaptadores customizados:

- Nós padrão (parágrafos, títulos, etc.) → Markdown padrão
- `entity_ref` → `[nome](entity://uuid)` (link customizado, ignorado pelo Pandoc na exportação padrão)
- `comment` → bloco HTML comentado `<!-- comment: ... -->` (filtrado na exportação)
- `alt_version` → YAML front matter de variante (apenas versão ativa é exportada)
- `footnote` → `[^1]` (footnote padrão Markdown)

### Persistência de Estado da UI

Estado da UI (capítulo em foco, tamanho de fonte, tema, painel aberto) é salvo em `localStorage` do Electron (persistente entre sessões), separado do conteúdo do projeto.

---

## Referências de Interface

- **Calmly Writer** e **iA Writer**: minimalismo, foco no texto, tipografia cuidada
- Barra de ferramentas oculta por padrão, aparece ao selecionar texto (toolbar flutuante)
- Painel lateral recolhível (capítulos, entidades) para não distrair durante a escrita
- Modo foco: oculta tudo exceto o texto atual

---

## Ordem de Implementação Recomendada

1. Fase 1 completa (fundação sólida antes de adicionar features)
2. Fase 2 (painel de capítulos — uso diário imediato)
3. Fase 4 parcial (entidades — core da gestão narrativa)
4. Fase 3 (correção — qualidade do texto)
5. Fase 5 (git + exportação)
6. Fase 4 completa (importação Word, busca avançada)
7. Fase 6 (LLM — depende de Ollama estar instalado externamente)
