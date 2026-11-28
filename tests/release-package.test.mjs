import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { composeEntries, loadProfileDirectory, readProfileManifest } from '@deepseek-ai/dsh-app-boot'
import { Context } from '@deepseek-ai/cordis'
import { PluginManager } from '@deepseek-ai/dsh-plugin-manager'
import { packRelease, releaseManifest } from '../scripts/pack.mjs'

test('release manifest removes all installation/build scripts and development dependencies', () => {
  const manifest = releaseManifest({ name: 'dsh-chatchat', version: '0.1.1', scripts: { prepare: 'fails', install: 'fails' }, devDependencies: { esbuild: '*' }, dependencies: { example: '1.0.0' } })
  assert.equal(manifest.scripts, undefined)
  assert.equal(manifest.devDependencies, undefined)
  assert.deepEqual(manifest.dependencies, { example: '1.0.0' })
  assert(!manifest.files.some(file => file.startsWith('scripts')))
})

// 真实 npm 打包在 Windows 文件扫描下可超过 30 秒，单独保留产物级测试的执行预算。
test('precompiled tarball loads through native DSH bundle selection without compiler or source checkout', { timeout: 120000 }, async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-chatchat-release-test-'))
  let ctx
  try {
    const archive = packRelease({ destination: join(home, 'dist'), build: false })
    assert.equal(archive.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version)
    const bytes = readFileSync(archive.archive)
    assert.equal(archive.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(archive.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`)
    const profile = join(home, 'profile')
    const installed = join(profile, 'node_modules/dsh-chatchat')
    mkdirSync(installed, { recursive: true })
    execFileSync('tar', ['-xzf', archive.archive, '--strip-components=1', '-C', installed], { windowsHide: true })
    const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
    assert.equal(manifest.scripts, undefined)
    assert.equal(manifest.devDependencies, undefined)
    assert.equal(existsSync(join(installed, 'scripts')), false)
    assert.match(readFileSync(join(installed, 'MODIFICATIONS.md'), 'utf8'), /Modifications Copyright \(c\) 2026 DSH ChatChat contributors/)
    assert.match(readFileSync(join(installed, 'NOTICE'), 'utf8'), /Copyright 2026 Fei2411 and the DS Bot contributors/)
    assert.equal(existsSync(join(installed, 'README.en.md')), true)
    const lock = JSON.parse(readFileSync(join(installed, 'npm-shrinkwrap.json'), 'utf8'))
    assert.equal(lock.packages[''].version, manifest.version)
    assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies)
    assert.equal(lock.packages[''].devDependencies, undefined)
    assert(lock.packages['node_modules/mailparser'].integrity)
    writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'test-profile', private: true, dependencies: { 'dsh-chatchat': `file:${archive.archive}` }, dsh: { profile: { bundles: ['dsh-chatchat'] } } }))
    const anchor = join(profile, 'package.json')
    const selected = loadProfileDirectory('dsh', profile, anchor)
    assert.deepEqual(selected.skippedBundles, [])
    assert.equal(selected.layers.length, 1)
    assert.deepEqual(composeEntries(selected.layers.map(layer => layer.patches)), [{ id: 'seal-harness-seal-dot', name: 'dsh-chatchat' }])
    ctx = new Context()
    ctx.provide('profileContext')
    ctx.provide('loader')
    writeFileSync(selected.patchPath, '[]\n')
    ctx.set('profileContext', { ...selected, installAnchor: anchor, cwd: home, home, overlays: [], startedBundles: ['dsh-chatchat'] })
    ctx.set('loader', { entries: () => [] })
    const manager = new PluginManager(ctx, PluginManager.Config({}))
    const bundle = (await manager.listBundles()).find(bundle => bundle.name === 'dsh-chatchat')
    assert.equal(bundle.error, undefined)
    assert.equal(bundle.enabled, true)
    assert.equal(bundle.version, manifest.version)
    assert.deepEqual(bundle.rows.map(row => [row.rowId, row.moduleName]), [['seal-harness-seal-dot', 'dsh-chatchat']])
    const off = await manager.setBundleEnabled('dsh-chatchat', false)
    assert.equal(off.error, undefined)
    assert.equal(off.application, 'restart-required')
    assert.deepEqual(readProfileManifest('dsh', profile).dsh.profile.bundles, [])
    const disabled = loadProfileDirectory('dsh', profile, anchor)
    assert.equal(disabled.layers.length, 0)
    const on = await manager.setBundleEnabled('dsh-chatchat', true)
    assert.equal(on.error, undefined)
    assert.equal(loadProfileDirectory('dsh', profile, anchor).layers.length, 1)
    const registrations = []
    runInNewContext(readFileSync(join(installed, 'lib/client.js'), 'utf8'), { window: { __ModuleLoader__: { load: value => registrations.push(value) } } })
    const require = createRequire(import.meta.url)
    const client = registrations[0].factory(name => name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : require(name))
    assert.equal(registrations[0].id, manifest.name)
    assert.equal(typeof client.apply, 'function')
    assert(Array.isArray(client.inject))
    assert.equal(manifest.exports['./client-api'], './lib/client-api.cjs')
    const library = { exports: {} }
    runInNewContext(readFileSync(join(installed, 'lib/client-api.cjs'), 'utf8'), {
      module: library, exports: library.exports,
      require: name => name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : require(name),
    })
    assert.equal(typeof library.exports.apply, 'function')
    assert.deepEqual(Array.from(library.exports.inject), Array.from(client.inject))
    assert(existsSync(join(installed, 'lib/client-api.cjs.map')))
    for (const file of ['index.js', 'office.js', 'LICENSE', 'NOTICE', 'third-party/ds-bot/LICENSE']) assert(existsSync(join(installed, file)))
  } finally {
    await ctx?.fiber.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
})
