import { renderToString } from 'react-dom/server'
import { createStaticHandler, createStaticRouter, StaticRouterProvider, matchRoutes } from 'react-router-dom'
import App from './app/App'
import { createRoutes } from './app/router'
import { createQueryClient } from './lib/queryClient'
import { fallbackMeta, safeJson, type PublicPage, type PageMeta } from './lib/seo/publicPage'

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export function renderHead(meta: PageMeta): string {
  const tag = (name: string, value: string, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escape(value)}">`
  return `<title>${escape(meta.title)}</title>` + tag('description', meta.description) + tag('robots', meta.indexable ? 'index,follow' : 'noindex,follow') +
    (meta.canonical ? `<link rel="canonical" href="${escape(meta.canonical)}">` + tag('og:url', meta.canonical, true) : '') +
    tag('og:title', meta.title, true) + tag('og:description', meta.description, true) + tag('og:type', meta.og.type, true) + tag('og:image', meta.og.image, true) + tag('og:site_name', 'iutruyen', true) +
    tag('twitter:card', 'summary_large_image') + tag('twitter:title', meta.title) + tag('twitter:description', meta.description) + tag('twitter:image', meta.og.image) +
    (meta.jsonLd ? `<script type="application/ld+json" data-seo="json-ld">${safeJson(meta.jsonLd)}</script>` : '')
}

export async function render(url: string, fetcher: (path: string) => Promise<Response>) {
  const client = createQueryClient()
  try {
    const routes = createRoutes(client, fetcher)
    const matches = matchRoutes(routes, new URL(url).pathname)
    // Private app pages never run auth/UI on the server.
    if (matches?.at(-1)?.route.loader === undefined) return { status: 200, head: renderHead(fallbackMeta()), html: '', state: '' }
    const handler = createStaticHandler(routes)
    const context = await handler.query(new Request(url))
    if (context instanceof Response) throw new Error('Unexpected router redirect')
    const page = Object.values(context.loaderData).find(Boolean) as PublicPage | undefined
    const meta = page?.meta ?? fallbackMeta()
    const router = createStaticRouter(handler.dataRoutes, context)
    const html = renderToString(<App client={client}><StaticRouterProvider router={router} context={context} hydrate={false} /></App>)
    const state = safeJson({ router: { loaderData: context.loaderData, actionData: null, errors: null } })
    return { status: page?.status ?? context.statusCode, head: renderHead(meta), html, state }
  } finally { client.clear() }
}
