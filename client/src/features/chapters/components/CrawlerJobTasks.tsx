import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { CrawlerJob, CrawlerTaskStatus } from '@/types/crawler-job'
import { useCrawlerJobTasks } from '../hooks/useCrawlerJobs'
import { crawlErrorMessage } from '../api/crawler.api'
import { crawlerIssueMessage, crawlerTaskLabels } from '../utils/crawlerJobPresentation'

interface CrawlerJobTasksProps { actorId: string; job: CrawlerJob }

export default function CrawlerJobTasks({ actorId, job }: CrawlerJobTasksProps) {
  const [filter, setFilter] = useState<CrawlerTaskStatus | ''>('')
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const tasks = useCrawlerJobTasks(actorId, job.id, job.status, filter || undefined, cursors[pageIndex])
  const rows = tasks.data?.tasks ?? []
  return <section className="space-y-4" aria-labelledby="tasks-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 id="tasks-title" className="text-lg font-semibold">Chương trong kế hoạch</h3>
        <p className="mt-1 text-sm text-muted-foreground">Mở liên kết nguồn để kiểm tra chương trước khi bắt đầu. Mỗi lượt hiển thị 50 chương.</p></div>
      <label className="text-sm font-medium">Lọc chương
        <select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setCursors([undefined]); setPageIndex(0) }} className="ml-2 rounded-lg border border-border bg-background px-3 py-2">
          <option value="">Tất cả</option>
          {Object.entries(crawlerTaskLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    {tasks.isLoading && <p role="status" className="text-sm text-muted-foreground">Đang tải danh sách chương…</p>}
    {tasks.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{crawlErrorMessage(tasks.error)}</p>
      <Button variant="outline" isLoading={tasks.isFetching} onClick={() => void tasks.refetch()}>Thử tải chương lại</Button></div>}
    {!tasks.isLoading && !tasks.error && !rows.length && <p className="text-sm text-muted-foreground">{job.sources.length > 0 && job.sources.every(source => source.skipReason === 'CRAWLER_STORY_EXISTS') ? 'Các nguồn trong đợt này đều đã có trên hệ thống nên được bỏ qua.' : job.status === 'planning' ? 'Kế hoạch đang lấy mục lục. Các chương tìm được sẽ xuất hiện ở đây.' : 'Không có chương phù hợp với bộ lọc.'}</p>}
    <ul className="space-y-3">
      {rows.map(task => {
        const storyId = job.sources[task.sourceIndex]?.storyId
        return <li key={task.id} className="min-w-0 space-y-2 rounded-xl border border-border p-4">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{task.title}</span>
            <span className={`text-sm ${task.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{crawlerTaskLabels[task.status]}</span></div>
          <p className="text-sm text-muted-foreground">Nguồn {task.sourceIndex + 1} · Vị trí {task.position} → Chương đích {task.order} · Số lần gặp lỗi: {task.attempts}</p>
          <a href={task.url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-link underline">Mở chương tại nguồn</a>
          {task.status === 'skipped' && !task.errorCode && <p className="text-sm text-muted-foreground">URL chương này đã có trong truyện. Giữ nguyên nội dung hiện tại.</p>}
          {task.errorCode && <p className={`text-sm ${task.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{crawlerIssueMessage(task.errorCode)}</p>}
          {storyId && task.chapterId && <Link to={`/author/stories/${storyId}/chapters/${task.chapterId}/edit`} className="inline-block text-sm text-link underline">Sửa chương đích {task.order}</Link>}
        </li>
      })}
    </ul>
    <div className="flex flex-wrap items-center gap-3">
      {pageIndex > 0 && <><Button variant="outline" disabled={tasks.isFetching} onClick={() => setPageIndex(previous => previous - 1)}>50 chương trước</Button>
        <Button variant="outline" disabled={tasks.isFetching} onClick={() => setPageIndex(0)}>Về đầu danh sách</Button></>}
      {tasks.data?.meta.hasMore && tasks.data.meta.nextCursor && <Button variant="outline" disabled={tasks.isFetching} onClick={() => {
        const nextCursor = tasks.data.meta.nextCursor ?? undefined
        setCursors(previous => [...previous.slice(0, pageIndex + 1), nextCursor]); setPageIndex(previous => previous + 1)
      }}>50 chương tiếp theo</Button>}
    </div>
  </section>
}
