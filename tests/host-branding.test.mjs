import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { createRuntime } from '../index.js'
import { fakeContext } from '../test/fake-ctx.js'
import { DEFAULT_AVATARS, hostBranding, migrateBrandNames } from '../src/host/brand.js'
import { brandProfile, agentDisplayName } from '../src/shared/branding.js'
import { installBranding, currentBrand, brandImage } from '../src/client/branding.js'
import { t, hostText, installLocale, DICTIONARY } from '../src/client/i18n.js'
import { assetDefines } from '../scripts/build-client.mjs'

function removeFixtureHome(home) {
  const target = resolve(home)
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('chatchat-brand-')) throw new Error('拒绝清理测试目录外的路径。')
  rmSync(target, { recursive: true, force: true, maxRetries: 5 })
}

function fixture(t, home, branding) {
  const ctx = fakeContext()
  let sequence = 0
  Object.assign(ctx, {
    workspaceRegistry: { get: () => ({ id: 'workspace' }), resolveByPath: async () => undefined,
      create: async () => ({ id: 'workspace' }), archiveSession: async () => {} },
    sessionController: { create: async () => ({ sessionId: `session-${++sequence}` }),
      resolveAgent: async id => ({ agent: { id, session: { id }, followup() {} } }) },
    sessionTitle: { rename: async () => {} }, sessions: { flush: async () => {} },
  })
  let route
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = options => { route = options; return register(options) }
  const rt = createRuntime(ctx, { home, branding })
  t.after(() => ctx.dispose())
  return { rt, stop: () => ctx.dispose(), async call(endpoint, payload) {
    return (await route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))).json()
  } }
}

test('standalone and legacy hosts create the independent default Bot and native Agent', async t => {
  for (const id of ['dsh', 'seal']) {
    const home = mkdtempSync(join(tmpdir(), 'chatchat-brand-'))
    const { rt, stop, call } = fixture(t, home, id)
    try {
      await rt.bootstrap()
      const bot = rt.botOf(rt.state.mainBotIds[0])
      assert.equal(bot.name, brandProfile(id).botName)
      assert.equal(bot.avatar.image, DEFAULT_AVATARS.dsh)
      assert.equal((await rt.addAgent()).name, brandProfile(id).agentName)
      const snapshot = (await call('state', {})).value
      assert.equal(snapshot.branding, 'dsh')
      const thin = (await call('state', { since: snapshot.revision, models: snapshot.modelsKey, live: snapshot.liveKey })).value
      assert.equal(thin.unchanged, true)
      assert.equal(thin.branding, 'dsh', 'cached rosters retain the independent plugin identity')
    } finally { await stop(); removeFixtureHome(home) }
  }
  assert.equal(hostBranding().id, 'dsh')
  assert.equal(hostBranding({ integrated: true, identityService: 'anotherIdentity' }).id, 'dsh')
  assert.equal(hostBranding({ integrated: true, identityService: 'sealHarnessIdentity' }).id, 'dsh')
  assert.throws(() => hostBranding({ branding: 'unknown' }), /Unknown/)
})

test('default branding migrates once and custom name/avatar survive another host restart', async t => {
  const home = mkdtempSync(join(tmpdir(), 'chatchat-brand-migrate-'))
  let current = fixture(t, home, 'seal')
  try {
    await current.rt.bootstrap()
    const id = current.rt.state.mainBotIds[0]
    await current.stop()
    current = fixture(t, home, 'dsh')
    await current.rt.bootstrap()
    const bot = current.rt.botOf(id)
    assert.equal(bot.name, 'DSH Bot')
    assert.equal(bot.avatar.image, DEFAULT_AVATARS.dsh)
    await current.rt.updateBot(id, { name: 'My team', avatar: { image: 'data:image/png;base64,Y3VzdG9t' } })
    await current.stop()
    current = fixture(t, home, 'seal')
    await current.rt.bootstrap()
    assert.equal(current.rt.botOf(id).name, 'My team')
    assert.equal(current.rt.botOf(id).avatar.image, 'data:image/png;base64,Y3VzdG9t')
    await current.rt.updateBot(id, { name: 'Seal Bot', avatar: { image: DEFAULT_AVATARS.seal } })
    await current.stop()
    current = fixture(t, home, 'dsh')
    await current.rt.bootstrap()
    assert.equal(current.rt.botOf(id).name, 'Seal Bot', 'explicitly chosen stock names are custom now')
    assert.equal(current.rt.botOf(id).avatar.image, DEFAULT_AVATARS.seal)
  } finally { await current.stop(); removeFixtureHome(home) }
})

