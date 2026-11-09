import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Send,
  Clock,
  Eye,
  FileText,
} from 'lucide-react'
import { useStoryById } from '@/features/stories/hooks/useStory'
import ChapterEditor from '@/features/chapters/components/ChapterEditor'
import { toast } from 'sonner'
import { useCreateChapter, useUpdateChapter } from '@/features/chapters/hooks/useChapterMutations'
import { chaptersApi } from '@/features/chapters/api/chapters.api'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { ChapterStatus } from '@/types/chapter'

export const ChapterFormPage: React.FC = () => {
  const { storyId, chapterId } = useParams<{ storyId: string; chapterId?: string }>()
  const navigate = useNavigate()
  const isEditing = !!chapterId

  const { data: story } = useStoryById(storyId || '')

  const { mutate: createChapter, isPending: isCreating } = useCreateChapter(story?._id || storyId || '')
  const { mutate: updateChapter, isPending: isUpdating } = useUpdateChapter(story?._id || storyId || '')
  const isSubmitting = isCreating || isUpdating

  const [title, setTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [status, setStatus] = useState<ChapterStatus>('draft')
  const [publishAt, setPublishAt] = useState('')
  const [order, setOrder] = useState<number | undefined>(undefined)
  const [isPreview, setIsPreview] = useState(false)
  const [isLoadingExisting, setIsLoadingExisting] = useState(isEditing)

  const [loadFailed, setLoadFailed] = useState(false)

  // If editing, load existing chapter details
  useEffect(() => {
    let cancelled = false
    setLoadFailed(false)
    if (isEditing && chapterId) {
      setIsLoadingExisting(true)
      chaptersApi
        .getChapterPreview(chapterId)
        .then((chap) => {
          if (cancelled) return
          setTitle(chap.title)
          setContentHtml(chap.contentHtml)
          setStatus(chap.status)
          setOrder(chap.order)
          if (chap.publishAt) {
            const d = new Date(chap.publishAt)
            setPublishAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
          }
        })
        .catch(() => { if (!cancelled) { setLoadFailed(true); toast.error('Không tải được chương. Vui lòng tải lại trang.') } })
        .finally(() => { if (!cancelled) setIsLoadingExisting(false) })
    } else { setOrder(undefined) }
    return () => { cancelled = true }
  }, [isEditing, chapterId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loadFailed || isLoadingExisting) return
    if (!title.trim() || !contentHtml.trim()) return

    const payload = {
      title: title.trim(),
      contentHtml: contentHtml.trim(),
      status,
      publishAt: status === 'scheduled' && publishAt ? new Date(publishAt).toISOString() : undefined,
      order: order ? Number(order) : undefined,
    }

    if (isEditing && chapterId) {
      updateChapter(
        { chapterId, input: payload },
        {
          onSuccess: () => navigate(`/author/stories/${story?._id || storyId}/chapters`),
        }
      )
    } else {
      createChapter(payload, {
        onSuccess: () => navigate(`/author/stories/${story?._id || storyId}/chapters`),
      })
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/author/stories/${story?._id || storyId}/chapters`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-link hover:bg-secondary transition-colors"
              aria-label="Về danh sách chương"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0 break-words">
              <span className="text-xs font-bold uppercase tracking-wider text-link">
                {story?.title || 'Tác phẩm'}
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                {isEditing ? 'Chỉnh Sửa Chương' : 'Soạn Thảo Chương Mới'}
              </h1>
            </div>
          </div>

          {/* Mode switch */}
          <div className="flex self-start items-center rounded-full border border-border bg-surface-raised p-0.5 text-xs font-medium sm:shrink-0" role="group" aria-label="Chế độ soạn chương">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              aria-pressed={!isPreview}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all cursor-pointer ${
                !isPreview ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              aria-pressed={isPreview}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all cursor-pointer ${
                isPreview ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Xem trước
            </button>
          </div>
        </div>

        {/* Form Container */}
        {loadFailed ? (
          <div role="alert" className="space-y-3 rounded-3xl border border-destructive/30 bg-card p-6">
            <p>Không tải được nội dung chương. Tải lại trang để tiếp tục chỉnh sửa.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Tải lại trang</Button>
          </div>
        ) : isLoadingExisting ? (
          <div className="rounded-3xl border border-border bg-card p-8 animate-pulse space-y-4 shadow-card">
            <div className="h-10 w-3/4 rounded-xl bg-muted" />
            <div className="h-40 w-full rounded-2xl bg-muted" />
          </div>
        ) : isPreview ? (
          /* Preview View */
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-card space-y-6">
            <div className="text-center pb-6 border-b border-border space-y-1">
              <span className="text-xs text-link font-bold uppercase tracking-wider">
                Xem trước giao diện người đọc
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
                Chương {order || 1}: {title || 'Tiêu đề chương'}
              </h2>
            </div>

            <ChapterEditor value={contentHtml} readOnly />
          </div>
        ) : (
          /* Editor Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-5">
              {/* Title & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-3">
                  <Label htmlFor="order" className="text-xs font-bold text-muted-foreground uppercase">
                    Số thứ tự
                  </Label>
                  <Input
                    id="order"
                    type="number"
                    min={1}
                    value={order || ''}
                    onChange={(e) => setOrder(parseInt(e.target.value, 10))}
                    className="mt-1 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-9">
                  <Label htmlFor="title" className="text-xs font-bold text-muted-foreground uppercase">
                    Tiêu đề chương *
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="Vd: Mở đầu cuộc hành trình..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nội dung chương *</Label>
                <ChapterEditor value={contentHtml} onChange={setContentHtml} />
                <p className="text-xs text-muted-foreground">Chương mới hoặc đã sửa phải được mod hoặc admin duyệt trước khi xuất bản.</p>
              </div>

              {/* Status & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <Label htmlFor="status" className="text-xs font-bold text-muted-foreground uppercase">
                    Trạng thái xuất bản
                  </Label>
                  <Select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ChapterStatus)}
                    className="mt-1 rounded-xl"
                  >
                    <option value="published">Gửi duyệt để xuất bản</option>
                    <option value="draft">Lưu bản thảo (Chưa công bố)</option>
                    <option value="scheduled">Hẹn giờ xuất bản sau khi được duyệt</option>
                  </Select>
                </div>

                {status === 'scheduled' && (
                  <div>
                    <Label htmlFor="publishAt" className="text-xs font-bold text-warning uppercase flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Thời gian xuất bản (Ngày & Giờ)
                    </Label>
                    <Input
                      id="publishAt"
                      type="datetime-local"
                      value={publishAt}
                      onChange={(e) => setPublishAt(e.target.value)}
                      required={status === 'scheduled'}
                      className="mt-1 rounded-xl border-warning/50"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                asChild
                variant="outline"
                className="rounded-full"
              >
                <Link to={`/author/stories/${story?._id || storyId}/chapters`}>Hủy</Link>
              </Button>

              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={loadFailed || isSubmitting}
                className="rounded-full font-semibold shadow-xs"
              >
                {isSubmitting ? (
                  'Đang lưu...'
                ) : status !== 'draft' ? (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Gửi Duyệt
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    {isEditing ? 'Lưu Thay Đổi' : 'Lưu Chương'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  )
}

export default ChapterFormPage
