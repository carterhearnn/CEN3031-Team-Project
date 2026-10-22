import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer as createViteServer, preview as createVitePreview } from 'vite'
import { createAppServer } from '../../index.js'
import { dealDiscussionsPlugin, isDealDiscussionPath } from './index.js'

const mainHtml = '<main>Main app entry</main>'
const dealHtml = '<main>Deal discussion entry</main>'
const browserAccept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'

test('identifies feature routes, including encoded document IDs and dots', () => {
  for (const pathname of ['/preview/deal', '/preview/deal/', '/deals/abc', '/deals/id.with.dots', '/deals/a%20b/', '/deals/a%252Fb']) {
    assert.equal(isDealDiscussionPath(pathname), true, pathname)
  }
  for (const pathname of ['/', '/index.html', '/submit', '/submit/', '/deal.html', '/deals', '/deals/a/b', '/deals/a%2Fb', '/deals/%ZZ', '/api/deal-preview']) {
    assert.equal(isDealDiscussionPath(pathname), false, pathname)
  }
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'gatorbyte-entries-'))
  await mkdir(join(root, 'dist'))
  for (const folder of [root, join(root, 'dist')]) {
    await writeFile(join(folder, 'index.html'), `<html><body>${mainHtml}<script type="module" src="/app.js"></script></body></html>`)
    await writeFile(join(folder, 'deal.html'), `<html><body>${dealHtml}<script type="module" src="/deal-entry.js"></script></body></html>`)
    await writeFile(join(folder, 'app.js'), 'export default 1')
    await writeFile(join(folder, 'deal-entry.js'), 'export default "deal feature"')
  }
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function checkRoutes(base) {
  const routes = [
    ['/preview/deal', dealHtml],
    ['/preview/deal/', dealHtml],
    ['/deals/existing-document', dealHtml],
    ['/deals/id.with.dots', dealHtml],
    ['/deals/id.with.dots/', dealHtml],
    ['/deals/id%20with%20spaces?source=table', dealHtml],
    ['/', mainHtml],
    ['/index.html', mainHtml],
    ['/submit', mainHtml],
    ['/submit/', mainHtml],
    ['/dashboard', mainHtml],
    ['/account/preferences?tab=saved', mainHtml],
  ]
  for (const [route, expected] of routes) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}${route}`, { method, headers: { Accept: browserAccept } })
      assert.equal(response.status, 200, `${method} ${route}`)
      assert.equal(response.redirected, false, `${method} ${route}`)
      assert.equal(response.url, `${base}${route}`, `${method} ${route}`)
      assert.match(response.headers.get('content-type'), /text\/html/, `${method} ${route}`)
      const body = await response.text()
      if (method === 'HEAD') assert.equal(body, '', `${method} ${route}`)
      else {
        assert.ok(body.includes(expected), `${method} ${route}: expected its own HTML entry`)
        assert.ok(!body.includes(expected === mainHtml ? dealHtml : mainHtml), `${method} ${route}: other HTML entry leaked`)
        const scriptPath = expected === dealHtml ? '/deal-entry.js' : '/app.js'
        assert.ok(body.includes(`src="${scriptPath}"`), `${method} ${route}: expected its own module entry`)
        const module = await fetch(`${base}${scriptPath}`, { headers: { Accept: '*/*' } })
        assert.equal(module.status, 200, `${route}: module entry must load`)
        assert.match(module.headers.get('content-type'), /javascript/, `${route}: module must not receive HTML fallback`)
      }
    }
  }
  const script = await fetch(`${base}/app.js`)
  assert.equal(script.status, 200)
  assert.match(script.headers.get('content-type'), /javascript/)
  for (const route of ['/missing.js', '/missing.css', '/assets/missing.png', '/missing%2Epng', '/api/missing']) {
    assert.equal((await fetch(`${base}${route}`)).status, 404, route)
  }
}

test('standalone server serves isolated entries for GET and HEAD without redirects', async (t) => {
  const root = await fixture(t)
  const server = createAppServer({ dist: join(root, 'dist') })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  await checkRoutes(`http://127.0.0.1:${server.address().port}`)
})

for (const mode of ['dev', 'preview']) {
  test(`Vite ${mode} serves isolated entries and preserves missing asset 404s`, async (t) => {
    const root = await fixture(t)
    const options = {
      configFile: false,
      root,
      publicDir: false,
      logLevel: 'silent',
      plugins: [dealDiscussionsPlugin()],
      server: { host: '127.0.0.1', port: 0 },
      preview: { host: '127.0.0.1', port: 0 },
      optimizeDeps: { noDiscovery: true, include: [] },
    }
    const server = mode === 'dev' ? await createViteServer(options) : await createVitePreview(options)
    t.after(async () => {
      if (mode === 'dev') await server.close()
      else {
        server.httpServer.closeAllConnections()
        await new Promise((resolve) => server.httpServer.close(resolve))
      }
    })
    if (mode === 'dev') await server.listen()
    await checkRoutes(`http://127.0.0.1:${server.httpServer.address().port}`)
  })
}
