import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useCrawlerJobs } from '../hooks/useCrawlerJobs'
import { crawlErrorMessage } from '../api/crawler.api'
import { crawlerJobLabels } from '../utils/crawlerJobPresentation'

interface CrawlerJobListProps { actorId: string; selectedId: string; onSelect: (id: string) => void }

export default function CrawlerJobList({ actorId, selectedId, onSelect }: CrawlerJobListProps) {
  const jobs = useCrawlerJobs(actorId)
  const client = useQueryClient()
  const rows = jobs.data?.pages.flatMap(page => page.jobs) ?? []
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="jobs-title">
    <h2 id="jobs-title" className="font-serif text-xl font-bold">Các đợt nhập của bạn</h2>
    <p className="text-sm text-muted-foreground">Hiển thị tối đa 60 đợt đã tải. Bạn có thể về đầu danh sách để xem các đợt mới nhất.</p>
    {jobs.isLoading && <p role="status" className="text-muted-foreground">Đang tải các đợt nhập…</p>}
    {jobs.error && <div role="alert" className="space-y-3 text-sm text-destructive"><p>{crawlErrorMessage(jobs.error)}</p>
      <Button variant="outline" isLoading={jobs.isFetching} onClick={() => void jobs.refetch()}>Thử tải đợt nhập lại</Button></div>}
    {!jobs.isLoading && !jobs.error && rows.length === 0 && <p className="text-sm text-muted-foreground">Chưa có đợt nhập nào. Thêm nguồn truyện để chuẩn bị kế hoạch.</p>}
    <ul className="space-y-3">
      {rows.map(job => <li key={job.id}>
        <button type="button" aria-pressed={selectedId === job.id} onClick={() => onSelect(job.id)}
          className={`w-full min-w-0 space-y-1 rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === job.id ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary'}`}>
          <span className="block font-semibold">{job.sources[0]?.metadata?.title || `Đợt nhập ${new Date(job.createdAt).toLocaleString('vi-VN')}`}</span>
          <span className="block text-sm text-muted-foreground">{crawlerJobLabels[job.status]} · {job.sources.length} nguồn · {job.counters.succeeded + job.counters.skipped}/{job.counters.total} chương đã nhập hoặc có sẵn</span>
          {job.counters.failed > 0 && <span className="block text-sm text-destructive">{job.counters.failed} chương lỗi</span>}
        </button>
      </li>)}
    </ul>
    {jobs.hasNextPage && <Button variant="outline" isLoading={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()}>Tải thêm đợt nhập</Button>}
    {(jobs.data?.pages.length ?? 0) > 1 && <Button variant="outline" disabled={jobs.isFetching} onClick={() => void client.resetQueries({ queryKey: queryKeys.crawlerJobs.list(actorId) })}>Về đầu các đợt nhập</Button>}
  </section>
}
