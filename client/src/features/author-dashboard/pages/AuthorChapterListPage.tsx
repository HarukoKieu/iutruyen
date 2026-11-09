import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Calendar,
  Clock,
  Eye,
} from 'lucide-react'
import { useStoryById } from '@/features/stories/hooks/useStory'
import { useChapters } from '@/features/chapters/hooks/useChapters'
import { useDeleteChapter } from '@/features/chapters/hooks/useChapterMutations'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog } from '@/components/ui/alert-dialog'
import type { ChapterListItem } from '@/types/chapter'

export const AuthorChapterListPage: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>()
  const { data: story, isLoading: storyLoading, isError: storyError, refetch: refetchStory } = useStoryById(storyId || '')
  const { data: chapters = [], isLoading: chaptersLoading, isError: chaptersError, refetch: refetchChapters, hasNextPage, fetchNextPage, isFetchingNextPage } = useChapters(story?._id || storyId || '')
  const { mutate: deleteChapter, isPending: isDeleting } = useDeleteChapter(story?._id || storyId || '')

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteChapter(deleteTargetId, {
        onSuccess: () => setDeleteTargetId(null),
      })
    }
  }

  const getStatusBadge = ({ status, publishAt, moderationStatus }: ChapterListItem) => {
    if (moderationStatus === 'hidden') {
      return <Badge variant="destructive">Bị ẩn</Badge>
    }
    if (status === 'draft') {
      return <Badge variant="secondary">Bản thảo</Badge>
    }
    if (moderationStatus !== 'approved') {
      return <Badge variant="warning">Chờ duyệt</Badge>
    }
    if (status === 'published') {
      return <Badge variant="success">Đã xuất bản</Badge>
    }
    if (status === 'scheduled') {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Hẹn giờ: {publishAt ? new Date(publishAt).toLocaleDateString('vi-VN') : ''}
        </Badge>
      )
    }
    return <Badge variant="secondary">Bản thảo</Badge>
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/author/stories"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-link hover:bg-secondary transition-colors"
              aria-label="Về danh sách truyện của tôi"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-link">
                  Quản lý chương
                </span>
                <span className="text-xs text-muted-foreground">• Đã tải {chapters.length} chương</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate max-w-xl">
                {storyLoading ? <Skeleton className="h-8 w-48" /> : story?.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to={`/author/stories/${story?._id || storyId}/crawl`}>Nhập từ website</Link>
          </Button>
          <Button asChild variant="default" className="rounded-full shrink-0">
            <Link to={`/author/stories/${story?._id || storyId}/chapters/new`}>
              <Plus className="h-4 w-4" />
              Thêm Chương Mới
            </Link>
          </Button>
          </div>
        </div>

        {/* Chapters Table / List */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-card">
          {storyError || chaptersError ? (
            <div role="alert" className="space-y-3">
              <p>Không tải được {storyError ? 'thông tin truyện' : 'danh sách chương'}. Vui lòng thử lại.</p>
              <Button variant="outline" onClick={() => { if (storyError) void refetchStory(); if (chaptersError) void refetchChapters() }}>Thử lại</Button>
            </div>
          ) : chaptersLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-3 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-link/30" />
              <div>
                <p className="font-serif text-lg font-bold text-foreground">Chưa có chương nào</p>
                <p className="text-xs mt-1">Bắt đầu soạn thảo chương đầu tiên cho tác phẩm của bạn.</p>
              </div>
              <Button asChild variant="default" size="sm" className="rounded-full">
                <Link to={`/author/stories/${story?._id || storyId}/chapters/new`}>
                  <Plus className="h-4 w-4" />
                  Soạn Chương 1 Ngay
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {chapters.map((chapter) => (
                <div
                  key={chapter._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 hover:bg-surface-raised px-3 rounded-none transition-colors"
                >
                  {/* Left: Order + Title + Metadata */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words font-serif text-sm font-bold text-foreground">
                          Chương {chapter.order}: {chapter.title}
                        </span>
                        {getStatusBadge(chapter)}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(chapter.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {chapter.viewCount || 0} lượt đọc
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {chapter.status === 'published' && story?.slug && (
                      <Button asChild variant="ghost" size="icon-sm" className="h-11 w-11 rounded-full text-muted-foreground hover:text-link" aria-label={`${chapter.moderationStatus === 'approved' ? 'Đọc' : 'Xem trước'} chương ${chapter.order}`} title={chapter.moderationStatus === 'approved' ? 'Đọc chương' : 'Xem trước chương'}>
                        <Link to={`/stories/${story.slug}/chapters/chuong-${chapter.order}`}>
                          <BookOpen className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}

                    <Button asChild variant="ghost" size="icon-sm" className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground" aria-label={`Chỉnh sửa chương ${chapter.order}`} title="Chỉnh sửa chương">
                      <Link to={`/author/stories/${story?._id || storyId}/chapters/${chapter._id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTargetId(chapter._id)}
                      className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Xóa chương"
                      aria-label={`Xóa chương ${chapter.order}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasNextPage && <Button disabled={isFetchingNextPage} onClick={() => { void fetchNextPage() }}>Tải thêm chương</Button>}
      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Xác nhận xóa chương?"
        description="Hành động này không thể hoàn tác. Số thứ tự các chương còn lại được giữ nguyên."
        confirmText="Xóa chương"
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </AppLayout>
  )
}

export default AuthorChapterListPage
