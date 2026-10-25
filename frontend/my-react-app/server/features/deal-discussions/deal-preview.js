import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { promisify } from 'node:util'
import { brotliDecompress, gunzip, inflate } from 'node:zlib'
import { load, loadBuffer } from 'cheerio'
import { imageSize } from 'image-size'
import ipaddr from 'ipaddr.js'

const MAX_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 10000
const MAX_REDIRECTS = 5
const AMAZON_DOMAINS = new Set([
  'amazon.com', 'amazon.ca', 'amazon.com.mx', 'amazon.com.br', 'amazon.co.uk',
  'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.nl', 'amazon.se',
  'amazon.pl', 'amazon.com.be', 'amazon.ie', 'amazon.co.jp', 'amazon.in',
  'amazon.com.au', 'amazon.sg', 'amazon.ae', 'amazon.sa', 'amazon.com.tr',
])
const REDIRECTS = new Set([301, 302, 303, 307, 308])
const unzip = {
  gzip: promisify(gunzip),
  deflate: promisify(inflate),
  br: promisify(brotliDecompress),
}

export class PreviewError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.name = 'PreviewError'
    this.status = status
  }
}

export function isPublicAddress(value) {
  try {
    if (value.includes('%')) return false
    const address = ipaddr.process(value)
    if (address.range() !== 'unicast') return false
    // Only currently allocated global IPv6 unicast space is eligible.
    return address.kind() === 'ipv4' || address.match(ipaddr.parseCIDR('2000::/3'))
  } catch {
    return false
  }
}

export function validatePreviewUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new PreviewError('Enter a valid public product link.', 400)
  }
  let url
  try {
    url = new URL(value)
  } catch {
    throw new PreviewError('Enter a valid public product link.', 400)
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
    !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal') ||
    (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new PreviewError('Use a public http or https product link.', 400)
  }
  url.hash = ''
  return url
}

async function resolvePublicAddress(url, resolve, deadline) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname)) return { address: hostname, family: isIP(hostname) }
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new PreviewError('The website took too long to respond.', 504)
  let timer
  let addresses
  try {
    addresses = await Promise.race([
      resolve(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new PreviewError('The website took too long to respond.', 504)), remaining)
      }),
    ])
  } catch (error) {
    if (error instanceof PreviewError) throw error
    throw new PreviewError('The product website could not be reached.')
  } finally {
    clearTimeout(timer)
  }
  // Reject mixed public/private answers as well as private-only DNS responses.
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new PreviewError('Use a public http or https product link.', 400)
  }
  return addresses.find(({ family }) => family === 4) || addresses[0]
}

function requestPage(url, address, { deadline, maxBytes, request, image = false }) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    let response
    let req
    const finish = (error, result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) {
        response?.destroy()
        req?.destroy()
        reject(error instanceof PreviewError ? error : new PreviewError('The product website could not be read.'))
      } else {
        resolve(result)
      }
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      finish(new PreviewError('The website took too long to respond.', 504))
      return
    }
    const requester = request || (url.protocol === 'https:' ? https.request : http.request)
    // The URL still supplies the original Host header and TLS server name. Only
    // this already-vetted address may be used for the actual TCP connection.
    const pinnedLookup = (_hostname, options, callback) => {
      if (typeof options === 'function') callback = options
      if (options?.all) callback(null, [address])
      else callback(null, address.address, address.family)
    }
    try {
      req = requester(url, {
        method: 'GET',
        agent: false,
        family: address.family,
        lookup: pinnedLookup,
        maxHeaderSize: 32768,
        headers: {
          'User-Agent': 'GatorByte-LinkPreview/1.0',
          Accept: image ? 'image/jpeg,image/png,image/webp,image/gif;q=0.9' : 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Encoding': 'identity',
        },
      }, (res) => {
        response = res
        response.on('error', finish)
        if (settled) {
          response.destroy()
          return
        }
        if (REDIRECTS.has(response.statusCode)) {
          const location = response.headers.location
          response.destroy()
          finish(null, { location })
          return
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          finish(new PreviewError('This website did not allow a product preview.'))
          return
        }
        const type = String(response.headers['content-type'] || '').toLowerCase()
        const validType = image ? /^image\/(jpeg|png|webp|gif)(?:;|$)/.test(type) : /^text\/html(?:;|$)|^application\/xhtml\+xml(?:;|$)/.test(type)
        if (!validType) {
          finish(new PreviewError(image ? 'A product thumbnail is unavailable.' : 'This link does not return a product webpage.'))
          return
        }
        const contentLength = Number(response.headers['content-length'])
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          finish(new PreviewError('This webpage is too large to preview.'))
          return
        }
        const encoding = String(response.headers['content-encoding'] || 'identity').toLowerCase().trim()
        if (encoding !== 'identity' && !unzip[encoding]) {
          finish(new PreviewError('This website uses an unsupported response format.'))
          return
        }
        let bytes = 0
        const chunks = []
        response.on('data', (chunk) => {
          if (settled) return
          bytes += chunk.length
          if (bytes > maxBytes) finish(new PreviewError('This webpage is too large to preview.'))
          else chunks.push(chunk)
        })
        response.on('aborted', () => finish(new PreviewError('The product website stopped responding.')))
        response.on('end', async () => {
          if (settled) return
          try {
            const raw = Buffer.concat(chunks)
            const html = encoding === 'identity' ? raw : await unzip[encoding](raw, { maxOutputLength: maxBytes })
            if (html.length > maxBytes) throw new PreviewError('This webpage is too large to preview.')
            const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1]
            finish(null, { html, charset })
          } catch {
            finish(new PreviewError('This webpage could not be decoded within preview limits.'))
          }
        })
      })
      req.on('error', finish)
      timer = setTimeout(() => finish(new PreviewError('The website took too long to respond.', 504)), remaining)
      req.end()
    } catch (error) {
      finish(error)
    }
  })
}

export async function fetchPreviewHtml(value, options = {}) {
  const deadline = options.deadline ?? Date.now() + (options.timeoutMs ?? TIMEOUT_MS)
  let url = validatePreviewUrl(value)
  const visited = new Set()
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (visited.has(url.href)) throw new PreviewError('This product link redirects in a loop.')
    visited.add(url.href)
    const address = await resolvePublicAddress(url, options.resolve || dnsLookup, deadline)
    const page = await requestPage(url, address, {
      deadline,
      maxBytes: options.maxBytes ?? MAX_BYTES,
      request: options.request,
      image: options.image,
    })
    if (page.html) return { html: page.html, charset: page.charset, url: url.href }
    if (!page.location) throw new PreviewError('This product link has an invalid redirect.')
    if (redirects === MAX_REDIRECTS) throw new PreviewError('This product link has too many redirects.')
    try {
      url = validatePreviewUrl(new URL(page.location, url).href)
    } catch (error) {
      if (error instanceof PreviewError) throw error
      throw new PreviewError('This product link has an invalid redirect.')
    }
  }
}

export function extractAmazonAsin(value) {
  let url
  try {
    url = validatePreviewUrl(value)
  } catch {
    return null
  }
  const domain = url.hostname.replace(/\.$/, '').replace(/^(www|smile|m)\./, '')
  if (!AMAZON_DOMAINS.has(domain)) return null
  return /\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i.exec(url.pathname)?.[1].toUpperCase() || null
}

