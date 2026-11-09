import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import type { CrawlerJobSource } from '@/types/crawler-job'
import { crawlerIssueMessage } from '../utils/crawlerJobPresentation'
import CrawlerJobProgress from './CrawlerJobProgress'

interface CrawlerJobSourcesProps { sources: CrawlerJobSource[] }

export default function CrawlerJobSources({ sources }: CrawlerJobSourcesProps) {
  return <section className="space-y-3" aria-labelledby="sources-title">
    <h3 id="sources-title" className="text-lg font-semibold">Thông tin và phạm vi nguồn</h3>
    <ol className="space-y-3">
      {sources.map((source, index) => <li key={`${index}-${source.url}`} className="min-w-0 space-y-3 rounded-xl border border-border p-4">
        <div><h4 className="font-semibold">Nguồn {index + 1}: {source.skipReason ? 'Đã bỏ qua' : source.metadata?.title || (source.discovery.complete ? 'Truyện đã có' : 'Đang lấy thông tin')}</h4>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm text-link underline">{source.url}</a></div>
        {source.skipReason === 'CRAWLER_STORY_EXISTS' ? <div role="status" className="space-y-2 rounded-lg bg-secondary p-3 text-sm">
          <Badge variant="secondary">Truyện đã có trên hệ thống · Bỏ qua nguồn</Badge>
          <p>Đợt nhập tiếp tục với các nguồn khác.</p>
        </div> : <>
        {source.reusedExisting && <div role="status" className="space-y-2 rounded-lg bg-secondary p-3 text-sm">
          <Badge variant="secondary">Đã nhận diện truyện có sẵn</Badge>
          <p>URL nguồn này đã liên kết với truyện bạn quản lý. Nhập các chương còn thiếu và giữ nguyên thông tin truyện.</p>
        </div>}
        <p className="text-sm text-muted-foreground">{source.destination === 'new' && !source.reusedExisting ? 'Tạo truyện mới' : 'Nhập vào truyện đã có'} · Vị trí {source.from}–{source.to ?? 2000} · Số chương đích bắt đầu: {source.startOrder}</p>
        <p className="text-sm">Đã đọc {source.discovery.pageCount} trang mục lục, tìm thấy {source.discovery.chapterCount} chương. {source.discovery.complete ? 'Đã lấy xong phạm vi đã chọn.' : 'Chưa lấy xong phạm vi đã chọn.'}</p>
        {source.counters && source.counters.total > 0 && <div role="group" aria-label={`Kết quả nhập nguồn ${index + 1}`} className="space-y-3">
          <p className="text-sm font-medium">Kế hoạch: {source.counters.total} chương</p>
          <CrawlerJobProgress label={`Tiến độ nhập nguồn ${index + 1}`} value={source.counters.succeeded + source.counters.skipped + source.counters.failed} max={source.counters.total} />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Đã nhập</dt><dd className="font-semibold">{source.counters.succeeded}</dd></div>
            <div><dt className="text-muted-foreground">Bỏ qua</dt><dd className="font-semibold">{source.counters.skipped}</dd></div>
            <div><dt className="text-muted-foreground">Chương lỗi</dt><dd className="font-semibold text-destructive">{source.counters.failed}</dd></div>
            <div><dt className="text-muted-foreground">Chờ nhập</dt><dd className="font-semibold">{source.counters.pending}</dd></div>
          </dl>
        </div>}
        {source.metadata && <details className="text-sm">
          <summary className="cursor-pointer text-link">Xem thông tin truyện từ nguồn</summary>
          <div className="mt-3 space-y-2">
            <p>Tác giả gốc: {source.metadata.originalAuthor || 'Chưa rõ tác giả'}</p>
            <p>Nguồn: {source.metadata.sourceName || 'Sưu tầm'}</p>
            {source.metadata.genres?.length ? <p>Thể loại nguồn: {source.metadata.genres.join(', ')}</p> : null}
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{source.metadata.description}</p>
          </div>
        </details>}
        {source.warning && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{crawlerIssueMessage(source.warning)}</p>}
        {source.errorCode && <p role="alert" className="text-sm text-destructive">{crawlerIssueMessage(source.errorCode)}</p>}
        {source.storyId && <Link to={`/author/stories/${source.storyId}/chapters`} className="inline-block text-sm text-link underline">Quản lý chương nguồn {index + 1}</Link>}
        </>}
      </li>)}
    </ol>
  </section>
}
