export function seoAuthor(story: { originalAuthor?: string; sourceName?: string; description: string; author: { displayName?: string; username?: string } | null }): string | undefined {
  const explicit = story.originalAuthor !== undefined || story.sourceName !== undefined
  const legacy = /(?:^|\n\n)(?:Tác giả gốc: ([^\r\n]+)\r?\n)?Nguồn: (https:\/\/[^\s]+)\s*$/.exec(story.description)
  const original = (explicit ? story.originalAuthor : legacy?.[1])?.trim()
  const source = (explicit ? story.sourceName : legacy?.[2])?.trim()
  if (source || original) return original || undefined
  return story.author?.displayName || story.author?.username || undefined
}
