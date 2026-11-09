import type { CrawlerJobStatus, CrawlerTaskStatus } from '@/types/crawler-job'

export const crawlerJobLabels: Record<CrawlerJobStatus, string> = {
  planning: 'Đang lấy mục lục', ready: 'Chờ xác nhận', queued: 'Đang chờ nhập', running: 'Đang nhập', paused: 'Đã tạm dừng',
  completed: 'Hoàn tất', completed_with_errors: 'Hoàn tất, có chương lỗi', failed: 'Không hoàn tất', cancelled: 'Đã hủy',
}
export const crawlerTaskLabels: Record<CrawlerTaskStatus, string> = {
  pending: 'Chờ nhập', succeeded: 'Đã nhập', skipped: 'Bỏ qua', failed: 'Lỗi',
}
export const isCrawlerJobTerminal = (status: CrawlerJobStatus) => ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(status)
export const isCrawlerJobWorking = (status: CrawlerJobStatus) => ['planning', 'queued', 'running'].includes(status)

const messages: Record<string, string> = {
  CHAPTER_ORDER_EXISTS: 'Số chương đích đã có nội dung. Đã bỏ qua vị trí này và giữ nguyên chương hiện tại.',
  CRAWLER_UPSTREAM_RATE_LIMITED: 'Nguồn đang giới hạn lượt tải. Đợt nhập sẽ tự tiếp tục sau thời gian chờ.',
  CRAWLER_UPSTREAM_UNAVAILABLE: 'Nguồn đang tạm gián đoạn. Đợt nhập sẽ tự thử lại.',
  CRAWLER_STORAGE_UNAVAILABLE: 'Lưu trữ đang tạm gián đoạn. Tiến độ được giữ, đợt nhập sẽ tự tiếp tục.',
  CRAWLER_PAGINATION_LOOP: 'Nguồn lặp lại một trang mục lục. Đã dừng để bạn kiểm tra.',
  CRAWLER_PAGINATION_LIMIT: 'Nguồn vượt giới hạn 100 trang mục lục. Thu hẹp phạm vi hoặc kiểm tra nguồn.',
  CRAWLER_PAGINATION_URL: 'Liên kết trang mục lục tiếp theo không thuộc nguồn được phép.',
  CRAWLER_CATALOG_LIMIT: 'Chưa xác định được đầy đủ phạm vi đã chọn vì trang mục lục vượt giới hạn liên kết. Thu hẹp phạm vi nhập hoặc kiểm tra nguồn.',
  CRAWLER_BATCH_LIMIT: 'Đợt nhập vượt giới hạn 10.000 chương. Thu hẹp phạm vi hoặc chia thành các đợt nhỏ hơn.',
  CRAWLER_RANGE_EMPTY: 'Không tìm thấy chương trong phạm vi đã chọn. Kiểm tra vị trí trong mục lục.',
  CRAWLER_STORY_VALIDATION: 'Thông tin nguồn chưa đủ để tạo truyện mới. Tạo truyện trước, sau đó chọn làm đích nhập.',
  CRAWLER_SOURCE_DISABLED: 'Nguồn này chưa được cấu hình để nhập.',
  CRAWLER_SOURCE_BUSY: 'Nguồn đang xử lý yêu cầu khác. Đợt nhập sẽ tiếp tục khi nguồn sẵn sàng.',
  CRAWLER_QUOTA: 'Đang chờ lượt tải tiếp theo. Tiến độ được giữ nguyên.',
  CRAWLER_SOURCE_RESPONSE: 'Trang nguồn trả phản hồi không thể sử dụng. Kiểm tra nguồn rồi thử lại.',
  CHAPTER_ORDER_CONFLICT: 'Số chương đích đã được sử dụng. Chương hiện có được giữ nguyên.',
  CRAWLER_PERMISSION_CHANGED: 'Quyền nhập truyện đã thay đổi. Kiểm tra tài khoản và quyền quản lý truyện.',
  CRAWLER_CATALOG_INCOMPLETE: 'Chưa lấy xong mục lục. Kiểm tra lỗi nguồn trước khi bắt đầu nhập.',
  CRAWLER_INDEXES_MISSING: 'Chức năng nhập chưa sẵn sàng. Quản trị viên cần hoàn tất thiết lập.',
  CRAWLER_EMPTY_CHAPTER: 'Trang nguồn không có nội dung chương có thể nhập.',
  CRAWLER_CATALOG_URL: 'URL này là trang mục lục, cần chọn liên kết của một chương.',
  CRAWLER_CATALOG_SINGLE_PAGE: 'Nguồn chưa hỗ trợ lấy các trang mục lục tiếp theo. Đợt này chỉ dùng trang đã cung cấp.',
  CRAWLER_CATALOG_TRUNCATED: 'Mục lục vượt giới hạn. Chỉ các chương trong phạm vi đã tìm thấy được đưa vào kế hoạch.',
  CRAWLER_CATALOG_LOOP: 'Nguồn lặp lại một trang mục lục. Đã dừng để bạn kiểm tra.',
  CRAWLER_EMPTY_CATALOG: 'Không tìm thấy mục lục. Kiểm tra URL trang truyện hoặc cấu hình nguồn.',
  CRAWLER_EMPTY_STORY: 'Nguồn thiếu thông tin để tạo truyện mới. Chọn một truyện đã có hoặc kiểm tra nguồn.',
  CRAWLER_SOURCE_NOT_ALLOWED: 'Nguồn này chưa được cấu hình để nhập.',
  CRAWLER_ORDER_CONFLICT: 'Số chương đích đã được sử dụng. Chương hiện có được giữ nguyên.',
  CRAWLER_ROBOTS_DENIED: 'Nguồn không cho phép lấy trang này.',
  CRAWLER_FETCH_FAILED: 'Không tải được trang nguồn sau các lần thử lại.',
}
export const crawlerIssueMessage = (code: string) => messages[code] || (/^[A-Z][A-Z0-9_]+$/.test(code) ? 'Không xử lý được nguồn. Kiểm tra quyền nhập và nguồn, sau đó thử lại phần lỗi.' : code)
