export interface CommentUser {
  _id: string
  displayName: string
  username: string
  avatarUrl?: string
  role: string
  authorStatus?: string
}

export interface Comment {
  _id: string
  storyId: string
  chapterId?: string | null
  userId: CommentUser
  parentId?: string | null
  replyToUserId?: {
    _id: string
    displayName: string
    username: string
  } | null
  content: string
  likeCount: number
  likedByMe: boolean
  replyCount: number
  previewReplies?: Comment[]
  spamScore?: number
  isLocked: boolean
  isHidden?: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface CommentListResult {
  items: Comment[]
  hasMore: boolean
  nextCursor: string | null
}
