import { extname } from 'node:path'
import { createDealPreviewMiddleware } from './deal-preview.js'
import { isDealDiscussionPath } from './routes.js'

function routeDiscussion(request, _response, next) {
  const url = new URL(request.url, 'http://localhost')
  if (['GET', 'HEAD'].includes(request.method) && isDealDiscussionPath(url.pathname)) {
    // Rewrite internally; the browser keeps the public deal URL and its query.
    request.url = `/deal.html${url.search}`
  }
  next()
}

function routeMainApp(request, _response, next) {
  const url = new URL(request.url, 'http://localhost')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    next()
    return
  }
  // Vite's static/HTML handlers have already had a chance to handle real files.
  // Only extensionless application routes may fall back to the main app.
  if (['GET', 'HEAD'].includes(request.method) && !pathname.startsWith('/api/') && !extname(pathname)) {
    request.url = `/index.html${url.search}`
  }
  next()
}

export function dealDiscussionsPlugin() {
  const preview = createDealPreviewMiddleware()
  const configure = (server) => {
    server.middlewares.use(preview)
    server.middlewares.use(routeDiscussion)
    return () => server.middlewares.use(routeMainApp)
  }
  return {
    name: 'gatorbyte-deal-discussions',
    // An SPA's automatic fallback would send missing assets to index.html.
    config: () => ({ appType: 'mpa' }),
    configureServer: configure,
    configurePreviewServer: configure,
  }
}