export async function fetchAmazonThumbnail(value, options = {}) {
  const asin = extractAmazonAsin(value)
  if (!asin) throw new PreviewError('A product thumbnail is unavailable.')
  // Amazon exposes some catalog images publicly by ASIN. Fetch and inspect the
  // actual response: unavailable products often return a 1px placeholder.
  const imageUrl = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`
  const page = await fetchPreviewHtml(imageUrl, { ...options, image: true, maxBytes: options.maxBytes ?? 2 * 1024 * 1024 })
  let dimensions
  try {
    dimensions = imageSize(page.html)
  } catch {
    throw new PreviewError('A product thumbnail is unavailable.')
  }
  if (!['jpg', 'png', 'webp', 'gif'].includes(dimensions.type) ||
    dimensions.width < 32 || dimensions.height < 32 || dimensions.width > 10000 || dimensions.height > 10000) {
    throw new PreviewError('A product thumbnail is unavailable.')
  }
  return page.url
}

function text(value, maxLength = 600) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  // eslint-disable-next-line no-control-regex -- Remove controls from untrusted metadata.
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength) || null
}

function firstImage(value) {
  if (Array.isArray(value)) return value.map(firstImage).find(Boolean)
  if (value && typeof value === 'object') return firstImage(value.url || value.contentUrl)
  return typeof value === 'string' ? value : null
}

function findProduct(value) {
  const queue = [value]
  let checked = 0
  while (queue.length && checked < 3000) {
    const item = queue.shift()
    checked += 1
    if (!item || typeof item !== 'object') continue
    if ([].concat(item['@type'] || []).some((type) => typeof type === 'string' && /(^|[/:])Product$/i.test(type))) return item
    queue.push(...(Array.isArray(item) ? item : Object.values(item)).filter((child) => child && typeof child === 'object'))
  }
  return null
}

function safeImageUrl(value, pageUrl) {
  if (!value || value.length > 4096) return null
  try {
    return validatePreviewUrl(new URL(value, pageUrl).href).href
  } catch {
    return null
  }
}

export function parseProductMetadata(html, pageUrl, charset) {
  const $ = Buffer.isBuffer(html) ? loadBuffer(html, { encoding: { transportLayerEncodingLabel: charset } }) : load(html)
  if ($('form[action*="validateCaptcha"], #captchacharacters, #challenge-running, #cf-challenge-running').length ||
    /^(robot check|just a moment|access denied|attention required)/i.test($('title').text().trim())) {
    throw new PreviewError('This website did not allow a product preview.')
  }
  const metadata = new Map()
  $('meta').each((_, element) => {
    const key = ($(element).attr('property') || $(element).attr('name') || '').toLowerCase()
    if (!metadata.has(key)) metadata.set(key, $(element).attr('content'))
  })
  let product
  $('script[type="application/ld+json"]').each((_, element) => {
    if (product) return
    try {
      product = findProduct(JSON.parse($(element).text()))
    } catch {
      // Malformed third-party structured data should not discard other tags.
    }
  })
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers
  let amazonImage = $('#landingImage, #imgTagWrapperId img, #ebooksImgBlkFront').first().attr('data-old-hires')
  if (!amazonImage) {
    const image = $('#landingImage, #imgTagWrapperId img, #ebooksImgBlkFront').first()
    try {
      amazonImage = Object.keys(JSON.parse(image.attr('data-a-dynamic-image') || '{}'))[0]
    } catch {
      // Amazon's optional dynamic-image map may be absent or invalid.
    }
    amazonImage ||= image.attr('src')
  }
  const image = [firstImage(product?.image), metadata.get('og:image:secure_url'), metadata.get('og:image'),
    metadata.get('twitter:image'), metadata.get('twitter:image:src'), amazonImage,
    $('[itemprop="image"]').first().attr('content'), $('[itemprop="image"]').first().attr('src')]
    .map((value) => safeImageUrl(value, pageUrl)).find(Boolean) || null
  const title = text(product?.name || metadata.get('og:title') || metadata.get('twitter:title') || $('#productTitle').text() || $('title').text(), 300)
  const description = text(product?.description || metadata.get('og:description') || metadata.get('description') || metadata.get('twitter:description'))
  const price = text(offers?.price ?? offers?.lowPrice ?? metadata.get('product:price:amount') ?? metadata.get('og:price:amount') ??
    $('[itemprop="price"]').first().attr('content') ?? $('.a-price .a-offscreen').first().text(), 40)
  const currency = text(offers?.priceCurrency || metadata.get('product:price:currency') || metadata.get('og:price:currency') ||
    $('[itemprop="priceCurrency"]').first().attr('content'), 12)
  return { image, title, description, price, currency, url: pageUrl }
}

export function createPreviewService(options = {}) {
  const cache = new Map()
  const inFlight = new Map()
  const cacheLimit = options.cacheLimit ?? 100
  const cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000
  const loadHtml = options.fetchHtml || fetchPreviewHtml
  const loadAmazonThumbnail = options.fetchAmazonThumbnail || fetchAmazonThumbnail
  return async (value) => {
    const url = validatePreviewUrl(value).href
    const cached = cache.get(url)
    if (cached && cached.expires > Date.now()) return cached.result
    cache.delete(url)
    if (inFlight.has(url)) return inFlight.get(url)
    if (inFlight.size >= 8) throw new PreviewError('Product previews are busy. Try again shortly.', 429)
    const pending = (async () => {
      const deadline = Date.now() + (options.timeoutMs ?? TIMEOUT_MS)
      const amazonAsin = extractAmazonAsin(url)
      let result
      let originalError
      try {
        const page = await loadHtml(url, { deadline: amazonAsin ? Math.min(deadline, Date.now() + 5000) : deadline })
        result = parseProductMetadata(page.html, page.url, page.charset)
        if (!result.image && !result.title) throw new PreviewError('No product preview was available for this link.')
      } catch (error) {
        // An unsafe original URL must never become eligible through a CDN fallback.
        if (!amazonAsin || (error instanceof PreviewError && error.status === 400)) throw error
        originalError = error
      }
      if (amazonAsin && !result?.image) {
        try {
          const image = await loadAmazonThumbnail(url, { deadline })
          result = { title: null, description: null, price: null, currency: null, ...result, image, url }
        } catch {
          if (originalError) throw originalError
        }
      }
      if (!result) throw originalError || new PreviewError('No product preview was available for this link.')
      cache.set(url, { result, expires: Date.now() + cacheTtlMs })
      while (cache.size > cacheLimit) cache.delete(cache.keys().next().value)
      return result
    })()
    inFlight.set(url, pending)
    try {
      return await pending
    } finally {
      inFlight.delete(url)
    }
  }
}

export function createDealPreviewMiddleware(options = {}) {
  const preview = options.preview || createPreviewService()
  return async (request, response, next) => {
    let url
    try {
      url = new URL(request.url, 'http://localhost')
    } catch {
      next()
      return
    }
    if (url.pathname !== '/api/deal-preview') {
      next()
      return
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (request.method !== 'GET') {
      response.statusCode = 405
      response.setHeader('Allow', 'GET')
      response.end(JSON.stringify({ error: 'Use GET to load a product preview.' }))
      return
    }
    try {
      const result = await preview(url.searchParams.get('url'))
      response.statusCode = 200
      response.end(JSON.stringify(result))
    } catch (error) {
      response.statusCode = error instanceof PreviewError ? error.status : 422
      response.end(JSON.stringify({ error: error instanceof PreviewError ? error.message : 'A product preview is unavailable for this link.' }))
    }
  }
}

