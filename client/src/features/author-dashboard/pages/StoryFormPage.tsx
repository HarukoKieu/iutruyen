import React, { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  X,
  Image as ImageIcon,
  BookOpen,
  Save,
  ChevronRight,
  AlertTriangle,
  FileText,
  Wand2,
  ListOrdered,
  PlusCircle,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useGenres } from '@/features/stories/hooks/useGenres'
import { useTags } from '@/features/stories/hooks/useTags'
import { useCreateStory, useUpdateStory } from '@/features/stories/hooks/useStoryMutations'
import { useStoryById } from '@/features/stories/hooks/useStory'
import { chaptersApi } from '@/features/chapters/api/chapters.api'
import type { Genre } from '@/types/genre'
import type { Tag } from '@/types/tag'
import type { ChapterStatus } from '@/types/chapter'
import CrawlerNewStory from '@/features/chapters/components/CrawlerNewStory'
import { storyAttribution, sourceDisplayName } from '@/features/stories/utils/storyAttribution'

const MAX_COVER_SIZE = 500 * 1024 // 500KB

export const StoryFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const { data: genres = [] } = useGenres()
  const { data: tags = [] } = useTags()
  const createStoryMutation = useCreateStory()
  const updateStoryMutation = useUpdateStory()
  const { data: existingStory, isLoading: isLoadingStory, isError: hasStoryError, refetch: refetchStory } = useStoryById(id ?? '')

  // Story fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBase64, setCoverBase64] = useState<string | undefined>(undefined)
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing')
  const [contentWarning, setContentWarning] = useState<'none' | 'mature18+'>('none')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [crawlSourceUrl, setCrawlSourceUrl] = useState('')
  const [isCollected, setIsCollected] = useState(false)
  const [originalAuthor, setOriginalAuthor] = useState('')
  const [sourceName, setSourceName] = useState('')

  // Chapter 1 creation fields (for new story)
  const [includeFirstChapter, setIncludeFirstChapter] = useState(false)
  const [chapterTitle, setChapterTitle] = useState('Chương 1: Mở đầu')
  const [chapterContent, setChapterContent] = useState('')
  const [chapterStatus, setChapterStatus] = useState<ChapterStatus>('published')
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  const [createdStoryId, setCreatedStoryId] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditMode || !existingStory) return

    setTitle(existingStory.title || '')
    const attribution = storyAttribution(existingStory)
    setIsCollected(attribution.isCollected)
    setOriginalAuthor(existingStory.originalAuthor ?? (attribution.isCollected && attribution.author !== 'Chưa rõ tác giả' ? attribution.author : ''))
    setSourceName(attribution.source)
    setDescription(existingStory.description || '')
    setCoverPreview(existingStory.coverUrl || null)
    setSelectedGenreIds(
      existingStory.genreIds.map((genre: string | Genre) =>
        typeof genre === 'string' ? genre : genre._id
      )
    )
    setSelectedTagIds(
      existingStory.tagIds.map((tag: string | Tag) =>
        typeof tag === 'string' ? tag : tag._id
      )
    )
    setStatus(existingStory.status || 'ongoing')
    setContentWarning(existingStory.contentWarning || 'none')
  }, [existingStory, isEditMode])

  const handleCoverUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_COVER_SIZE) {
      setErrors((prev) => ({ ...prev, cover: 'Ảnh bìa phải nhỏ hơn 500KB' }))
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, cover: 'Tệp phải là hình ảnh' }))
      return
    }

    setErrors((prev) => {
      const { cover: _cover, ...rest } = prev
      return rest
    })

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setCoverPreview(result)
      setCoverBase64(result)
    }
    reader.readAsDataURL(file)
  }, [])

  const removeCover = () => {
    setCoverPreview(null)
    setCoverBase64('')
  }

  const toggleGenre = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((gId) => gId !== genreId) : [...prev, genreId]
    )
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((tId) => tId !== tagId) : [...prev, tagId]
    )
  }

  // Format paragraphs helper for Chapter 1
  const handleAutoFormatParagraphs = () => {
    if (!chapterContent) return
    const lines = chapterContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const formatted = lines.map((l) => `<p>${l}</p>`).join('\n')
    setChapterContent(formatted)
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!title.trim() || title.trim().length < 3) {
      newErrors.title = 'Tên truyện phải có ít nhất 3 ký tự'
    }
    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = 'Mô tả phải có ít nhất 10 ký tự'
    }
    if (selectedGenreIds.length === 0) {
      newErrors.genres = 'Chọn ít nhất 1 thể loại'
    }

    // Validate chapter if enabled
    if (!isEditMode && includeFirstChapter) {
      if (!chapterTitle.trim()) {
        newErrors.chapterTitle = 'Vui lòng nhập tiêu đề chương 1'
      }
      if (!chapterContent.trim()) {
        newErrors.chapterContent = 'Vui lòng nhập nội dung chương 1'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingCustom || createStoryMutation.isPending || updateStoryMutation.isPending) return
    if (!validate()) return

    setIsSubmittingCustom(true)

    const payload = {
      originalAuthor: isCollected ? originalAuthor.trim() : '',
      sourceName: isCollected ? sourceDisplayName(sourceName) || 'Sưu tầm' : '',
      title: title.trim(),
      description: description.trim(),
      coverBase64,
      genreIds: selectedGenreIds,
      tagIds: selectedTagIds,
      status,
      contentWarning,
    }

    try {
      if (isEditMode && id) {
        await updateStoryMutation.mutateAsync({ id, input: payload })
        navigate('/author/stories')
      } else {
        const createdStory = createdStoryId ? { _id: createdStoryId } : await createStoryMutation.mutateAsync({ ...payload, ...(crawlSourceUrl ? { crawlerSourceUrl: crawlSourceUrl } : {}) })
        if (createdStory?._id) setCreatedStoryId(createdStory._id)

        // If includeFirstChapter was checked and has content, create chapter 1
        if (includeFirstChapter && chapterContent.trim() && createdStory?._id) {
          let formattedHtml = chapterContent.trim()
          if (!formattedHtml.includes('<p>') && !formattedHtml.includes('<br>')) {
            formattedHtml = formattedHtml
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line) => `<p>${line.trim()}</p>`)
              .join('\n')
          }

          await chaptersApi.createChapter(createdStory._id, {
            title: chapterTitle.trim() || 'Chương 1: Mở đầu',
            contentHtml: formattedHtml,
            status: chapterStatus,
            order: 1,
          })
        }

        if (crawlSourceUrl && createdStory?._id) {
          navigate(`/author/stories/${createdStory._id}/crawl`, { state: { sourceUrl: crawlSourceUrl } })
        } else navigate('/author/stories')
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu truyện.')
    } finally {
      setIsSubmittingCustom(false)
    }
  }

  const isSubmitting =
    createStoryMutation.isPending || updateStoryMutation.isPending || isSubmittingCustom

  if (isEditMode && (isLoadingStory || hasStoryError)) {
    return <AppLayout><div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/author/stories" className="text-link hover:underline">← Truyện của tôi</Link>
      <h1 className="font-serif text-2xl font-bold">Chỉnh sửa truyện</h1>
      {isLoadingStory ? <p role="status">Đang tải thông tin truyện…</p> : <div role="alert" className="space-y-3">
        <p>Không tải được thông tin truyện. Vui lòng thử lại.</p>
        <Button variant="outline" onClick={() => { void refetchStory() }}>Thử lại</Button>
      </div>}
    </div></AppLayout>
  }

  return (
    <AppLayout>
      {createdStoryId && <div role="status" className="mx-auto max-w-7xl px-4 py-3 text-sm">
        Truyện đã được lưu. Gửi lại chỉ tiếp tục tạo chương đầu; bạn có thể sửa thông tin truyện sau.
        {' '}<Link className="text-link underline" to={`/author/stories/${createdStoryId}/chapters`}>Quản lý chương đã lưu</Link>
      </div>}
      {/* Header */}
      <div className="border-b border-border-subtle bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-link transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/author/stories" className="hover:text-link transition-colors">
              Truyện của tôi
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
              {isEditMode ? 'Sửa truyện' : 'Tạo truyện mới'}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-link" />
            {isEditMode ? 'Chỉnh sửa truyện' : 'Tạo truyện mới'}
          </h1>
        </div>
      </div>

      {/* Form */}
      {!isEditMode && <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <CrawlerNewStory isBusy={isSubmitting} onSourceChange={() => setCrawlSourceUrl('')} onApply={(input, sourceUrl) => {
          if (input.title !== undefined) setTitle(input.title)
          if (input.originalAuthor !== undefined) setOriginalAuthor(input.originalAuthor)
          if (input.sourceName !== undefined) { setSourceName(input.sourceName); setIsCollected(true) }
          if (input.description !== undefined) setDescription(input.description)
          if (input.status !== undefined) setStatus(input.status)
          if (input.genreIds !== undefined) setSelectedGenreIds(input.genreIds)
          if (input.coverBase64 !== undefined) { setCoverBase64(input.coverBase64); setCoverPreview(input.coverBase64) }
          setCrawlSourceUrl(sourceUrl)
          setErrors({})
        }} />
      </div>}
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column: Form */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Title */}
            <div className="space-y-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={isCollected} onChange={e => setIsCollected(e.target.checked)} />Truyện từ nguồn khác / sưu tầm</label>
              {isCollected && <>
                <div><Label htmlFor="originalAuthor">Tác giả gốc</Label><Input id="originalAuthor" value={originalAuthor} maxLength={200} onChange={e => setOriginalAuthor(e.target.value)} placeholder="Chưa rõ tác giả" /></div>
                <div><Label htmlFor="sourceName">Nguồn truyện</Label><Input id="sourceName" value={sourceName} maxLength={2048} onChange={e => setSourceName(e.target.value)} placeholder="Sưu tầm" /></div>
                <p className="text-sm text-muted-foreground">Để trống nguồn sẽ hiển thị “Sưu tầm”. Tên người đăng không hiển thị thay tác giả gốc.</p>
              </>}
            </div>
            <div>
              <Label htmlFor="title">Tên truyện *</Label>
              <Input
                id="title"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'story-title-error' : undefined}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên truyện..."
                className="mt-1.5 rounded-full"
              />
              {errors.title && (
                <p id="story-title-error" role="alert" className="mt-1 text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Mô tả / Giới thiệu *</Label>
              <textarea
                id="description"
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'story-description-error' : undefined}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Viết mô tả hấp dẫn cho truyện của bạn..."
                rows={6}
                className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition-all resize-y"
              />
              {errors.description && (
                <p id="story-description-error" role="alert" className="mt-1 text-xs text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Genres */}
            <div>
              <Label>Thể loại *</Label>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Thể loại truyện">
                {genres.map((g) => (
                  <Button
                    key={g._id}
                    type="button"
                    variant={selectedGenreIds.includes(g._id) ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={selectedGenreIds.includes(g._id)}
                    className="rounded-full"
                    onClick={() => toggleGenre(g._id)}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>
              {errors.genres && (
                <p role="alert" className="mt-1 text-xs text-destructive">{errors.genres}</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tags truyện">
                {tags.map((t) => (
                  <Button
                    key={t._id}
                    type="button"
                    size="sm"
                    variant={selectedTagIds.includes(t._id) ? 'secondary' : 'outline'}
                    aria-pressed={selectedTagIds.includes(t._id)}
                    className="rounded-full"
                    onClick={() => toggleTag(t._id)}
                  >
                    {t.name}
                  </Button>
                ))}
                {tags.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Chưa có tag nào. Tag sẽ được tự động tạo khi bạn thêm truyện.
                  </p>
                )}
              </div>
            </div>

            {/* Status & Content Warning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Trạng thái truyện</Label>
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1.5"
                >
                  <option value="ongoing">Đang ra</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="hiatus">Tạm dừng</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="contentWarning">Cảnh báo nội dung</Label>
                <Select
                  id="contentWarning"
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value as any)}
                  className="mt-1.5"
                >
                  <option value="none">Không có cảnh báo</option>
                  <option value="mature18+">Nội dung 18+</option>
                </Select>
              </div>
            </div>

            {contentWarning === 'mature18+' && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Truyện sẽ hiển thị cảnh báo 18+ và yêu cầu xác nhận tuổi trước khi đọc.
              </div>
            )}

            {/* ── SECTION: TẠO CHƯƠNG ĐẦU TIÊN (DÀNH CHO TẠO TRUYỆN MỚI) ── */}
            {!isEditMode && (
              <div className="rounded-3xl border border-primary/20 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-link shrink-0 shadow-2xs">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                        Tạo Chương Mở Đầu
                        <span className="text-[10px] font-semibold text-link bg-primary/10 px-2 py-0.5 rounded-full">
                          Chương 1
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Đăng ngay chương đầu tiên để bạn đọc có thể thưởng thức tác phẩm ngay khi tạo
                      </p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      aria-label="Tạo chương mở đầu cùng truyện"
                      checked={includeFirstChapter}
                      onChange={(e) => setIncludeFirstChapter(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {includeFirstChapter && (
                  <div className="space-y-4 pt-4 border-t border-border/50 animate-in fade-in duration-200">
                    {/* Chapter Title */}
                    <div>
                      <Label htmlFor="chapterTitle">Tiêu đề chương 1 *</Label>
                      <Input
                        id="chapterTitle"
                        value={chapterTitle}
                        onChange={(e) => setChapterTitle(e.target.value)}
                        placeholder="Ví dụ: Chương 1: Mở đầu"
                        className="mt-1.5 rounded-xl"
                      />
                      {errors.chapterTitle && (
                        <p className="mt-1 text-xs text-destructive">{errors.chapterTitle}</p>
                      )}
                    </div>

                    {/* Chapter Content */}
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="chapterContent">Nội dung chương 1 *</Label>
                        <button
                          type="button"
                          onClick={handleAutoFormatParagraphs}
                          className="text-xs text-link hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                          title="Tự động bọc từng dòng thành thẻ <p>"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Tự động định dạng đoạn văn &lt;p&gt;
                        </button>
                      </div>
                      <textarea
                        id="chapterContent"
                        value={chapterContent}
                        onChange={(e) => setChapterContent(e.target.value)}
                        placeholder="Nhập hoặc dán nội dung chương 1 vào đây..."
                        rows={8}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition-all font-serif resize-y leading-relaxed"
                      />
                      {errors.chapterContent && (
                        <p className="mt-1 text-xs text-destructive">{errors.chapterContent}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          Độ dài:{' '}
                          <strong className="text-foreground">
                            {chapterContent.trim()
                              ? chapterContent.trim().split(/\s+/).length
                              : 0}
                          </strong>{' '}
                          từ
                        </span>
                        <span>Hỗ trợ định dạng HTML hoặc văn bản thuần</span>
                      </div>
                    </div>

                    {/* Chapter Status */}
                    <div>
                      <Label htmlFor="chapterStatus">Trạng thái xuất bản chương</Label>
                      <Select
                        id="chapterStatus"
                        value={chapterStatus}
                        onChange={(e) => setChapterStatus(e.target.value as any)}
                        className="mt-1.5"
                      >
                        <option value="published">Xuất bản ngay (Mọi người có thể đọc ngay)</option>
                        <option value="draft">Lưu bản nháp (Chỉ tác giả thấy)</option>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION: QUẢN LÝ CHƯƠNG (DÀNH CHO CHẾ ĐỘ CHỈNH SỬA TRUYỆN) ── */}
            {isEditMode && existingStory && (
              <div className="rounded-3xl border border-border bg-surface-raised/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-link shrink-0 shadow-2xs">
                    <ListOrdered className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Danh sách chương</h4>
                    <p className="text-xs text-muted-foreground">
                      Tác phẩm hiện có {existingStory.chapterCount || 0} chương đã tạo
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Button
                    type="button"
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full flex-1 sm:flex-initial text-xs"
                  >
                    <Link to={`/author/stories/${id}/chapters`}>Quản lý chương</Link>
                  </Button>
                  <Button
                    type="button"
                    asChild
                    variant="secondary"
                    size="sm"
                    className="rounded-full flex-1 sm:flex-initial text-xs font-bold"
                  >
                    <Link to={`/author/stories/${id}/chapters/new`}>
                      <PlusCircle className="h-3.5 w-3.5 mr-1" /> Thêm chương mới
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right column: Cover & Preview */}
          <div className="w-full lg:w-72 shrink-0 space-y-6">
            {/* Cover Upload */}
            <div className="sticky top-20">
              <Label>Ảnh bìa</Label>
              <div className="mt-2">
                {coverPreview ? (
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-none border border-border shadow-md bg-slate-900/5 flex items-center justify-center">
                    <img
                      src={coverPreview}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover blur-md opacity-40 scale-125 pointer-events-none"
                    />
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="relative z-10 max-h-full max-w-full object-contain object-center"
                    />
                    <button
                      type="button"
                      onClick={removeCover}
                      aria-label="Xóa ảnh bìa đã chọn"
                      className="absolute right-2 top-2 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex aspect-[2/3] w-full cursor-pointer flex-col items-center justify-center rounded-none border-2 border-dashed border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all focus-within:ring-2 focus-within:ring-primary">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-muted-foreground">Tải ảnh bìa</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, WebP · Tối đa 500KB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="sr-only"
                    />
                  </label>
                )}
                {errors.cover && (
                  <p className="mt-1 text-xs text-destructive">{errors.cover}</p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                variant="default"
                className="mt-6 w-full rounded-full font-bold shadow-sm"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Đang xử lý...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode
                      ? 'Lưu thay đổi'
                      : includeFirstChapter
                      ? 'Tạo truyện & Đăng chương 1'
                      : 'Tạo truyện'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}

export default StoryFormPage
