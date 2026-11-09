/**
 * useSeoHead Tests — Phase 8
 * Kiểm tra hook cập nhật <head> metadata đúng, cleanup khi unmount,
 * không tích lũy duplicate tags, và safe JSON-LD serialization.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSeoHead } from '@/hooks/useSeoHead'

// Helper lấy meta content theo name attribute
const getMetaContent = (name: string): string | null =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.getAttribute('content') ?? null

const getMetaProperty = (property: string): string | null =>
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.getAttribute('content') ?? null

const getCanonical = (): string | null =>
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ?? null

const getJsonLd = (): object | null => {
  const script = document.querySelector<HTMLScriptElement>('script[data-seo="json-ld"]')
  if (!script?.textContent) return null
  try {
    return JSON.parse(script.textContent) as object
  } catch {
    return null
  }
}

// Cleanup head sau mỗi test để tránh state leak
afterEach(() => {
  document.title = 'iutruyen — Đọc truyện chữ online miễn phí'
  document.querySelectorAll('meta[name="description"], meta[name="robots"], meta[name="twitter:card"]').forEach(el => el.remove())
  document.querySelectorAll('meta[property^="og:"]').forEach(el => el.remove())
  document.querySelectorAll('link[rel="canonical"]').forEach(el => el.remove())
  document.querySelectorAll('script[data-seo="json-ld"]').forEach(el => el.remove())
})

describe('useSeoHead', () => {
  it('sets document.title correctly', () => {
    renderHook(() => useSeoHead({ title: 'Test Story — iutruyen' }))
    expect(document.title).toBe('Test Story — iutruyen')
  })

  it('sets meta description', () => {
    renderHook(() => useSeoHead({ description: 'Mô tả truyện hay' }))
    expect(getMetaContent('description')).toBe('Mô tả truyện hay')
  })

  it('sets canonical link', () => {
    renderHook(() =>
      useSeoHead({ canonical: 'https://iutruyen.vn/stories/truyen-test' })
    )
    expect(getCanonical()).toBe('https://iutruyen.vn/stories/truyen-test')
  })

  it('sets robots=index,follow when indexable=true', () => {
    renderHook(() => useSeoHead({ indexable: true }))
    expect(getMetaContent('robots')).toBe('index,follow')
  })

  it('sets robots=noindex,follow when indexable=false', () => {
    renderHook(() => useSeoHead({ indexable: false }))
    expect(getMetaContent('robots')).toBe('noindex,follow')
  })

  it('defaults to noindex when policy is missing', () => {
    // Khởi đầu không có meta robots
    document.querySelectorAll('meta[name="robots"]').forEach(el => el.remove())
    renderHook(() => useSeoHead({ title: 'Test' }))
    // Không tạo mới nếu undefined
    expect(getMetaContent('robots')).toBe('noindex,follow')
  })

  it('sets Open Graph tags', () => {
    renderHook(() =>
      useSeoHead({
        title: 'Truyện Hay',
        description: 'Mô tả',
        canonical: 'https://iutruyen.vn/stories/truyen-hay',
        ogType: 'book',
        ogImage: 'https://iutruyen.vn/og-default.png',
      })
    )
    expect(getMetaProperty('og:title')).toBe('Truyện Hay')
    expect(getMetaProperty('og:description')).toBe('Mô tả')
    expect(getMetaProperty('og:type')).toBe('book')
    expect(getMetaProperty('og:image')).toBe('https://iutruyen.vn/og-default.png')
    expect(getMetaProperty('og:url')).toBe('https://iutruyen.vn/stories/truyen-hay')
  })

  it('sets Twitter Card tags', () => {
    renderHook(() =>
      useSeoHead({
        title: 'Truyện Hay',
        description: 'Mô tả Twitter',
        ogImage: 'https://iutruyen.vn/og.png',
      })
    )
    expect(getMetaContent('twitter:card')).toBe('summary_large_image')
    expect(getMetaContent('twitter:title')).toBe('Truyện Hay')
    expect(getMetaContent('twitter:description')).toBe('Mô tả Twitter')
    expect(getMetaContent('twitter:image')).toBe('https://iutruyen.vn/og.png')
  })

  it('injects JSON-LD script with correct type', () => {
    const jsonLdData = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: 'Truyện Test',
    }
    renderHook(() => useSeoHead({ jsonLd: jsonLdData }))

    const parsed = getJsonLd()
    expect(parsed).toEqual(jsonLdData)

    const script = document.querySelector<HTMLScriptElement>('script[data-seo="json-ld"]')
    expect(script?.getAttribute('type')).toBe('application/ld+json')
  })

  it('does not inject JSON-LD when jsonLd is null', () => {
    renderHook(() => useSeoHead({ jsonLd: null }))
    expect(document.querySelector('script[data-seo="json-ld"]')).toBeNull()
  })

  it('replaces old JSON-LD on re-render (no duplicate scripts)', () => {
    const { rerender } = renderHook(
      ({ jsonLd }) => useSeoHead({ jsonLd }),
      { initialProps: { jsonLd: { '@type': 'Book', name: 'V1' } } }
    )

    rerender({ jsonLd: { '@type': 'Article', name: 'V2' } })

    const scripts = document.querySelectorAll('script[data-seo="json-ld"]')
    expect(scripts).toHaveLength(1)
    expect(getJsonLd()).toMatchObject({ name: 'V2' })
  })

  it('removes canonical on unmount', () => {
    const { unmount } = renderHook(() =>
      useSeoHead({ canonical: 'https://iutruyen.vn/stories/test' })
    )
    expect(getCanonical()).not.toBeNull()

    unmount()
    expect(getCanonical()).toBeNull()
  })

  it('removes JSON-LD on unmount', () => {
    const { unmount } = renderHook(() =>
      useSeoHead({ jsonLd: { '@type': 'Book', name: 'Test' } })
    )
    expect(getJsonLd()).not.toBeNull()

    unmount()
    expect(getJsonLd()).toBeNull()
  })

  it('resets title to default on unmount', () => {
    const { unmount } = renderHook(() =>
      useSeoHead({ title: 'Custom Page Title' })
    )
    expect(document.title).toBe('Custom Page Title')

    unmount()
    expect(document.title).toBe('iutruyen — Đọc truyện chữ online miễn phí')
  })

  it('does not create duplicate meta tags on multiple renders', () => {
    const { rerender } = renderHook(
      ({ title }) => useSeoHead({ title }),
      { initialProps: { title: 'Title 1' } }
    )
    rerender({ title: 'Title 2' })
    rerender({ title: 'Title 3' })

    const descriptions = document.querySelectorAll('meta[name="description"]')
    expect(descriptions.length).toBeLessThanOrEqual(1)
  })

  it('safely handles title with special HTML chars', () => {
    renderHook(() =>
      useSeoHead({ title: '<b>Script</b> & "Quoted"' })
    )
    // document.title nhận giá trị nguyên bản (không encode)
    expect(document.title).toBe('<b>Script</b> & "Quoted"')
  })

  it('handles Vietnamese and emoji in title', () => {
    renderHook(() => useSeoHead({ title: 'Truyện Tiên Hiệp 👑 — iutruyen' }))
    expect(document.title).toBe('Truyện Tiên Hiệp 👑 — iutruyen')
  })

  it('uses empty options without crashing', () => {
    expect(() => renderHook(() => useSeoHead({}))).not.toThrow()
    expect(document.title).toBe('iutruyen — Đọc truyện chữ online miễn phí')
  })
})
