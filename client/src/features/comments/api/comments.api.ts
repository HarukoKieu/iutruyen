import { axiosInstance } from '@/lib/axios'
import type { Comment, CommentListResult } from '@/types/comment'

export interface QueryCommentsParams {
  storyId: string
  chapterId?: string | null
  sort?: 'newest' | 'top'
  cursor?: string | null
  limit?: number
}

export interface QueryRepliesParams {
  cursor?: string | null
  limit?: number
}

export const commentsApi = {
  async getComments(params: QueryCommentsParams): Promise<CommentListResult> {
    const res = await axiosInstance.get('/comments', { params })
    return {
      items: res.data.data,
      hasMore: res.data.meta?.hasMore ?? false,
      nextCursor: res.data.meta?.nextCursor ?? null,
    }
  },

  async getReplies(commentId: string, params?: QueryRepliesParams): Promise<CommentListResult> {
    const res = await axiosInstance.get(`/comments/${commentId}/replies`, { params })
    return {
      items: res.data.data,
      hasMore: res.data.meta?.hasMore ?? false,
      nextCursor: res.data.meta?.nextCursor ?? null,
    }
  },

  async createComment(data: {
    storyId: string
    chapterId?: string | null
    parentId?: string | null
    content: string
  }): Promise<Comment> {
    const res = await axiosInstance.post('/comments', data)
    return res.data.data
  },

  async updateComment(id: string, content: string): Promise<Comment> {
    const res = await axiosInstance.patch(`/comments/${id}`, { content })
    return res.data.data
  },

  async deleteComment(id: string): Promise<void> {
    await axiosInstance.delete(`/comments/${id}`)
  },

  async toggleLike(id: string): Promise<{ likeCount: number }> {
    const res = await axiosInstance.post(`/comments/${id}/like`)
    return res.data.data
  },

  async toggleLock(id: string): Promise<{ isLocked: boolean }> {
    const res = await axiosInstance.patch(`/comments/${id}/lock`)
    return res.data.data
  },
}
