import React from 'react'
import { X, Sun, Moon, RotateCcw, AlignLeft, AlignJustify, Droplets, Coffee } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import type { ReaderContainerWidth } from '@/features/reader-settings/store/readerSettingsStore'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface ReaderSettingsModalProps {
  open: boolean
  onClose: () => void
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({ open, onClose }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open, onClose, containerRef: dialogRef })
  const { theme: appTheme, setTheme: setAppTheme, resolvedTheme } = useTheme()
  const {
    theme,
    fontFamily,
    fontSize,
    lineHeight,
    containerWidth,
    textAlign,
    setTheme,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setContainerWidth,
    setTextAlign,
    resetDefaults,
  } = useReaderSettingsStore()

  const currentTheme = ((appTheme === 'system' ? resolvedTheme : appTheme) ?? theme ?? 'light') as 'light' | 'soft-blue' | 'sepia' | 'dark'

  const handleSelectTheme = (newTheme: 'light' | 'soft-blue' | 'sepia' | 'dark') => {
    setAppTheme(newTheme)
    setTheme(newTheme)
  }

  const handleReset = () => {
    resetDefaults()
    setAppTheme('light')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        data-modal-backdrop
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-card animate-in zoom-in-95 duration-150 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 id={titleId} className="font-serif text-base font-bold text-foreground">Tùy Chỉnh Đọc Truyện</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tùy chỉnh đọc truyện"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Theme Selection (3 Themes) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Màu Nền Đọc
          </label>
          <div role="group" aria-label="Màu nền đọc" className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              aria-pressed={currentTheme === 'light'}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                currentTheme === 'light'
                  ? 'border-primary bg-secondary text-link font-bold shadow-xs'
                  : 'border-border bg-white text-[#172B4D] hover:border-primary/50'
              }`}
            >
              <Sun className="h-4 w-4 text-link" />
              <span>Sáng Trắng</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('soft-blue')}
              aria-pressed={currentTheme === 'soft-blue'}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                currentTheme === 'soft-blue'
                  ? 'border-primary bg-secondary text-link font-bold shadow-xs'
                  : 'border-border bg-[#EFF8FF] text-[#172B4D] hover:border-primary/50'
              }`}
            >
              <Droplets className="h-4 w-4 text-link" />
              <span>Xanh Dịu</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('sepia')}
              aria-pressed={currentTheme === 'sepia'}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                currentTheme === 'sepia'
                  ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold shadow-xs'
                  : 'border-border bg-[#FBF8F2] text-[#3D2B1F] hover:border-amber-400/50'
              }`}
            >
              <Coffee className="h-4 w-4" />
              <span>Giấy Kem</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              aria-pressed={currentTheme === 'dark'}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                currentTheme === 'dark'
                  ? 'border-primary bg-slate-900 text-sky-400 font-bold shadow-xs'
                  : 'border-border bg-slate-900/90 text-slate-300 hover:border-primary/50'
              }`}
            >
              <Moon className="h-4 w-4" />
              <span>Đêm Tối</span>
            </button>
          </div>
        </div>

        {/* 2. Font Family */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Phông Chữ
          </label>
          <div role="group" aria-label="Phông chữ" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFontFamily('serif')}
              aria-pressed={fontFamily === 'serif'}
              className={`p-2.5 rounded-2xl border text-xs text-center transition-all cursor-pointer ${
                fontFamily === 'serif'
                  ? 'border-primary bg-secondary text-link font-bold font-serif text-sm'
                  : 'border-border bg-surface-raised font-serif text-muted-foreground'
              }`}
            >
              Có Chân (Serif)
            </button>
            <button
              type="button"
              onClick={() => setFontFamily('sans')}
              aria-pressed={fontFamily === 'sans'}
              className={`p-2.5 rounded-2xl border text-xs text-center transition-all cursor-pointer ${
                fontFamily === 'sans'
                  ? 'border-primary bg-secondary text-link font-bold font-sans'
                  : 'border-border bg-surface-raised font-sans text-muted-foreground'
              }`}
            >
              Không Chân (Sans)
            </button>
          </div>
        </div>

        {/* 3. Font Size Slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5 text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">Cỡ Chữ</span>
            <span className="font-mono font-bold text-foreground">{fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-bold">A-</span>
            <input
              type="range"
              aria-label="Cỡ chữ"
              aria-valuetext={`${fontSize} pixel`}
              min={14}
              max={26}
              step={2}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="min-w-0 flex-1 accent-primary cursor-pointer h-6 bg-surface-raised rounded-full"
            />
            <span className="text-sm font-bold text-foreground">A+</span>
          </div>
        </div>

        {/* 4. Line Height Presets */}
        <div>
          <div className="flex justify-between items-center mb-1.5 text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">Giãn Dòng</span>
            <span className="font-mono font-bold text-foreground">{lineHeight}x</span>
          </div>
          <div role="group" aria-label="Giãn dòng" className="grid grid-cols-4 gap-1.5">
            {[1.6, 1.75, 1.9, 2.0].map((lh) => (
              <button
                key={lh}
                type="button"
                onClick={() => setLineHeight(lh)}
                aria-pressed={lineHeight === lh}
                className={`py-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                  lineHeight === lh
                  ? 'border-primary bg-primary text-primary-foreground font-bold'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                }`}
              >
                {lh}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Container Width & Text Alignment */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Khung Đọc
            </label>
            <div role="group" aria-label="Khung đọc" className="flex rounded-xl border border-border bg-surface-raised p-0.5 text-xs">
              {(['narrow', 'normal', 'wide'] as ReaderContainerWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setContainerWidth(w)}
                  aria-pressed={containerWidth === w}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                    containerWidth === w
                      ? 'bg-card text-link font-bold shadow-xs'
                      : 'text-muted-foreground'
                  }`}
                >
                  {w === 'narrow' ? 'Gọn' : w === 'normal' ? 'Vừa' : 'Rộng'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Căn Lề
            </label>
            <div role="group" aria-label="Căn lề" className="flex rounded-xl border border-border bg-surface-raised p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                aria-pressed={textAlign === 'left'}
                aria-label="Căn trái"
                className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  textAlign === 'left' ? 'bg-card text-link font-bold shadow-xs' : 'text-muted-foreground'
                }`}
                title="Căn trái"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('justify')}
                aria-pressed={textAlign === 'justify'}
                aria-label="Căn đều hai bên"
                className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  textAlign === 'justify' ? 'bg-card text-link font-bold shadow-xs' : 'text-muted-foreground'
                }`}
                title="Căn đều 2 bên"
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Reset */}
        <div className="pt-2 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-link transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Mặc định ban đầu</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReaderSettingsModal
