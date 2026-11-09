import React, { useState, useEffect, useRef } from 'react'
import { X, Image as ImageIcon, UploadCloud, Trash2, Save, Camera, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useUpdateStory } from '../hooks/useStoryMutations'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

const MAX_COVER_SIZE = 500 * 1024 // 500KB

export interface ChangeCoverModalStory {
  _id: string
  title: string
  coverUrl?: string
  slug?: string
}

interface ChangeCoverModalProps {
  story: ChangeCoverModalStory | null
  open: boolean
  onClose: () => void
  onSuccess?: (newCoverUrl?: string) => void
}

export const ChangeCoverModal: React.FC<ChangeCoverModalProps> = ({
  story,
  open,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open: open && !!story, onClose, containerRef: dialogRef })
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBase64, setCoverBase64] = useState<string | undefined>(undefined)
  const [isRemoved, setIsRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updateStoryMutation = useUpdateStory()

  useEffect(() => {
    if (open && story) {
      setCoverPreview(story.coverUrl || null)
      setCoverBase64(undefined)
      setIsRemoved(false)
      setError(null)
    }
  }, [open, story])

  if (!open || !story) return null

  const processFile = (file: File) => {
    if (file.size > MAX_COVER_SIZE) {
      setError('Kích thước ảnh phải nhỏ hơn 500KB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Tệp tải lên phải là hình ảnh (PNG, JPG, WebP, GIF)')
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setCoverPreview(result)
      setCoverBase64(result)
      setIsRemoved(false)
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleRemoveCover = () => {
    setCoverPreview(null)
    setCoverBase64('')
    setIsRemoved(true)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!story) return

    try {
      const updatedStory = await updateStoryMutation.mutateAsync({
        id: story._id,
        input: {
          coverBase64: isRemoved ? '' : coverBase64,
        },
      })

      toast.success('Đã cập nhật ảnh bìa truyện thành công!')
      onSuccess?.(updatedStory.coverUrl)
      onClose()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu ảnh bìa.'
      toast.error(msg)
    }
  }

  // Check if there is an unsaved change
  const hasChanged = coverBase64 !== undefined || isRemoved
  const isSaving = updateStoryMutation.isPending

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        data-modal-backdrop
        aria-hidden="true"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-link">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-serif text-base sm:text-lg font-bold text-foreground">
                Thay Đổi Ảnh Bìa Truyện
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {story.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thay đổi ảnh bìa"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="my-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            {/* Left: Cover Preview (Aspect 2/3) */}
            <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-none border-2 border-border bg-surface-raised shadow-md flex items-center justify-center">
              {coverPreview ? (
                <>
                  <img
                    src={coverPreview}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-md opacity-40 scale-125 pointer-events-none"
                  />
                  <img
                    src={coverPreview}
                    alt="Xem trước ảnh bìa"
                    className="relative z-10 max-h-full max-w-full object-contain object-center"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-3 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mb-1.5 opacity-40" />
                  <span className="text-[11px] font-medium">Chưa có ảnh bìa</span>
                </div>
              )}
            </div>

            {/* Right: Upload Dropzone & Controls */}
            <div className="flex-1 w-full space-y-3">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Chọn ảnh bìa truyện"
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click() } }}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                  isDragging
                    ? 'border-primary bg-secondary/40'
                    : 'border-border bg-surface-raised/40 hover:border-primary/50 hover:bg-surface-raised'
                }`}
              >
                <UploadCloud className="h-8 w-8 text-link mb-2" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Kéo thả hoặc bấm để chọn ảnh
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">
                  Định dạng: PNG, JPG, WebP · Tối đa 500KB
                </span>
                <span className="text-[10px] text-link/80 mt-0.5">
                  Khuyến nghị tỉ lệ 2:3 (ví dụ 600x900px)
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive font-medium text-center">
                  {error}
                </div>
              )}

              {/* Cover actions if existing */}
              {(coverPreview || story.coverUrl) && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 rounded-full text-xs"
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" />
                    Chọn ảnh khác
                  </Button>

                  {!isRemoved && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCover}
                      className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Gỡ ảnh
                    </Button>
                  )}
                </div>
              )}

              {isRemoved && (
                <p className="text-xs text-warning text-center italic">
                  Ảnh bìa sẽ được gỡ bỏ sau khi bạn bấm Lưu.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full text-xs px-5"
          >
            Hủy
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={!hasChanged || isSaving}
            className="rounded-full text-xs font-bold px-6 shadow-xs"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Đang lưu...</span>
              </div>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
