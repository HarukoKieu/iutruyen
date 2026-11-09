import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { browserStorage } from '@/lib/browserStorage'

export type ReaderTheme = 'light' | 'soft-blue' | 'sepia' | 'dark'
export type ReaderFontFamily = 'serif' | 'sans'
export type ReaderContainerWidth = 'narrow' | 'normal' | 'wide'
export type ReaderTextAlign = 'left' | 'justify'

interface ReaderSettingsState {
  theme: ReaderTheme
  fontFamily: ReaderFontFamily
  fontSize: number
  lineHeight: number
  containerWidth: ReaderContainerWidth
  textAlign: ReaderTextAlign

  setTheme: (theme: ReaderTheme) => void
  setFontFamily: (font: ReaderFontFamily) => void
  setFontSize: (size: number) => void
  increaseFontSize: () => void
  decreaseFontSize: () => void
  setLineHeight: (lineHeight: number) => void
  setContainerWidth: (width: ReaderContainerWidth) => void
  setTextAlign: (align: ReaderTextAlign) => void
  resetDefaults: () => void
}

const DEFAULT_SETTINGS = {
  theme: 'light' as ReaderTheme,
  fontFamily: 'serif' as ReaderFontFamily,
  fontSize: 18,
  lineHeight: 1.9,
  containerWidth: 'normal' as ReaderContainerWidth,
  textAlign: 'left' as ReaderTextAlign,
}

export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setTheme: (theme) => set({ theme }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize: Math.min(Math.max(fontSize, 14), 26) }),
      increaseFontSize: () =>
        set((state) => ({ fontSize: Math.min(state.fontSize + 2, 26) })),
      decreaseFontSize: () =>
        set((state) => ({ fontSize: Math.max(state.fontSize - 2, 14) })),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setContainerWidth: (containerWidth) => set({ containerWidth }),
      setTextAlign: (textAlign) => set({ textAlign }),
      resetDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      skipHydration: true,
      storage: createJSONStorage(() => browserStorage),
      name: 'novel_reader_settings',
    }
  )
)
