import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { hydrate } from '@tanstack/react-query'
import './index.css'
import App from './app/App'
import { useAuthStore } from './features/auth/store/authStore'
import { useReaderSettingsStore } from './features/reader-settings/store/readerSettingsStore'
import { seedPage, type PublicPage } from './lib/seo/publicPage'
import { createRoutes } from './app/router'
import { queryClient } from './lib/queryClient'
import { API_BASE_URL } from './lib/apiConfig'

const stateElement = document.getElementById('ssr-state')
const state = stateElement?.textContent ? JSON.parse(stateElement.textContent) : null
// Client-only deep links restore synchronous local storage before role guards mount.
// Public SSR waits until App's effect so its first render remains anonymous.
if (!state) {
  void useAuthStore.persist.rehydrate()
  void useReaderSettingsStore.persist.rehydrate()
}
if (state?.query) hydrate(queryClient, state.query)
if (state?.router?.loaderData && (!location.search || !['/stories', '/ranking'].includes(location.pathname))) {
  for (const page of Object.values(state.router.loaderData)) if (page) seedPage(queryClient, page as PublicPage, location.pathname)
}
const indexable = document.querySelector('meta[name="seo-indexable"]')?.getAttribute('content') === 'true'
const routes = createRoutes(queryClient, async path => {
  const response = await fetch(API_BASE_URL + '/seo' + path, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(3000) })
  if (!response.ok) return response
  const body = await response.json()
  if (body.data?.meta) body.data.meta.indexable = indexable && body.data.meta.indexable
  return Response.json(body)
})
const router = createBrowserRouter(routes, { hydrationData: state?.router })
const app = <StrictMode><App client={queryClient}><RouterProvider router={router} /></App></StrictMode>
const root = document.getElementById('root')!
if (state) hydrateRoot(root, app)
else createRoot(root).render(app)
