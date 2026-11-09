import { api } from '@/lib/axios'
import { catalogCover } from './catalogCover'
import type {
  Story,
  StoryQueryParams,
  StoriesResponse,
  StoryResponse,
  CreateStoryInput,
  UpdateStoryInput,
  StoryStats,
  CursorPaginationMeta,
} from '@/types/story'

export const fetchStories = async (
  params: StoryQueryParams
): Promise<{ stories: Story[]; meta: CursorPaginationMeta }> => {
  const { data } = await api.get<StoriesResponse>('/stories', { params })
  return { stories: data.data.map(catalogCover), meta: data.meta }
}

export const fetchStoryBySlug = async (slug: string): Promise<Story> => {
  const { data } = await api.get<StoryResponse>(`/stories/${slug}`)
  return data.data
}

export const fetchStoryById = async (id: string): Promise<Story> => {
  const { data } = await api.get<StoryResponse>(`/stories/by-id/${id}`)
  return data.data
}

export const fetchAuthorStories = async (
  params: StoryQueryParams
): Promise<{ stories: Story[]; meta: CursorPaginationMeta }> => {
  const { data } = await api.get<StoriesResponse>('/stories/my-stories', { params })
  return { stories: data.data, meta: data.meta }
}

export const createStory = async (input: CreateStoryInput): Promise<Story> => {
  const { data } = await api.post<StoryResponse>('/stories', input)
  return data.data
}

export const updateStory = async (
  id: string,
  input: UpdateStoryInput
): Promise<Story> => {
  const { data } = await api.patch<StoryResponse>(`/stories/${id}`, input)
  return data.data
}

export const deleteStory = async (id: string): Promise<void> => {
  await api.delete(`/stories/${id}`)
}

export const fetchStoryStats = async (id: string): Promise<StoryStats> => {
  const { data } = await api.get(`/stories/${id}/stats`)
  return data.data
}

export const storiesApi = {
  fetchStories,
  fetchStoryBySlug,
  fetchStoryById,
  fetchAuthorStories,
  createStory,
  updateStory,
  deleteStory,
  fetchStoryStats,
}
