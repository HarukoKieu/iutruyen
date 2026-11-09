import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { crawlerApi, crawlErrorMessage, type CrawlImportInput } from '../api/crawler.api'

/** Crawl one source page at a time and invalidate the chapter list after saving. */
export function useCrawler(storyId: string) {
  const client = useQueryClient()
  const onError = (error: unknown) => toast.error(crawlErrorMessage(error))
  const catalog = useMutation({
    mutationFn: (input: { url: string; cursor?: string }) => crawlerApi.catalog(storyId, input), onError,
  })
  const preview = useMutation({ mutationFn: (url: string) => crawlerApi.preview(storyId, url), onError })
  const save = useMutation({
    mutationFn: (input: CrawlImportInput) => crawlerApi.importChapter(storyId, input), onError,
    onSuccess: result => {
      client.invalidateQueries({ queryKey: ['chapters', storyId] })
      toast.success(result.alreadyImported ? 'Chương này đã được nhập trước đó.' : 'Đã lưu chương vào bản nháp.')
    },
  })
  return { catalog, preview, save, isBusy: catalog.isPending || preview.isPending || save.isPending }
}
