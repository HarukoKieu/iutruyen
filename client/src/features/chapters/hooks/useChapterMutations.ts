import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { chaptersApi } from '../api/chapters.api'
import type { CreateChapterInput, UpdateChapterInput } from '@/types/chapter'

export const useCreateChapter = (storyId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateChapterInput) => chaptersApi.createChapter(storyId, input),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', storyId] })
      queryClient.invalidateQueries({ queryKey: ['story'] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      toast.success(chapter.status === 'draft' ? 'Đã lưu bản thảo' : 'Đã gửi chương chờ mod hoặc admin duyệt')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo chương')
    },
  })
}

export const useUpdateChapter = (storyId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ chapterId, input }: { chapterId: string; input: UpdateChapterInput }) =>
      chaptersApi.updateChapter(chapterId, input),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', storyId] })
      queryClient.invalidateQueries({ queryKey: ['chapter'] })
      queryClient.invalidateQueries({ queryKey: ['story'] })
      queryClient.invalidateQueries({ queryKey: ['moderation'] })
      toast.success(chapter.status !== 'draft' && chapter.moderationStatus === 'pending'
        ? 'Đã gửi chương chờ mod hoặc admin duyệt'
        : 'Cập nhật chương thành công')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật chương')
    },
  })
}

export const useDeleteChapter = (storyId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (chapterId: string) => chaptersApi.deleteChapter(chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', storyId] })
      queryClient.invalidateQueries({ queryKey: ['story'] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      toast.success('Đã xóa chương')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi xóa chương')
    },
  })
}
