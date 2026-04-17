export interface HeadingEntry {
  id: string
  chapterId: string
  level: 1 | 2 | 3
  text: string
  lineStart: number
  sectionEnd: number  // exclusive: lines[lineStart..sectionEnd) = this heading's section
}

function getSectionEnd(lines: string[], headingLine: number, level: number): number {
  for (let i = headingLine + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/)
    if (m && m[1].length <= level) return i
  }
  return lines.length
}

export function extractHeadings(markdown: string, chapterId: string): HeadingEntry[] {
  const lines = markdown.split('\n')
  const entries: HeadingEntry[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,3})\s+(.+)/)
    if (!m) continue
    const level = m[1].length as 1 | 2 | 3
    entries.push({
      id: `${chapterId}-h${i}`,
      chapterId,
      level,
      text: m[2].trim(),
      lineStart: i,
      sectionEnd: getSectionEnd(lines, i, level)
    })
  }
  return entries
}

// Move section at fromIdx to just before toIdx (or to end if toIdx === headings.length).
// A "section" is the heading line plus all content until the next heading at same or higher level.
export function moveSection(
  markdown: string,
  headings: HeadingEntry[],
  fromIdx: number,
  toIdx: number
): string {
  if (fromIdx === toIdx || fromIdx + 1 === toIdx || headings.length <= 1) return markdown

  const lines = markdown.split('\n')
  const preamble = lines.slice(0, headings[0].lineStart)
  const sections = headings.map(h => lines.slice(h.lineStart, h.sectionEnd))

  const [moved] = sections.splice(fromIdx, 1)
  const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx
  sections.splice(insertAt, 0, moved)

  return [...preamble, ...sections.flat()].join('\n')
}
