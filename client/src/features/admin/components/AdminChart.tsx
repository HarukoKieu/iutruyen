import type { Chart } from '../types'

export default function AdminChart({ chart }: { chart: Chart }) {
  const maximum = Math.max(1, ...chart.points.map(point => point.value ?? 0))
  const width = 600, height = 160

  return (
    <section aria-label="Biểu đồ theo ngày" className="space-y-4">
      <p className="text-xs sm:text-sm text-muted-foreground">
        {chart.metric === 'views'
          ? 'Mẫu bộ đếm chương còn lưu, lấy mẫu cuối ngày UTC; có thể giảm khi xóa dữ liệu. Không phải lượt đọc/ngày. Ngày chưa có mẫu để trống.'
          : 'Số bản ghi tạo mới theo ngày UTC.'}
      </p>

      {/* SVG Bar Chart with Guide Markers */}
      <div className="relative rounded-xl border border-border bg-surface-raised/30 p-3 sm:p-4 overflow-hidden">
        <svg
          role="img"
          aria-label="Các giá trị theo ngày; bảng số liệu bên dưới"
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full text-indigo-500 overflow-visible"
        >
          {/* Subtle horizontal grid lines */}
          <line x1="0" y1="20" x2={width} y2="20" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
          <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" strokeOpacity="0.15" />

          {/* Render bar rects */}
          {chart.points.map((point, index) => {
            if (point.value === null) return null
            const barHeight = Math.max(2, (point.value / maximum) * (height - 24))
            const barWidth = Math.max(2, width / chart.points.length - 2)
            const x = (index * width) / chart.points.length
            const y = height - barHeight

            return (
              <rect
                key={point.date}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="2"
                ry="2"
                fill="currentColor"
                className="transition-all duration-150 hover:opacity-80 hover:text-indigo-400 cursor-pointer"
              >
                <title>{`${point.date}: ${point.value.toLocaleString('vi-VN')}`}</title>
              </rect>
            )
          })}
        </svg>

        {/* Date range edge labels */}
        {chart.points.length > 0 && (
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground font-mono">
            <span>{chart.points[0]?.date}</span>
            <span>{chart.points[Math.floor(chart.points.length / 2)]?.date}</span>
            <span>{chart.points[chart.points.length - 1]?.date}</span>
          </div>
        )}
      </div>

      {/* Accessible data table disclosure */}
      <details className="group rounded-xl border border-border bg-surface-raised/40 p-3 text-sm transition-colors">
        <summary className="cursor-pointer font-medium text-xs sm:text-sm text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-between select-none">
          <span>Bảng số liệu UTC ({chart.points.length} ngày)</span>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Số liệu theo ngày</caption>
            <thead className="bg-surface-raised sticky top-0 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th scope="col" className="p-2 sm:p-2.5">Ngày</th>
                <th scope="col" className="p-2 sm:p-2.5 text-right">Giá trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chart.points.map(point => (
                <tr key={point.date} className="hover:bg-surface-hover/50">
                  <td className="p-2 sm:p-2.5 font-mono">{point.date}</td>
                  <td className="p-2 sm:p-2.5 text-right font-mono font-medium">
                    {point.value === null ? 'Chưa có mẫu' : point.value.toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

