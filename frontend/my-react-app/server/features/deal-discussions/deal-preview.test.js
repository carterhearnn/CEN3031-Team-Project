import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import {
  createPreviewService,
  extractAmazonAsin,
  fetchAmazonThumbnail,
  fetchPreviewHtml,
  isPublicAddress,
  parseProductMetadata,
  PreviewError,
  validatePreviewUrl,
} from './deal-preview.js'
import { createAppServer } from '../../index.js'

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }]
const productPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAJ0lEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAIB3A0BAAAGP8slRAAAAAElFTkSuQmCC', 'base64')

function transport(handler, requests = []) {
  return (url, options, onResponse) => {
    requests.push({ url, options })
    const request = new EventEmitter()
    let response
    request.destroy = () => response?.destroy()
    request.end = () => queueMicrotask(() => {
      response = new PassThrough()
      response.statusCode = 200
      response.headers = { 'content-type': 'text/html' }
      const result = handler(url, options) || {}
      Object.assign(response, result)
      onResponse(response)
      if (!result.hang && !response.destroyed) response.end(result.body || '<title>Product</title>')
    })
    return request
  }
}

test('rejects local, private, reserved, encoded, and mapped addresses', () => {
  for (const address of [
    '127.0.0.1', '10.0.0.1', '172.16.1.2', '192.168.0.1', '169.254.169.254',
    '100.64.1.1', '0.0.0.0', '224.0.0.1', '198.18.0.1', '192.0.2.1',
    '::1', '::', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1',
    '3fff::1', '64:ff9b::7f00:1', '::ffff:127.0.0.1', '2002:7f00:1::', '5f00::1',
  ]) assert.equal(isPublicAddress(address), false, address)
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
  assert.equal(isPublicAddress('::ffff:8.8.8.8'), true)
  for (const url of [
    'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::ffff:127.0.0.1]/',
    'http://localhost/', 'http://LOCALHOST./', 'http://service.local/', 'http://service.internal/',
    'file:///etc/passwd', 'ftp://example.com/a', 'https://u:p@example.com/', 'https://example.com:8443/',
    'http://example.com:443/', '', 'not a URL',
  ]) assert.throws(() => validatePreviewUrl(url), PreviewError, url)
  assert.equal(validatePreviewUrl('https://example.com:443/product#details').href, 'https://example.com/product')
})

test('rejects private and mixed DNS answers before opening a connection', async () => {
  for (const addresses of [
    [{ address: '10.0.0.1', family: 4 }],
    [{ address: '8.8.8.8', family: 4 }, { address: '::ffff:192.168.0.1', family: 6 }],
  ]) {
    let requested = false
    await assert.rejects(fetchPreviewHtml('https://store.example/product', {
      resolve: async () => addresses,
      request: () => { requested = true },
    }), { status: 400 })
    assert.equal(requested, false)
  }
})

test('pins vetted DNS results while keeping the original hostname and TLS URL', async () => {
  let lookups = 0
  const requests = []
  await fetchPreviewHtml('https://store.example/product', {
    resolve: async () => {
      lookups += 1
      return [{ address: lookups === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }]
    },
    request: transport(() => ({}), requests),
  })
  assert.equal(lookups, 1)
  const [{ url, options }] = requests
  assert.equal(url.hostname, 'store.example')
  assert.equal(options.agent, false)
  assert.equal(options.headers['Accept-Encoding'], 'identity')
  options.lookup('store.example', {}, (error, address, family) => {
    assert.equal(error, null)
    assert.equal(address, '93.184.216.34')
    assert.equal(family, 4)
  })
  options.lookup('store.example', { all: true }, (error, addresses) => {
    assert.equal(error, null)
    assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }])
  })
})

test('validates every redirect destination, including redirect DNS', async () => {
  for (const location of ['http://169.254.169.254/latest/meta-data', 'https://private.example/']) {
    const requests = []
    await assert.rejects(fetchPreviewHtml('https://store.example/product', {
      resolve: async (hostname) => [{ address: hostname === 'private.example' ? '10.0.0.1' : '93.184.216.34', family: 4 }],
      request: transport(() => ({ statusCode: 302, headers: { location } }), requests),
    }), { status: 400 })
    assert.equal(requests.length, 1)
  }
  const page = await fetchPreviewHtml('https://store.example/short', {
    resolve: publicResolver,
    request: transport((url) => url.pathname === '/short' ? { statusCode: 301, headers: { location: '/product' } } : {}),
  })
  assert.equal(page.url, 'https://store.example/product')
})

