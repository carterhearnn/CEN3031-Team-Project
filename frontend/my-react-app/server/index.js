import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDealPreviewMiddleware, isDealDiscussionPath } from './features/deal-discussions/index.js'

const defaultDist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function createAppServer({ dist = defaultDist, preview } = {}) {
  const root = resolve(dist)
  const middleware = createDealPreviewMiddleware(preview ? { preview } : {})
  return createServer((request, response) => {
    middleware(request, response, async () => {
      try {
        const rawPathname = new URL(request.url, 'http://localhost').pathname
        const pathname = decodeURIComponent(rawPathname)
        const discussionRoute = isDealDiscussionPath(rawPathname)
        if (pathname.startsWith('/api/')) {
          response.writeHead(404).end('Not found')
          return
        }
        if (!['GET', 'HEAD'].includes(request.method)) {
          response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
          return
        }
        let file = discussionRoute
          ? resolve(root, 'deal.html')
          : resolve(root, `.${pathname.replace(/\\/g, '/')}`)
        if (file !== root && !file.startsWith(`${root}${sep}`)) {
          response.writeHead(404).end('Not found')
          return
        }
        let info = await stat(file).catch(() => null)
        if (!info?.isFile()) {
          if (discussionRoute || extname(pathname)) {
            response.writeHead(404).end('Not found')
            return
          }
          file = resolve(root, 'index.html')
          info = await stat(file)
        }
        response.writeHead(200, {
          'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Length': info.size,
          'X-Content-Type-Options': 'nosniff',
        })
        if (request.method === 'HEAD') response.end()
        else createReadStream(file).on('error', () => response.destroy()).pipe(response)
      } catch {
        response.writeHead(404).end('Not found. Run npm run build before npm start.')
      }
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173)
  const host = process.env.HOST || '127.0.0.1'
  createAppServer().listen(port, host, () => {
    console.log(`GatorByte running at http://${host}:${port}`)
  })
}
