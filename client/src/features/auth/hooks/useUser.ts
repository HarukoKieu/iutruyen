import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  updateMeApi,
  updateAvatarApi,
  changePasswordApi,
  changeEmailApi,
  becomeAuthorApi,
  getPublicProfileApi,
} from '../api/users.api'
import { useAuthStore } from '../store/authStore'
import { queryKeys } from '@/constants/queryKeys'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)
  const currentUser = useAuthStore((state) => state.user)

  return useMutation({
    mutationFn: updateMeApi,
    onSuccess: (response) => {
      if (currentUser) {
        setUser({ ...currentUser, ...response.data })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me })
      toast.success(response.message || 'Cập nhật thông tin thành công')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Cập nhật thông tin thất bại'
      toast.error(message)
    },
  })
}

export const useUpdateAvatar = () => {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)
  const currentUser = useAuthStore((state) => state.user)

  return useMutation({
    mutationFn: updateAvatarApi,
    onSuccess: (response) => {
      if (currentUser) {
        setUser({ ...currentUser, avatarUrl: response.data.avatarUrl })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me })
      toast.success(response.message || 'Cập nhật ảnh đại diện thành công')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Cập nhật ảnh đại diện thất bại'
      toast.error(message)
    },
  })
}

export const useChangePassword = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: changePasswordApi,
    onSuccess: (response) => {
      useAuthStore.getState().logout()
      queryClient.clear()
      toast.success(response.message || 'Đổi mật khẩu thành công')
      navigate('/login', { replace: true })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đổi mật khẩu thất bại'
      toast.error(message)
    },
  })
}

export const useChangeEmail = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: changeEmailApi,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me })
      toast.success(response.message || 'Cập nhật email thành công')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Cập nhật email thất bại'
      toast.error(message)
    },
  })
}

/** Lưu hồ sơ công khai trước khi gửi yêu cầu tác giả cho phiên đang đăng nhập. */
export const useBecomeAuthor = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { displayName: string; bio: string }) => {
      const actor = useAuthStore.getState().user
      if (!actor) throw new Error('Vui lòng đăng nhập để đăng ký làm tác giả')

      if (data.displayName !== actor.displayName || data.bio !== (actor.bio ?? '')) {
        const saved = await updateMeApi(data)
        const current = useAuthStore.getState()
        if (current.user?.id !== actor.id || !current.isAuthenticated) {
          throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.')
        }
        current.setUser({ ...current.user, displayName: saved.data.displayName, bio: saved.data.bio })
      }

      const response = await becomeAuthorApi()
      return { ...response, actorId: actor.id }
    },
    onSuccess: (response) => {
      const current = useAuthStore.getState()
      if (current.user?.id !== response.actorId || !current.isAuthenticated) return
      current.setUser({ ...current.user, authorStatus: 'pending' })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me })
      toast.success(response.message || 'Gửi yêu cầu thành công')
    },
    onError: (error) => {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || 'Gửi yêu cầu thất bại'
        : error.message || 'Gửi yêu cầu thất bại'
      toast.error(message)
    },
  })
}

export const usePublicProfile = (id: string) => {
  return useQuery({
    queryKey: queryKeys.users.profile(id),
    queryFn: () => getPublicProfileApi(id),
    enabled: !!id,
  })
}
