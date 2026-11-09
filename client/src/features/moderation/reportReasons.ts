export const CONTENT_REPORT_REASONS = [
  { value: 'inappropriate_content', label: 'Nội dung không phù hợp (18+, nhạy cảm)' },
  { value: 'violence', label: 'Bạo lực, máu me quá mức' },
  { value: 'copyright', label: 'Vi phạm bản quyền' },
  { value: 'spam', label: 'Spam hoặc quảng cáo' },
  { value: 'hate_speech', label: 'Ngôn từ thù địch, kỳ thị' },
]

export const CHAPTER_REPORT_REASONS = [
  { value: 'typo', label: 'Lỗi chính tả / dịch thuật' },
  { value: 'missing_content', label: 'Thiếu nội dung chương' },
  { value: 'duplicate_content', label: 'Nội dung bị lặp' },
  { value: 'wrong_chapter', label: 'Sai chương / sai thứ tự' },
  { value: 'display_error', label: 'Lỗi hiển thị / định dạng' },
]

export const OTHER_REPORT_REASON = { value: 'other', label: 'Lý do khác' }

export const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  [...CONTENT_REPORT_REASONS, ...CHAPTER_REPORT_REASONS, OTHER_REPORT_REASON]
    .map(({ value, label }) => [value, label])
)
