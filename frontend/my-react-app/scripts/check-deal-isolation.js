import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const feature = join(root, 'src/features/deal-discussions')
const sharedFirebase = join(root, 'src/firebase.js')
const sharedUrls = join(root, 'src/shared/urls.js')
const publicIntegration = join(feature, 'integration.js')

function files(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

function imports(file) {
  const source = readFileSync(file, 'utf8')
  const expressions = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /@import\s+['"]([^'"]+)['"]/g,
  ]
  return expressions.flatMap((expression) => [...source.matchAll(expression)].map((match) => match[1]))
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => {
      const path = resolve(dirname(file), specifier.split('?')[0])
      const resolved = [path, `${path}.js`, `${path}.jsx`, `${path}.css`, join(path, 'index.js')]
        .find((candidate) => existsSync(candidate) && extname(candidate))
      assert.ok(resolved, `Unresolved import ${specifier} in ${relative(root, file)}`)
      return resolved
    })
}

function dependencyGraph(entry) {
  const visited = new Set()
  const visit = (file) => {
    if (visited.has(file)) return
    visited.add(file)
    imports(file).forEach(visit)
  }
  visit(entry)
  return visited
}

for (const file of files(feature).filter((path) => /\.(?:js|jsx|css)$/.test(path))) {
  for (const dependency of imports(file)) {
    if (dependency.startsWith(`${feature}${sep}`)) continue
    assert.ok(dependency === sharedUrls ||
      (file === join(feature, 'data/deals.js') && dependency === sharedFirebase),
    `Unexpected feature dependency: ${relative(root, file)} imports ${relative(root, dependency)}`)
  }
}

const featureGraph = dependencyGraph(join(feature, 'main.jsx'))
for (const forbidden of ['src/App.jsx', 'src/App.css', 'src/index.css', 'src/main.jsx']) {
  assert.ok(!featureGraph.has(join(root, forbidden)), `Deal entry depends on ${forbidden}`)
}
const integrationGraph = dependencyGraph(publicIntegration)
assert.ok([...integrationGraph].every((path) => !/\.(?:jsx|css)$/.test(path)),
  'Public integration must not load UI or styles')
for (const file of dependencyGraph(join(root, 'src/main.jsx'))) {
  if (file.startsWith(`${feature}${sep}`)) continue
  for (const dependency of imports(file)) {
    if (dependency.startsWith(`${feature}${sep}`)) {
      assert.equal(dependency, publicIntegration,
        `Host file ${relative(root, file)} must use the public feature interface`)
    }
  }
}

const manifestPath = join(root, 'dist/.vite/manifest.json')
assert.ok(existsSync(manifestPath), 'Run npm run build before checking bundle isolation')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
assert.ok(manifest['index.html']?.isEntry && manifest['deal.html']?.isEntry,
  'Both pages must have separate build entries')

function entryStyles(entry) {
  const styles = new Set()
  const visited = new Set()
  const visit = (key) => {
    if (visited.has(key)) return
    visited.add(key)
    assert.ok(manifest[key], `Missing manifest dependency ${key}`)
    manifest[key].css?.forEach((style) => styles.add(style))
    ;[...(manifest[key].imports || []), ...(manifest[key].dynamicImports || [])].forEach(visit)
  }
  visit(entry)
  return styles
}

const mainStyles = entryStyles('index.html')
const dealStyles = entryStyles('deal.html')
assert.ok(mainStyles.size && dealStyles.size, 'Both entries must own styles')
assert.ok([...dealStyles].every((style) => !mainStyles.has(style)), 'Entries must not share stylesheets')
const dealCss = [...dealStyles].map((file) => readFileSync(join(root, 'dist', file), 'utf8')).join('\n')
assert.ok(dealCss.includes('#deal-root'), 'Deal entry must include its own page reset')
assert.ok(!dealCss.includes('.record-card') && !dealCss.includes('.tables-section'),
  'Host page styles leaked into the deal bundle')
console.log('Deal isolation passed: dedicated entry, independent styles, public integration, explicit shared dependencies.')