test('bounds redirect loops and redirect chains', async () => {
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    resolve: publicResolver,
    request: transport(() => ({ statusCode: 302, headers: { location: '/product' } })),
  }), /loop/)
  const requests = []
  await assert.rejects(fetchPreviewHtml('https://store.example/0', {
    resolve: publicResolver,
    request: transport((url) => ({ statusCode: 302, headers: { location: `/${Number(url.pathname.slice(1)) + 1}` } }), requests),
  }), /too many redirects/)
  assert.equal(requests.length, 6)
})

test('bounds response bytes, including compressed HTML expansion', async () => {
  const options = { resolve: publicResolver, maxBytes: 100 }
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    ...options,
    request: transport(() => ({ body: Buffer.alloc(101) })),
  }), /too large/)
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    ...options,
    request: transport(() => ({ headers: { 'content-type': 'text/html', 'content-length': '101' } })),
  }), /too large/)
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    ...options,
    request: transport(() => ({ headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: gzipSync('a'.repeat(10000)) })),
  }), /decode.*limits/)
  const page = await fetchPreviewHtml('https://store.example/product', {
    ...options,
    request: transport(() => ({ headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: gzipSync('<title>Product</title>') })),
  })
  assert.equal(page.html.toString(), '<title>Product</title>')
})

test('uses a total deadline for DNS and page responses', async () => {
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    timeoutMs: 10,
    resolve: () => new Promise(() => {}),
  }), { status: 504 })
  await assert.rejects(fetchPreviewHtml('https://store.example/product', {
    resolve: publicResolver,
    timeoutMs: 10,
    request: transport(() => ({ hang: true })),
  }), { status: 504 })
})

test('handles blocked sites, binary responses, and unsupported encodings safely', async () => {
  for (const result of [
    { statusCode: 403 },
    { headers: { 'content-type': 'image/png' } },
    { headers: { 'content-type': 'text/html', 'content-encoding': 'unknown' } },
    { statusCode: 302, headers: {} },
  ]) {
    await assert.rejects(fetchPreviewHtml('https://store.example/product', {
      resolve: publicResolver,
      request: transport(() => result),
    }), { status: 422 })
  }
})

test('extracts Product JSON-LD, nested graphs, image objects, and offers', () => {
  const product = { '@context': 'https://schema.org', '@graph': [{ '@type': ['Thing', 'Product'],
    name: 'Headphones', description: 'Wireless headphones.', image: [{ contentUrl: '/headphones.jpg' }],
    offers: [{ price: 39.95, priceCurrency: 'USD' }] }] }
  const result = parseProductMetadata(`<script type="application/ld+json">${JSON.stringify(product)}</script>`, 'https://store.example/product')
  assert.deepEqual(result, { image: 'https://store.example/headphones.jpg', title: 'Headphones', description: 'Wireless headphones.', price: '39.95', currency: 'USD', url: 'https://store.example/product' })
})

test('falls back to social tags, resolves image URLs, and decodes HTML entities', () => {
  const result = parseProductMetadata(`<script type="application/ld+json">invalid</script>
    <meta property="og:image" content="//cdn.example/product.jpg">
    <meta property="og:title" content="A &amp; B">
    <meta name="description" content="  Product\n description. ">
    <meta property="product:price:amount" content="29.99">
    <meta property="product:price:currency" content="USD">`, 'https://store.example/product')
  assert.equal(result.image, 'https://cdn.example/product.jpg')
  assert.equal(result.title, 'A & B')
  assert.equal(result.description, 'Product description.')
  assert.equal(result.price, '29.99')
})

test('extracts Amazon product image, title, price, and dynamic image alternatives', () => {
  const result = parseProductMetadata(`<span id="productTitle">  USB Charger </span>
    <div id="imgTagWrapperId"><img id="landingImage" src="data:image/png;base64,none" data-old-hires="https://m.media-amazon.com/images/I/product.jpg"></div>
    <span class="a-price"><span class="a-offscreen">$19.99</span></span>`, 'https://www.amazon.com/dp/B012345678')
  assert.equal(result.image, 'https://m.media-amazon.com/images/I/product.jpg')
  assert.equal(result.title, 'USB Charger')
  assert.equal(result.price, '$19.99')
  const dynamic = parseProductMetadata(`<img id="landingImage" data-a-dynamic-image='{ "https://m.media-amazon.com/photo.jpg": [1000,1000] }'>`, 'https://amazon.com/dp/B012345678')
  assert.equal(dynamic.image, 'https://m.media-amazon.com/photo.jpg')
})

