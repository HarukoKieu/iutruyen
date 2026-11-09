interface AttributionInput {
  originalAuthor?: string
  sourceName?: string
  description?: string
  authorId?: string | { displayName?: string; username?: string } | null
}

export function sourceDisplayName(value: string) {
  const text = value.trim()
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    if (url.hostname.includes('.') && !/\s/.test(text)) return url.hostname.replace(/^www\./i, '')
  } catch { /* A manually entered source name is already display text. */ }
  return text
}

export function descriptionWithSourceName(description: string) {
  return description.replace(/(^|\n)(Nguồn: )([^\r\n]+)(\s*)$/, (_, prefix, label, value, suffix) =>
    `${prefix}${label}${sourceDisplayName(value)}${suffix}`)
}

/** Compatibility with the exact trailing credit written by the earlier crawler. */
export function storyAttribution(story: AttributionInput) {
  const legacy = /(?:^|\n\n)(?:Tác giả gốc: ([^\r\n]+)\r?\n)?Nguồn: (https:\/\/[^\s]+)\s*$/.exec(story.description ?? '')
  const explicit = story.sourceName !== undefined || story.originalAuthor !== undefined
  const source = (explicit ? story.sourceName : legacy?.[2])?.trim() || ''
  const originalAuthor = (explicit ? story.originalAuthor : legacy?.[1])?.trim() || ''
  const isCollected = !!(source || originalAuthor)
  const owner = typeof story.authorId === 'object' ? story.authorId : null
  return { isCollected, source: isCollected ? sourceDisplayName(source) || 'Sưu tầm' : '',
    author: isCollected ? originalAuthor || 'Chưa rõ tác giả' : owner?.displayName || owner?.username || 'Tác giả' }
}
