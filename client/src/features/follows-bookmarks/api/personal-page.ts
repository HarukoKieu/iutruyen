import { axiosInstance } from '@/lib/axios'
export interface PersonalPage<T> { items: T[]; nextCursor: string | null }
export async function getPersonalPage<T>(path: string, limit: number, cursor: string | null): Promise<PersonalPage<T>> {
  const res = await axiosInstance.get(path, { params: { limit, ...(cursor ? { cursor } : {}) } })
  return { items: res.data.data, nextCursor: res.data.meta?.hasMore ? res.data.meta.nextCursor : null }
}
