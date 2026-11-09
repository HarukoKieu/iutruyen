import { useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useStoryById } from '@/features/stories/hooks/useStory'
import { useChapters } from '@/features/chapters/hooks/useChapters'
import { useCrawler } from '@/features/chapters/hooks/useCrawler'
import { crawlErrorMessage, type CrawlImportInput } from '@/features/chapters/api/crawler.api'
import CrawlerPreview from '@/features/chapters/components/CrawlerPreview'

function CrawlerWorkspace({ storyId, title }: { storyId: string; title: string }) {
  const location = useLocation()
  const [url, setUrl] = useState(() => typeof location.state?.sourceUrl === 'string' ? location.state.sourceUrl.slice(0, 2048) : '')
  const [savedUrls, setSavedUrls] = useState<string[]>([])
  const { data: chapters = [], isLoading: chaptersLoading, error: chaptersError } = useChapters(storyId)
  const { catalog, preview, save, isBusy } = useCrawler(storyId)
  const nextOrder = Math.max(0, ...chapters.map(chapter => chapter.order), save.data?.order ?? 0) + 1
  const error = catalog.error || preview.error || save.error || chaptersError
  const handlePreview = (sourceUrl: string) => {
    preview.reset(); save.reset(); catalog.reset()
    preview.mutate(sourceUrl)
  }
  // Preserve the current catalog when choosing a chapter from it.
  const handleSelect = (sourceUrl: string) => { preview.reset(); save.reset(); preview.mutate(sourceUrl) }
  const handleNextCatalog = () => {
    const current = catalog.data
    if (current?.nextCursor) catalog.mutate({ url: current.sourceUrl, cursor: current.nextCursor })
  }
  const handleSave = (input: CrawlImportInput) => {
    const current = preview.data
    if (!current) return
    save.mutate(input, { onSuccess: () => setSavedUrls(previous => [...previous, current.sourceUrl]) })
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Nhập từ website</h1>
        <p className="mt-2 text-muted-foreground">{title} · Lấy mục lục hoặc nhập trực tiếp URL một chương.</p>
        <Link to={`/author/crawl?storyId=${storyId}`} state={{ sourceUrl: url }} className="mt-3 inline-block text-sm text-link underline">Nhập nhiều chương hoặc thêm nguồn truyện</Link>
      </div>
      <form className="space-y-4 rounded-2xl border border-border bg-card p-5" onSubmit={e => {
        e.preventDefault(); preview.reset(); save.reset(); catalog.reset(); catalog.mutate({ url })
      }}>
        <label className="block space-y-2">URL nguồn
          <input type="url" required maxLength={2048} placeholder="https://nguon-truyen/ten-truyen/" value={url}
            onChange={e => setUrl(e.target.value)} disabled={isBusy}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
        </label>
        <p className="text-sm text-muted-foreground">Chỉ tải từ các nguồn đã được quản trị viên cấu hình. Mỗi lần lưu xử lý một chương.</p>
        <p className="text-sm text-muted-foreground">URL trang truyện: bấm “Lấy mục lục” để tải danh sách chương. “Xem chương từ URL” dùng cho đường dẫn đến một chương cụ thể.</p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isBusy || !url.trim()} isLoading={catalog.isPending}>Lấy mục lục</Button>
          <Button type="button" variant="outline" disabled={isBusy || !url.trim()} onClick={() => handlePreview(url)}>Xem chương từ URL</Button>
        </div>
      </form>
      {isBusy && <p role="status" className="text-muted-foreground">{save.isPending ? 'Đang lưu bản nháp…' : 'Đang tải mục lục hoặc nội dung chương, vui lòng chờ…'}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{crawlErrorMessage(error)}</p>}
      {catalog.data && <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Mục lục: {catalog.data.title}</h2>
        <p className="text-sm text-muted-foreground">Liên kết trên trang nguồn hiện tại. Chọn một chương để xem trước.</p>
        {catalog.data.truncated && <p role="status">Mục lục vượt 2.000 liên kết; chỉ giữ 2.000 liên kết đầu.</p>}
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {catalog.data.chapters.map(chapter => <li key={chapter.url}>
            <button type="button" disabled={isBusy} onClick={() => handleSelect(chapter.url)}
              className="w-full p-3 text-left hover:bg-secondary disabled:opacity-50">
              {chapter.title}{savedUrls.includes(chapter.url) ? ' · Đã nhập' : ''}
            </button>
          </li>)}
        </ul>
        {catalog.data.nextCursor && <Button variant="outline" disabled={isBusy} onClick={handleNextCatalog}>50 chương tiếp theo</Button>}
      </section>}
      {preview.data && !chaptersLoading && !chaptersError && <CrawlerPreview key={preview.data.previewToken} preview={preview.data} defaultOrder={nextOrder}
        isBusy={isBusy || chaptersLoading || !!chaptersError} isSaved={!!save.data} onSave={handleSave} />}
      {save.data && <div role="status" className="space-y-2 rounded-lg border border-border bg-secondary p-4">
        <p>{save.data.alreadyImported ? 'URL này đã được nhập trước đó, giữ nguyên chương hiện có.' : 'Đã lưu bản nháp thành công.'}</p>
        <Link className="text-link underline" to={`/author/stories/${storyId}/chapters/${save.data.chapterId}/edit`}>Mở chương {save.data.order}: {save.data.title}</Link>
      </div>}
    </div>
  )
}

export default function CrawlerImportPage() {
  const { storyId = '' } = useParams<{ storyId: string }>()
  const user = useAuthStore(state => state.user)
  const { data: story, isLoading, error } = useStoryById(storyId)
  const isApproved = user?.role === 'admin' || (user?.role === 'author' && user.authorStatus === 'approved')
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-foreground sm:px-6">
        <Link className="text-link hover:underline" to={`/author/stories/${storyId}/chapters`}>← Quản lý chương</Link>
        {!isApproved ? <p role="alert">Tài khoản tác giả cần được duyệt để nhập chương.</p>
          : isLoading ? <p role="status">Đang tải truyện…</p>
          : error ? <p role="alert">{crawlErrorMessage(error)}</p>
          : story ? <CrawlerWorkspace key={story._id} storyId={story._id} title={story.title} />
          : <p role="alert">Không tìm thấy truyện.</p>}
      </div>
    </AppLayout>
  )
}
