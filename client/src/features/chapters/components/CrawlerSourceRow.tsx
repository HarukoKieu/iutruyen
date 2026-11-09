import { Button } from '@/components/ui/button'
import type { CrawlerTarget } from '@/types/crawler-job'
import type { Genre } from '@/types/genre'

export interface CrawlerSourceDraft {
  key: number
  url: string
  destination: 'existing' | 'new'
  storyId: string
  storyTitle: string
  genreIds: string[]
  from: string
  to: string
  startOrder: string
}
interface CrawlerSourceRowProps {
  row: CrawlerSourceDraft
  index: number
  stories: CrawlerTarget[]
  genres: Genre[]
  isBusy: boolean
  canRemove: boolean
  onChange: (update: Partial<CrawlerSourceDraft>) => void
  onRemove: () => void
}

export default function CrawlerSourceRow({ row, index, stories, genres, isBusy, canRemove, onChange, onRemove }: CrawlerSourceRowProps) {
  const inputClass = 'mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground'
  const hasSelectedStory = stories.some(story => story.id === row.storyId)
  return <fieldset disabled={isBusy} className="min-w-0 space-y-4 rounded-xl border border-border p-4">
    <legend className="px-2 font-semibold">Nguồn {index + 1}</legend>
    <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" disabled={!canRemove} onClick={onRemove} aria-label={`Bỏ nguồn ${index + 1}`}>Bỏ nguồn</Button></div>
    <label className="block text-sm font-medium">URL truyện nguồn {index + 1}
      <input type="url" required maxLength={2048} value={row.url} onChange={event => onChange({ url: event.target.value })}
        placeholder="https://nguon-truyen/ten-truyen/" className={inputClass} />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Đích nhập nguồn {index + 1}
        <select value={row.destination} onChange={event => onChange({ destination: event.target.value as CrawlerSourceDraft['destination'] })} className={inputClass}>
          <option value="existing">Truyện đã có</option><option value="new">Tự nhận diện hoặc tạo mới</option>
        </select>
      </label>
      {row.destination === 'existing' && <label className="block text-sm font-medium">Truyện đã có nguồn {index + 1}
        <select required value={row.storyId} onChange={event => onChange({ storyId: event.target.value, storyTitle: stories.find(story => story.id === event.target.value)?.title ?? '' })} className={inputClass}>
          <option value="">Chọn truyện của bạn</option>
          {row.storyId && !hasSelectedStory && <option value={row.storyId}>{row.storyTitle || 'Truyện đã chọn'}</option>}
          {stories.map(story => <option key={story.id} value={story.id}>{story.title}</option>)}
        </select>
      </label>}
    </div>
    {row.destination === 'new' && <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Thể loại nguồn {index + 1} (cần chọn khi truyện chưa có)</legend>
      <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto">
        {genres.map(genre => <label key={genre._id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.genreIds.includes(genre._id)} disabled={row.genreIds.length >= 20 && !row.genreIds.includes(genre._id)} onChange={event => onChange({ genreIds: event.target.checked ? [...row.genreIds, genre._id] : row.genreIds.filter(id => id !== genre._id) })} />{genre.name}
        </label>)}
      </div>
      <p className="text-sm text-muted-foreground">URL đã được nhận diện sẽ dùng truyện hiện có. Chọn ít nhất một thể loại nếu cần tạo truyện mới; tên và giới thiệu được lấy từ nguồn để bạn xem trước.</p>
    </fieldset>}
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block text-sm font-medium">Từ vị trí nguồn {index + 1}
        <input type="number" required min={1} max={2000} step={1} value={row.from} onChange={event => onChange({ from: event.target.value })} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">Đến vị trí nguồn {index + 1}
        <input type="number" min={1} max={2000} step={1} value={row.to} onChange={event => onChange({ to: event.target.value })} placeholder="Tối đa vị trí 2.000" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">Số chương đích đầu tiên nguồn {index + 1}
        <input type="number" required min={1} max={1000000} step={1} value={row.startOrder} onChange={event => onChange({ startOrder: event.target.value })} className={inputClass} />
      </label>
    </div>
    <p className="text-sm text-muted-foreground">Vị trí bắt đầu từ 1 trên trang mục lục bạn cung cấp. Để trống “Đến” dùng vị trí 2.000; hệ thống sẽ cảnh báo nếu còn chương ngoài phạm vi. Chương ở vị trí “Từ” ứng với số chương đích đầu tiên. URL hoặc số chương đích đã có sẽ được bỏ qua và giữ nguyên nội dung hiện tại.</p>
  </fieldset>
}