test('omits unsafe images and never returns embedded markup as executable content', () => {
  for (const image of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'http://127.0.0.1/private.jpg', 'http://[::ffff:10.0.0.1]/a']) {
    const result = parseProductMetadata(`<meta property="og:image" content="${image}"><title>Product</title>`, 'https://store.example/')
    assert.equal(result.image, null)
  }
})

test('reports bot challenge pages as unavailable instead of successful product previews', () => {
  assert.throws(() => parseProductMetadata('<title>Amazon.com</title><form action="/errors_page/validateCaptcha"></form>', 'https://www.amazon.com/dp/B012345678'), { status: 422 })
  assert.throws(() => parseProductMetadata('<title>Just a moment...</title>', 'https://store.example/'), { status: 422 })
})

test('honors the HTTP charset when the page has no encoding tag', async () => {
  const page = await fetchPreviewHtml('https://store.example/product', {
    resolve: publicResolver,
    request: transport(() => ({ headers: { 'content-type': 'text/html; charset=utf-8' }, body: Buffer.from('<title>Café — Product</title>') })),
  })
  assert.equal(parseProductMetadata(page.html, page.url, page.charset).title, 'Café — Product')
})

test('extracts strict Amazon ASINs from product links and rejects lookalike domains', () => {
  for (const url of [
    'https://www.amazon.com/dp/B0CGY3Z4ND',
    'https://www.amazon.com/LEGO-Marvel-Avengers-Tower/dp/B0CGY3Z4ND/ref=sr_1_1?crid=ABC&tag=referral-20',
    'https://amazon.com/gp/product/B0CGY3Z4ND/ref=abc',
    'https://m.amazon.com/gp/aw/d/B0CGY3Z4ND?ref=abc',
    'https://www.amazon.co.uk/dp/b0cgy3z4nd/',
  ]) assert.equal(extractAmazonAsin(url), 'B0CGY3Z4ND', url)
  for (const url of [
    'https://amazon.com.evil.example/dp/B0CGY3Z4ND', 'https://evilamazon.com/dp/B0CGY3Z4ND',
    'https://amazon.example/dp/B0CGY3Z4ND', 'https://evil.amazon.com/dp/B0CGY3Z4ND',
    'https://amazon.com/dp/B0CGY3Z4N', 'https://amazon.com/dp/B0CGY3Z4ND1',
    'https://amazon.com/dp/B0CGY3-4ND', 'https://amazon.com/?asin=B0CGY3Z4ND',
    'https://user:password@amazon.com/dp/B0CGY3Z4ND',
  ]) assert.equal(extractAmazonAsin(url), null, url)
})

test('verifies Amazon CDN thumbnails before returning the public image URL', async () => {
  const requests = []
  const image = await fetchAmazonThumbnail('https://www.amazon.com/LEGO-Marvel/dp/B0CGY3Z4ND/ref=abc?tag=referral-20', {
    resolve: publicResolver,
    request: transport(() => ({ headers: { 'content-type': 'image/png' }, body: productPng }), requests),
  })
  assert.equal(image, 'https://images-na.ssl-images-amazon.com/images/P/B0CGY3Z4ND.01.LZZZZZZZ.jpg')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url.href, image)
  assert.equal(requests[0].options.headers['User-Agent'], 'GatorByte-LinkPreview/1.0')
})

test('rejects Amazon placeholders, invalid images, oversized responses, and unsafe image redirects', async () => {
  const placeholder = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  for (const response of [
    { headers: { 'content-type': 'image/gif' }, body: placeholder },
    { headers: { 'content-type': 'image/jpeg' }, body: Buffer.from('not an image') },
    { headers: { 'content-type': 'text/html' }, body: '<title>Not found</title>' },
    { statusCode: 404 },
    { headers: { 'content-type': 'image/png', 'content-length': '9999999' }, body: productPng },
    { statusCode: 302, headers: { location: 'http://169.254.169.254/secret' } },
  ]) await assert.rejects(fetchAmazonThumbnail('https://www.amazon.com/dp/B0CGY3Z4ND', {
    resolve: publicResolver,
    request: transport(() => response),
  }), PreviewError)
  await assert.rejects(fetchAmazonThumbnail('https://www.amazon.com/dp/B0CGY3Z4ND', {
    resolve: async () => [{ address: '127.0.0.1', family: 4 }],
  }), { status: 400 })
})

