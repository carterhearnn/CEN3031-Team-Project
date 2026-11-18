import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const feature = join(root, 'src/features/deal-discussions')
const sharedFirebase = join(root, 'src/firebase.js')
const sharedUrls = join(root, 'src/shared/urls.js')
const sharedLogo = join(root, 'src/shared/GatorByteLogo.jsx')
const sharedDealDelete = join(root, 'src/shared/DealDeleteButton.jsx')
const sharedLogin = join(root, 'src/login/login.jsx')
const sharedLoginCss = join(root, 'src/login/Login.css')
const sharedAccount = join(root, 'src/login/useAccount.js')
const sharedRoles = join(root, 'src/login/roles.js')
const sharedProfile = join(root, 'src/login/profile.js')
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

// Login is intentionally shared by both entries. Keep its CSS inside the
// component namespace; sibling selectors and global at-rules can escape it.
function assertLoginStyles(source, label) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = /([^{}]+)\{([^{}]*)\}/g
  let end = 0
  let count = 0
  for (const rule of css.matchAll(rules)) {
    assert.equal(css.slice(end, rule.index).trim(), '', `${label}: unsupported global or nested CSS`)
    for (const selector of rule[1].split(',')) {
      const scoped = selector.trim()
      assert.ok(/^\.login-[a-zA-Z0-9_-]+(?=$|[\s.:#[>])/.test(scoped) && !/[+~]/.test(scoped),
        `${label}: shared CSS must stay inside .login-* components: ${scoped}`)
    }
    end = rule.index + rule[0].length
    count++
  }
  assert.ok(count && css.slice(end).trim() === '', `${label}: expected flat, scoped login styles`)
}

assertLoginStyles(readFileSync(sharedLoginCss, 'utf8'), 'src/login/Login.css')

for (const file of files(feature).filter((path) => /\.(?:js|jsx|css)$/.test(path))) {
  for (const dependency of imports(file)) {
    if (dependency.startsWith(`${feature}${sep}`)) continue
    assert.ok(dependency === sharedUrls ||
      (file === join(feature, 'DealPage.jsx') && [sharedLogin, sharedLogo, sharedDealDelete].includes(dependency)) ||
      (file === join(feature, 'components/Comments.jsx') &&
        [sharedAccount, sharedRoles].includes(dependency)) ||
      (file === join(feature, 'data/deals.js') && dependency === sharedFirebase),
    `Unexpected feature dependency: ${relative(root, file)} imports ${relative(root, dependency)}`)
  }
}

const featureGraph = dependencyGraph(join(feature, 'main.jsx'))
const sharedFiles = new Set([
  sharedFirebase, sharedUrls, sharedLogo, sharedLogin, sharedLoginCss, sharedAccount, sharedRoles, sharedProfile,
  sharedDealDelete,
])
for (const file of featureGraph) {
  assert.ok(file.startsWith(`${feature}${sep}`) || sharedFiles.has(file),
    `Unexpected transitive feature dependency: ${relative(root, file)}`)
}
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
assert.ok([...mainStyles].some((style) => !dealStyles.has(style)) &&
  [...dealStyles].some((style) => !mainStyles.has(style)), 'Both entries must own independent page styles')
for (const style of dealStyles) {
  if (mainStyles.has(style)) assertLoginStyles(readFileSync(join(root, 'dist', style), 'utf8'), style)
}
const dealCss = [...dealStyles].map((file) => readFileSync(join(root, 'dist', file), 'utf8')).join('\n')
assert.ok(dealCss.includes('#deal-root'), 'Deal entry must include its own page reset')
assert.ok(!dealCss.includes('.record-card') && !dealCss.includes('.tables-section'),
  'Host page styles leaked into the deal bundle')
console.log('Deal isolation passed: dedicated entries, independent page styles, scoped shared login, public integration.')
