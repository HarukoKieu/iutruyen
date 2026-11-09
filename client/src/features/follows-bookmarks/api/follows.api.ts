import { axiosInstance } from '@/lib/axios'
import type { Story } from '@/types/story'
import { getPersonalPage } from './personal-page'

export interface FollowItem {
  _id: string
  userId: string
  storyId: Story
  createdAt: string
  updatedAt: string
}

export const followsApi = {
  getPage: (limit: number, cursor: string | null) => getPersonalPage<FollowItem>('/users/me/following', limit, cursor),
  async toggleFollow(storyId: string): Promise<{ isFollowing: boolean; followCount: number }> {
    const res = await axiosInstance.post(`/stories/${storyId}/follow`)
    return res.data.data
  },

  async checkFollow(storyId: string): Promise<{ isFollowing: boolean }> {
    const res = await axiosInstance.get(`/stories/${storyId}/follow/check`)
    return res.data.data
  },

  async getUserFollows(limit: number = 50): Promise<FollowItem[]> {
    const res = await axiosInstance.get('/users/me/following', { params: { limit } })
    return res.data.data
  },
}