test('uses a verified ASIN thumbnail after blocked metadata without inventing product details', async () => {
  const url = 'https://www.amazon.com/LEGO-Marvel/dp/B0CGY3Z4ND/ref=abc?tag=referral-20'
  const service = createPreviewService({
    fetchHtml: async () => ({ html: '<title>Amazon.com</title><form action="/errors_page/validateCaptcha"></form>', url }),
    fetchAmazonThumbnail: (value, options) => fetchAmazonThumbnail(value, {
      ...options,
      resolve: publicResolver,
      request: transport(() => ({ headers: { 'content-type': 'image/png' }, body: productPng })),
    }),
  })
  const result = await service(url)
  assert.equal(result.image, 'https://images-na.ssl-images-amazon.com/images/P/B0CGY3Z4ND.01.LZZZZZZZ.jpg')
  assert.equal(result.url, url)
  assert.equal(result.title, null)
  assert.equal(result.price, null)
  assert.equal(result.description, null)
})

test('prefers normal product images and preserves known metadata when only the image is missing', async () => {
  const url = 'https://www.amazon.com/dp/B0CGY3Z4ND'
  let fallbacks = 0
  const loadImage = async () => { fallbacks += 1; return 'https://images-na.ssl-images-amazon.com/product.jpg' }
  const normal = createPreviewService({
    fetchHtml: async () => ({ html: '<span id="productTitle">Avengers Tower</span><img id="landingImage" src="https://m.media-amazon.com/product.jpg">', url }),
    fetchAmazonThumbnail: loadImage,
  })
  assert.equal((await normal(url)).image, 'https://m.media-amazon.com/product.jpg')
  assert.equal(fallbacks, 0)
  const partial = createPreviewService({
    fetchHtml: async () => ({ html: '<span id="productTitle">Avengers Tower</span>', url }),
    fetchAmazonThumbnail: loadImage,
  })
  const result = await partial(url)
  assert.equal(result.title, 'Avengers Tower')
  assert.equal(result.image, 'https://images-na.ssl-images-amazon.com/product.jpg')
  assert.equal(fallbacks, 1)
})

test('does not mask metadata errors or attempt a CDN fallback for unsafe original URLs', async () => {
  const url = 'https://www.amazon.com/dp/B0CGY3Z4ND'
  const original = new PreviewError('This website did not allow a product preview.')
  const unavailable = createPreviewService({
    fetchHtml: async () => { throw original },
    fetchAmazonThumbnail: async () => { throw new Error('thumbnail is missing') },
  })
  await assert.rejects(unavailable(url), (error) => error === original)
  let fallbacks = 0
  const unsafe = createPreviewService({
    fetchHtml: async () => { throw new PreviewError('Use a public http or https product link.', 400) },
    fetchAmazonThumbnail: async () => { fallbacks += 1; return 'https://example.com/image.jpg' },
  })
  await assert.rejects(unsafe(url), { status: 400 })
  assert.equal(fallbacks, 0)
  const spoof = createPreviewService({
    fetchHtml: async () => { throw original },
    fetchAmazonThumbnail: async () => { fallbacks += 1 },
  })
  await assert.rejects(spoof('https://amazon.com.evil.example/dp/B0CGY3Z4ND'), (error) => error === original)
  assert.equal(fallbacks, 0)
})

