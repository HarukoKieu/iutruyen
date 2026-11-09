import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { UpdateStoryInput } from '@/types/story'
import { crawlerApi, crawlErrorMessage } from '../api/crawler.api'
import CrawlerStoryPreview from './CrawlerStoryPreview'

interface CrawlerNewStoryProps {
  isBusy: boolean
  onApply: (input: UpdateStoryInput, sourceUrl: string) => void
  onSourceChange?: () => void
}

export default function CrawlerNewStory({ isBusy, onApply, onSourceChange }: CrawlerNewStoryProps) {
  const [url, setUrl] = useState('')
  const [applied, setApplied] = useState(false)
  const metadata = useMutation({ mutationFn: crawlerApi.metadata })
  const isExistingSource = isAxiosError(metadata.error) && metadata.error.response?.data?.code === 'CRAWLER_STORY_EXISTS'
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="text-lg font-semibold">Lấy truyện từ website khác</h2>
    <p className="text-sm text-muted-foreground">Dán URL trang giới thiệu truyện để lấy tên, giới thiệu, tác giả gốc, thể loại, trạng thái và ảnh bìa. Chỉ hỗ trợ nguồn đã được cấu hình.</p>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      if (!isBusy && !metadata.isPending && url.trim()) { setApplied(false); metadata.mutate(url.trim()) }
    }}>
      <label className="block">URL truyện nguồn
        <input type="url" required maxLength={2048} value={url} disabled={isBusy || metadata.isPending}
          onChange={event => { setUrl(event.target.value); metadata.reset(); setApplied(false); onSourceChange?.() }}
          placeholder="https://nguon-truyen/ten-truyen/" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2" />
      </label>
      <Button type="submit" disabled={isBusy || metadata.isPending || !url.trim()} isLoading={metadata.isPending}>Lấy thông tin truyện</Button>
    </form>
    {metadata.isPending && <p role="status">Đang tải thông tin và ảnh bìa…</p>}
    {metadata.error && <p role="alert" className="text-destructive">{crawlErrorMessage(metadata.error)}</p>}
    {isExistingSource && <Link to="/author/crawl" state={{ sourceUrl: metadata.variables }} className="inline-block text-sm font-medium text-link underline">Nhập các chương còn thiếu</Link>}
    {metadata.data && !metadata.isPending && !metadata.error && <CrawlerStoryPreview key={metadata.submittedAt}
      destinationTitle="Truyện mới" sourceUrl={metadata.data.sourceUrl} metadata={metadata.data.story} isBusy={isBusy}
      onApply={input => { onApply(input, metadata.data!.sourceUrl); setApplied(true) }} />}
    {applied && <p role="status">Đã điền thông tin vào form bên dưới. Kiểm tra thể loại rồi bấm Tạo truyện. Sau đó bạn có thể nhập các chương từ nguồn.</p>}
  </section>
}
