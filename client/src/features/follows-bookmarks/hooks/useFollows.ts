import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { followsApi } from '../api/follows.api'
import { useAuthStore } from '@/features/auth/store/authStore'
import { toast } from 'sonner'
import { usePersonalList } from './usePersonalList'

export const useCheckFollow = (storyId: string) => {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: ['follow', 'check', storyId],
    queryFn: () => followsApi.checkFollow(storyId),
    enabled: !!storyId && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })
}

export const useToggleFollow = (storyId: string) => {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  return useMutation({
    mutationFn: () => {
      if (!isAuthenticated) {
        throw new Error('Vui lòng đăng nhập để theo dõi truyện và lưu vào tủ sách')
      }
      return followsApi.toggleFollow(storyId)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['follow', 'check', storyId], { isFollowing: data.isFollowing })
      queryClient.invalidateQueries({ queryKey: ['user-follows'] })
      queryClient.invalidateQueries({ queryKey: ['story'] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      if (data.isFollowing) {
        toast.success('Đã thêm truyện vào tủ sách theo dõi!')
      } else {
        toast.info('Đã bỏ theo dõi truyện khỏi tủ sách')
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi theo dõi truyện')
    },
  })
}

export const useFollowedStories = (limit: number = 50) => {
  return usePersonalList(['user-follows'], limit, followsApi.getPage)
}