test('shares the total preview deadline across Amazon HTML and thumbnail requests', async () => {
  const url = 'https://www.amazon.com/dp/B0CGY3Z4ND'
  const original = new PreviewError('Metadata unavailable.')
  const started = Date.now()
  let htmlDeadline
  let imageDeadline
  const service = createPreviewService({
    timeoutMs: 70,
    fetchHtml: async (_value, options) => {
      htmlDeadline = options.deadline
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw original
    },
    fetchAmazonThumbnail: (value, options) => {
      imageDeadline = options.deadline
      return fetchAmazonThumbnail(value, { ...options, resolve: publicResolver, request: transport(() => ({ hang: true, headers: { 'content-type': 'image/jpeg' } })) })
    },
  })
  await assert.rejects(service(url), (error) => error === original)
  assert.equal(imageDeadline, htmlDeadline)
  assert.ok(Date.now() - started < 250, 'Image request must use the remaining total budget')
  const normalBudget = createPreviewService({
    fetchHtml: async (_value, options) => { htmlDeadline = options.deadline; throw original },
    fetchAmazonThumbnail: async (_value, options) => { imageDeadline = options.deadline; return 'https://example.com/image.jpg' },
  })
  await normalBudget(url)
  assert.ok(imageDeadline - htmlDeadline >= 4900, 'Reserve approximately five seconds for the public CDN request')
})

test('caches bounded results, expires entries, and deduplicates simultaneous previews', async () => {
  let calls = 0
  const service = createPreviewService({
    cacheLimit: 1,
    cacheTtlMs: 20,
    fetchHtml: async (url) => {
      calls += 1
      return { html: '<title>Product</title>', url }
    },
  })
  await Promise.all([service('https://store.example/one'), service('https://store.example/one')])
  assert.equal(calls, 1)
  await service('https://store.example/two')
  await service('https://store.example/one')
  assert.equal(calls, 3)
  await new Promise((resolve) => setTimeout(resolve, 25))
  await service('https://store.example/one')
  assert.equal(calls, 4)
})

test('bounds concurrent metadata requests and does not cache failures', async () => {
  const pending = []
  const service = createPreviewService({ fetchHtml: (url) => new Promise((resolve) => pending.push(() => resolve({ html: '<title>Product</title>', url }))) })
  const calls = Array.from({ length: 8 }, (_, index) => service(`https://store.example/${index}`))
  await assert.rejects(service('https://store.example/overflow'), { status: 429 })
  pending.forEach((finish) => finish())
  await Promise.all(calls)
  let failed = 0
  const failing = createPreviewService({ fetchHtml: async () => { failed += 1; throw new Error('internal DNS error') } })
  await assert.rejects(failing('https://store.example/'))
  await assert.rejects(failing('https://store.example/'))
  assert.equal(failed, 2)
})

test('standalone server isolates deal HTML, serves app routes, and exposes sanitized API errors', async (t) => {
  const dist = await mkdtemp(join(tmpdir(), 'gatorbyte-server-'))
  await writeFile(join(dist, 'index.html'), '<main>Main app</main>')
  await writeFile(join(dist, 'deal.html'), '<main>Deal discussions</main>')
  await writeFile(join(dist, 'app.js'), 'export default 1')
  const server = createAppServer({ dist, preview: async (url) => {
    if (url === 'broken') throw new Error('secret internal details')
    if (!url) throw new PreviewError('Enter a valid public product link.', 400)
    return { image: 'https://cdn.example/item.jpg', title: 'Product', description: null, price: null, currency: null, url }
  } })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await rm(dist, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const page = await fetch(`${base}/preview/deal`)
  assert.equal(page.status, 200)
  assert.equal(await page.text(), '<main>Deal discussions</main>')
  const dottedDeal = await fetch(`${base}/deals/id.with.dots`)
  assert.equal(dottedDeal.status, 200)
  assert.equal(await dottedDeal.text(), '<main>Deal discussions</main>')
  for (const route of ['/', '/index.html', '/dashboard', '/account/preferences']) {
    const app = await fetch(`${base}${route}`)
    assert.equal(app.status, 200, route)
    assert.equal(await app.text(), '<main>Main app</main>', route)
  }
  const script = await fetch(`${base}/app.js`)
  assert.match(script.headers.get('content-type'), /javascript/)
  assert.equal((await fetch(`${base}/missing.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/missing`)).status, 404)
  assert.equal((await fetch(`${base}/api/deal-preview`)).status, 400)
  assert.equal((await fetch(`${base}/api/deal-preview?url=https://store.example/`, { method: 'POST' })).status, 405)
  const metadata = await fetch(`${base}/api/deal-preview?url=https://store.example/`)
  assert.equal((await metadata.json()).title, 'Product')
  const error = await fetch(`${base}/api/deal-preview?url=broken`)
  assert.equal(error.status, 422)
  assert.doesNotMatch(await error.text(), /secret|internal|stack/)
})