test('Client labels and icons stay independent without replacing interpolated user names', () => {
  const globals = { seal: globalThis.__SEAL_DOT_ICON__, dsh: globalThis.__DSH_BOT_ICON__ }
  globalThis.__SEAL_DOT_ICON__ = DEFAULT_AVATARS.seal
  globalThis.__DSH_BOT_ICON__ = DEFAULT_AVATARS.dsh
  try {
    for (const id of ['dsh', 'seal']) {
      const scope = installBranding(id)
      try {
        const brand = brandProfile(id)
        assert.equal(t('Add Seal Agent'), `Add ${brand.agentName}`)
        assert.equal(brandImage(), DEFAULT_AVATARS.dsh)
        assert.equal(t('Message {name}', { name: 'Seal Bot' }), 'Message Seal Bot')
        assert.equal(hostText('Seal Bot is still loading this chat.'), `${brand.botName} is still loading this chat.`)
        assert.equal(hostText('User named Seal Bot'), 'User named Seal Bot')
        assert.equal(agentDisplayName({ name: 'Research CLI' }, brand), 'Research CLI')
        const locale = installLocale({ getLocale: () => ({ active: 'zh' }), register: () => () => {}, bind: () => key => DICTIONARY.zh[key] ?? key })
        try { assert.equal(t('Add Seal Agent'), `添加 ${brand.agentName}`) } finally { locale() }
      } finally { scope.dispose() }
    }
    const old = installBranding('seal'), next = installBranding('dsh')
    old.dispose(); assert.equal(currentBrand().id, 'dsh'); next.dispose()
    assert.equal(currentBrand().id, 'dsh', 'unloading a newer scope does not restore a disposed Seal scope')
  } finally { globalThis.__SEAL_DOT_ICON__ = globals.seal; globalThis.__DSH_BOT_ICON__ = globals.dsh }
})

test('legacy unmarked stock identity migrates idempotently while custom records remain intact', async () => {
  const stock = { id: 'stock', name: 'Seal Bot', avatar: { image: DEFAULT_AVATARS.seal } }
  const custom = { id: 'custom', name: 'My researcher', avatar: { image: 'data:image/png;base64,Y3VzdG9t' } }
  const explicit = { id: 'explicit', name: 'Seal Bot', avatar: { image: DEFAULT_AVATARS.seal }, brandDefaults: { name: false, avatar: false } }
  const customName = { id: 'custom-name', name: 'Team librarian', avatar: { image: DEFAULT_AVATARS.seal } }
  const customAvatar = { id: 'custom-avatar', name: 'Seal Bot', avatar: { image: 'data:image/png;base64,Y3VzdG9t' } }
  const bots = [stock, custom, explicit, customName, customAvatar], edits = []
  const options = { mainBots: bots, brand: hostBranding(),
    renameBot: async (id, name) => { edits.push(id + ':name'); bots.find(bot => bot.id === id).name = name },
    updateAvatar: async (id, avatar) => { edits.push(id + ':avatar'); bots.find(bot => bot.id === id).avatar = avatar },
  }
  await migrateBrandNames(options); await migrateBrandNames(options)
  assert.deepEqual(edits, ['stock:name', 'stock:avatar', 'custom-name:avatar', 'custom-avatar:name'])
  assert.equal(stock.name, 'DSH Bot'); assert.equal(stock.avatar.image, DEFAULT_AVATARS.dsh)
  assert.equal(custom.name, 'My researcher'); assert.equal(custom.avatar.image, 'data:image/png;base64,Y3VzdG9t')
  assert.equal(explicit.name, 'Seal Bot'); assert.equal(explicit.avatar.image, DEFAULT_AVATARS.seal)
  assert.equal(customName.name, 'Team librarian'); assert.equal(customName.avatar.image, DEFAULT_AVATARS.dsh)
  assert.equal(customAvatar.name, 'DSH Bot'); assert.equal(customAvatar.avatar.image, 'data:image/png;base64,Y3VzdG9t')
})

test('official DSH avatar is pinned and ships with its license and matching Host/Client bytes', () => {
  const bytes = readFileSync(new URL('../assets/dsh-host.svg', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '0458ed5e4825846a6560e90d3e4de767cd75842f7eb53539dc87a5db380d9146')
  assert.match(readFileSync(new URL('../third-party/deepseek-harness/LICENSE', import.meta.url), 'utf8'), /Copyright \(c\) 2026 DeepSeek/)
  assert.equal(JSON.parse(assetDefines().__DSH_BOT_ICON__), DEFAULT_AVATARS.dsh)
  assert.equal(JSON.parse(assetDefines().__SEAL_DOT_ICON__), DEFAULT_AVATARS.seal)
})

test('default workspace titles stay independent, migrate once, and preserve custom titles', async () => {
  for (const id of ['dsh', 'seal']) {
    for (const title of ['Seal Dot', 'Seal Bot', 'DSH Bot', '我的项目']) {
      const edits = []
      const workspace = { title, async setTitle(value) { this.title = value; edits.push(value) } }
      const options = { workspace, mainBots: [], brand: hostBranding({ branding: id }) }
      await migrateBrandNames(options)
      await migrateBrandNames(options)
      const expected = title === '我的项目' ? title : brandProfile(id).botName
      assert.equal(workspace.title, expected)
      assert.deepEqual(edits, title === expected ? [] : [expected])
    }
  }
})

test('changing team folder creates a workspace with the host brand and keeps an existing title', async t => {
  for (const id of ['dsh', 'seal']) {
    const root = mkdtempSync(join(tmpdir(), 'chatchat-brand-folder-'))
    const { rt, stop } = fixture(t, join(root, 'home'), id)
    try {
      await rt.bootstrap()
      const created = []
      rt.ctx.workspaceRegistry.create = async (path, title) => { created.push(title); return { id: 'next' } }
      await rt.setTeamWorkspace(join(root, 'project'))
      assert.deepEqual(created, [brandProfile(id).botName])
      rt.ctx.workspaceRegistry.resolveByPath = async () => ({ id: 'custom', title: '我的项目' })
      await rt.setTeamWorkspace(join(root, 'existing-project'))
      assert.equal(created.length, 1, 'an existing workspace is reused without renaming')
    } finally { await stop(); removeFixtureHome(root) }
  }
})
