/** Public eligibility must be shared by every reader and discovery entry point. */
export const isPublicStory = (story: { moderationStatus?: string } | null | undefined): boolean =>
  story?.moderationStatus === 'approved'

export const isPublicChapter = (chapter: { status?: string; moderationStatus?: string } | null | undefined): boolean =>
  chapter?.status === 'published' && chapter.moderationStatus === 'approved'

export const resourceId = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'object' && '_id' in value) return String(value._id)
  return String(value)
}

export const canPreviewStory = (story: { authorId: unknown }, user?: { id: string; role: string }): boolean =>
  !!user && (['admin', 'moderator'].includes(user.role) || resourceId(story.authorId) === user.id)

export const PUBLIC_CHAPTER_FILTER = { status: 'published', moderationStatus: 'approved' } as const
