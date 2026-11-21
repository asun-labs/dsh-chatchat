import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { buildClient, root } from '../scripts/build-client.mjs'

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.peerDependencies)])
const packageName = specifier => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
const codeFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = join(directory, entry.name)
  return entry.isDirectory() ? codeFiles(file) : /\.(?:js|jsx)$/.test(entry.name) ? [file] : []
})

test('production source imports stay inside the package and declare every static dependency', () => {
  const ts = createRequire(import.meta.url)('typescript')
  for (const file of [join(root, 'index.js'), join(root, 'web-search.js'), ...codeFiles(join(root, 'src'))]) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX)
    const check = node => {
      let specifier
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifier = node.moduleSpecifier.text
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text
      if (specifier?.startsWith('.')) {
        const resolved = resolve(file, '..', specifier)
        const local = relative(root, resolved)
        assert(!local.startsWith('..') && !isAbsolute(local), `${relative(root, file)} imports another repository: ${specifier}`)
      } else if (specifier && !specifier.startsWith('node:')) {
        assert(declared.has(packageName(specifier)), `${relative(root, file)} has an undeclared dependency: ${specifier}`)
      }
      ts.forEachChild(node, check)
    }
    check(source)
  }
})

test('Host and web-search entries load from the standalone dependency tree without starting a runtime', async () => {
  const host = await import('../index.js')
  const search = await import('../web-search.js')
  assert.equal(host.name, manifest.name)
  assert.equal(typeof host.apply, 'function')
  assert.equal(typeof host.createRuntime, 'function')
  assert.equal(typeof search.apply, 'function')
})

test('test build hook resolves from nested ESM and CommonJS callers and keeps fixture asset macros', () => {
  for (const loader of ["await import('esbuild')", "createRequire(import.meta.url)('esbuild')"]) {
    const result = spawnSync(process.execPath, [
      '--import', new URL('../test/harness-resolve.mjs', import.meta.url).href,
      '--input-type=module', '--eval', `
        import assert from 'node:assert/strict'
        import { createRequire } from 'node:module'
        const { build } = ${loader}
        const result = await build({ stdin: { contents: 'export default __SEAL_DOT_ICON__' }, write: false, format: 'esm' })
        assert(!result.outputFiles[0].text.includes('__SEAL_DOT_ICON__'))
      `,
    ], { cwd: join(root, 'tests'), encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  }
})

test('client factory runs with only host platform modules and bundles real assets and utilities', async () => {
  const result = await buildClient({ write: false })
  const code = result.outputFiles.find(file => file.path.endsWith('client.js')).text
  assert.equal(readFileSync(join(root, 'lib/client.js'), 'utf8'), code, 'packaged client is stale; run npm run build')
  const registrations = []
  runInNewContext(code, { window: { __ModuleLoader__: { load: value => registrations.push(value) } } })
  assert.equal(registrations.length, 1)
  const [{ id, factory }] = registrations
  assert.equal(id, manifest.name)
  const require = createRequire(import.meta.url)
  const requested = new Set()
  const exports = factory(specifier => {
    requested.add(specifier)
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return {}
    assert(['react', 'react-dom', 'react/jsx-runtime'].includes(specifier), `client requests an unprovided module: ${specifier}`)
    return require(specifier)
  })
  assert.equal(typeof exports.apply, 'function')
  assert(!Array.from(exports.inject).some(name => /^sealHarness/.test(name)), 'standalone Client must activate without Seal services')
  assert(requested.has('react'))
  const inputs = Object.keys(result.metafile.inputs).map(file => file.replaceAll('\\', '/'))
  for (const suffix of ['/src/client/sidebar.js', '/src/client/cells.js', '/src/client/composer.js']) {
    assert(inputs.some(file => `/${file}`.endsWith(suffix)), `native component missing from build: ${suffix}`)
  }
  for (const name of ['deep-view', 'qrcode-generator', '@deepseek-ai/dsh-util-workspace-path']) {
    assert(inputs.some(file => file.includes(`node_modules/${name}/`)), `browser dependency was not bundled: ${name}`)
  }
  assert(!inputs.some(file => /node_modules\/react(?:-dom)?\//.test(file)), 'host React must remain external')
  assert(code.includes(readFileSync(join(root, 'assets/seal-dot.png')).toString('base64')), 'plugin icon was not embedded')
  const catalog = JSON.parse(readFileSync(join(root, 'assets/avatar-catalog/catalog.json'), 'utf8'))
  for (const { id } of catalog) assert(code.includes(readFileSync(join(root, 'assets/avatar-catalog', `${id}.png`)).toString('base64')), `avatar ${id} was not embedded`)
})

test('precompiled client API works without an active core Client Loader row', () => {
  assert.equal(manifest.exports['./client-api'], './lib/client-api.cjs')
  const code = readFileSync(join(root, 'lib/client-api.cjs'), 'utf8')
  assert(!code.includes('__ModuleLoader__'), 'library must not require or register a second Client Loader plugin')
  const requested = []
  const require = createRequire(import.meta.url)
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require(name) {
    requested.push(name)
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return {}
    assert(['react', 'react-dom', 'react/jsx-runtime'].includes(name), `unprovided library dependency: ${name}`)
    return require(name)
  } })
  assert.equal(typeof module.exports.apply, 'function')
  assert(Array.isArray(module.exports.inject))
  assert(requested.includes('react'))
  const lifecycleReached = new Error('public Client lifecycle reached')
  assert.throws(() => module.exports.apply({ effect(_install, label) {
    assert.equal(label, 'seal-dot: interface copy')
    throw lifecycleReached
  } }, { registerPanel() {} }), error => error === lifecycleReached)
})

test('npm tarball includes client, runtime sources and licenses without developer or user files', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-chatchat-pack-'))
  try {
    // 只检查本地包清单；构建单独验证，不触发联网或安装脚本。
    const npm = [process.env.npm_execpath,
      join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
      '/usr/share/nodejs/npm/bin/npm-cli.js',
    ].find(path => path && basename(path) === 'npm-cli.js' && existsSync(path))
    assert(npm, 'install npm alongside Node or run npm run test:package to provide its CLI')
    const result = spawnSync(process.execPath, [npm, 'pack', '--dry-run', '--ignore-scripts', '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, DSH_HOME: home, npm_config_cache: join(home, 'npm-cache'), npm_config_offline: 'true' },
    })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    const files = new Set(JSON.parse(result.stdout)[0].files.map(file => file.path))
    for (const file of ['index.js', 'web-search.js', 'lib/client.js', 'lib/client.js.map', 'lib/client-api.cjs', 'lib/client-api.cjs.map', 'office.js', 'src/host/store.js', 'src/client/index.js', 'scripts/build-client.mjs', 'LICENSE', 'NOTICE', 'third-party/ds-bot/NOTICE', 'third-party/ds-bot/PROVENANCE.md', 'assets/avatar-catalog/PROVENANCE.md']) {
      assert(files.has(file), `npm package is missing ${file}; run npm run build first`)
    }
    assert(![...files].some(file => /^(?:node_modules|test|tests|\.git|dev|coverage)\//.test(file)), 'npm package exposes development files')
    assert(![...files].some(file => /(?:^|\/)\.env(?:\.|$)|(?:^|\/)state\.json$/.test(file)), 'npm package exposes user state')
  } finally {
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
})
