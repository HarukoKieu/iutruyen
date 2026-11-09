/**
 * useSeoHead — Phase 8
 *
 * Hook cập nhật <title>, <meta> và JSON-LD trong <head> cho SPA client.
 * Hoạt động sau hydrate/mount — không thay thế SSR metadata cho bots.
 *
 * Cách dùng:
 *   useSeoHead({
 *     title: 'Tên truyện — iutruyen',
 *     description: 'Mô tả ...',
 *     canonical: 'https://iutruyen.vn/stories/tieu-thuyet',
 *     indexable: true,
 *     ogImage: '...',
 *     jsonLd: { '@context': 'https://schema.org', '@type': 'Book', ... },
 *   })
 */
import { useEffect } from 'react'

export interface SeoHeadOptions {
  title?: string
  description?: string
  canonical?: string
  /** undefined = noindex an toàn; true = index,follow; false = noindex */
  indexable?: boolean
  ogType?: 'website' | 'book' | 'article'
  ogImage?: string
  jsonLd?: object | null
}

const DEFAULT_TITLE = 'iutruyen — Đọc truyện chữ online miễn phí'
const DEFAULT_DESCRIPTION = 'iutruyen — Nền tảng đọc truyện chữ online, cập nhật nhanh nhất'
const DEFAULT_OG_IMAGE = '/og-default.png'

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function removeLink(rel: string) {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  el?.remove()
}

function setJsonLd(data: object | null) {
  // Xóa tất cả JSON-LD cũ do hook quản lý
  document.querySelectorAll('script[data-seo="json-ld"]').forEach((el) => el.remove())
  if (!data) return

  const script = document.createElement('script')
  script.setAttribute('type', 'application/ld+json')
  script.setAttribute('data-seo', 'json-ld')
  // Safe serialize: escape </script> breakout
  script.textContent = JSON.stringify(data)
    .replace(/</g, '\\u003c')
  document.head.appendChild(script)
}

export function useSeoHead(options: SeoHeadOptions = {}) {
  const {
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    canonical,
    indexable = false,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
    jsonLd = null,
  } = options

  useEffect(() => {
    // Title
    document.title = title

    // Description
    setMeta('description', description)

    // Robots
    if (indexable !== undefined) {
      setMeta('robots', indexable ? 'index,follow' : 'noindex,follow')
    }

    // Canonical
    if (canonical) {
      setLink('canonical', canonical)
    } else {
      removeLink('canonical')
    }

    // Open Graph
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:type', ogType, 'property')
    setMeta('og:image', ogImage, 'property')
    if (canonical) setMeta('og:url', canonical, 'property')
    else document.querySelector('meta[property="og:url"]')?.remove()

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', ogImage)

    // JSON-LD
    setJsonLd(jsonLd)

    // Cleanup: reset về default khi unmount
    return () => {
      document.title = DEFAULT_TITLE
      setMeta('description', DEFAULT_DESCRIPTION)
      setMeta('robots', 'noindex,follow')
      for (const name of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) document.querySelector(`meta[property="${name}"]`)?.remove()
      for (const name of ['twitter:title', 'twitter:description', 'twitter:image']) document.querySelector(`meta[name="${name}"]`)?.remove()
      removeLink('canonical')
      setJsonLd(null)
    }
  }, [title, description, canonical, indexable, ogType, ogImage, jsonLd])
}
