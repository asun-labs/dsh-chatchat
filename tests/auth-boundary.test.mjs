import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { install as installStore } from '../src/host/store.js'
import { install as installChannel } from '../src/host/channel.js'
import { replaceFile } from '../src/host/files.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function harness(t, { integrated = true, available = true, identityService = 'dshChatchatIdentity' } = {}) {
  const home = await fs.mkdtemp(join(tmpdir(), 'seal-bot-auth-'))
  const statePath = join(home, 'state.json')
  const disposers = []
  let current = { accountId: 'test-account', epoch: 1 }
  let route
  const identity = { getSession: () => current }
  const ctx = {
    get: name => available && name === identityService ? identity : undefined,
    inject() {},
    effect(execute) { const dispose = execute(); if (typeof dispose === 'function') disposers.push(dispose) },
    connection: { fetch: { register(value) { route = value; return () => {} } } },
  }
  const rt = { ctx, home, statePath, config: { integrated, identityService }, warn() {}, autoRoomName: () => 'Room', retitleRoom: async () => {} }
  installStore(rt)
  await rt.load()
  await rt.save()
  installChannel(rt)
  t.after(async () => {
    for (const dispose of disposers.reverse()) await dispose()
    await fs.rm(home, { recursive: true, force: true })
  })
  const call = async (endpoint, payload = {}) => {
    const response = await route.fetch(new Request(`http://localhost${route.path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
    }))
    return response.json()
  }
  return { rt, home, statePath, call, setSession(value) { current = value }, saved: async () => JSON.parse(await fs.readFile(statePath, 'utf8')) }
}

test('integrated Bot rejects reads and writes without unified login; relogin retries work', async t => {
  const h = await harness(t)
  const before = await h.saved()
  h.setSession(null)
  for (const [endpoint, payload] of [['set-prefs', { theme: 'dark' }], ['state', {}]]) {
    const result = await h.call(endpoint, payload)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'bot/authentication-required')
  }
  assert.deepEqual(await h.saved(), before)
  h.setSession({ accountId: 'test-account', epoch: 2 })
  assert.equal((await h.call('set-prefs', { theme: 'light' })).ok, true)
  assert.equal((await h.saved()).prefs.theme, 'light')
})

test('integrated Bot fails closed when identity service is missing; standalone stays compatible', async t => {
  const integrated = await harness(t, { available: false })
  assert.equal((await integrated.call('set-prefs', { theme: 'dark' })).error.code, 'bot/authentication-required')
  const standalone = await harness(t, { integrated: false, available: false })
  assert.equal((await standalone.call('set-prefs', { theme: 'dark' })).ok, true)
})

test('an integrated host explicitly selects its identity service and retains logout guards', async t => {
  const h = await harness(t, { identityService: 'hostIdentity' })
  assert.equal((await h.call('set-prefs', { theme: 'light' })).ok, true)
  h.setSession(null)
  assert.equal((await h.call('set-prefs', { theme: 'dark' })).error.code, 'bot/authentication-required')
})

test('logout while refreshing rejects before endpoint processing, and relogin can retry', async t => {
  const h = await harness(t)
  const entered = deferred(), release = deferred()
  h.rt.refresh = async () => { entered.resolve(); await release.promise }
  const pending = h.call('set-prefs', { theme: 'dark' })
  await entered.promise
  h.setSession(null)
  release.resolve()
  assert.equal((await pending).error.code, 'bot/identity-changed')
  assert.equal((await h.saved()).prefs.theme, undefined)
  h.setSession({ accountId: 'test-account', epoch: 3 })
  assert.equal((await h.call('set-prefs', { theme: 'light' })).ok, true)
})

test('logout while load waits never dispatches the mutation', async t => {
  const h = await harness(t)
  const entered = deferred(), release = deferred()
  h.rt.refresh = async () => {}
  const load = h.rt.load
  h.rt.load = async () => { entered.resolve(); await release.promise; return load() }
  const pending = h.call('set-prefs', { theme: 'dark' })
  await entered.promise
  h.setSession(null)
  release.resolve()
  assert.equal((await pending).error.code, 'bot/identity-changed')
  assert.equal(h.rt.state.prefs.theme, undefined)
  assert.equal((await h.saved()).prefs.theme, undefined)
})

test('async mutation from a stale epoch never persists or leaks into the next save', async t => {
  const h = await harness(t)
  const entered = deferred(), release = deferred()
  h.rt.resolveModel = async () => { entered.resolve(); await release.promise; return 'stale-model' }
  const pending = h.call('set-prefs', { defaultBotModel: 'test-model' })
  await entered.promise
  h.setSession({ accountId: 'other-account', epoch: 2 })
  release.resolve()
  assert.equal((await pending).error.code, 'bot/identity-changed')
  assert.equal((await h.saved()).prefs.defaultBotModel, undefined)
  assert.equal(h.rt.state.prefs.defaultBotModel, undefined)
  assert.equal((await h.call('set-prefs', { theme: 'light' })).ok, true)
  assert.equal((await h.saved()).prefs.defaultBotModel, undefined)
})

test('logout during the actual state file write prevents replacement and removes the temporary file', async t => {
  const h = await harness(t)
  const original = await fs.readFile(h.statePath, 'utf8')
  const entered = deferred(), release = deferred()
  const write = fs.writeFile
  fs.writeFile = async (path, ...args) => {
    await write(path, ...args)
    if (path === `${h.statePath}.${process.pid}.tmp`) { entered.resolve(); await release.promise }
  }
  syncBuiltinESMExports()
  try {
    const pending = h.call('set-prefs', { theme: 'dark' })
    await entered.promise
    h.setSession(null)
    release.resolve()
    assert.equal((await pending).error.code, 'bot/identity-changed')
    assert.equal(await fs.readFile(h.statePath, 'utf8'), original)
    await assert.rejects(fs.stat(`${h.statePath}.${process.pid}.tmp`), { code: 'ENOENT' })
  } finally {
    release.resolve()
    fs.writeFile = write
    syncBuiltinESMExports()
  }
})

test('shared atomic file replacement rejects the request identity after an async gap', async t => {
  const h = await harness(t)
  const target = join(h.home, 'auxiliary.json'), temp = `${target}.tmp`
  await fs.writeFile(target, 'before')
  await fs.writeFile(temp, 'after')
  await assert.rejects(h.rt.identityBoundary.run(async () => {
    await Promise.resolve()
    h.setSession(null)
    await replaceFile(temp, target)
  }), { code: 'bot/identity-changed' })
  assert.equal(await fs.readFile(target, 'utf8'), 'before')
})

test('an old rejected write never rolls back the new account concurrent state/save', async t => {
  const h = await harness(t)
  const entered = deferred(), release = deferred(), queued = deferred()
  const write = fs.writeFile, save = h.rt.save
  let held = false
  h.rt.save = (...args) => {
    if (h.rt.state.prefs.theme === 'light') queued.resolve()
    return save(...args)
  }
  fs.writeFile = async (path, ...args) => {
    await write(path, ...args)
    if (!held && path === `${h.statePath}.${process.pid}.tmp`) { held = true; entered.resolve(); await release.promise }
  }
  syncBuiltinESMExports()
  try {
    const oldRequest = h.call('set-prefs', { theme: 'dark' })
    await entered.promise
    h.setSession({ accountId: 'other-account', epoch: 2 })
    const newRequest = h.call('set-prefs', { theme: 'light' })
    await queued.promise
    release.resolve()
    assert.equal((await oldRequest).error.code, 'bot/identity-changed')
    assert.equal((await newRequest).ok, true)
    assert.equal(h.rt.state.prefs.theme, 'light')
    assert.equal((await h.saved()).prefs.theme, 'light')
  } finally {
    release.resolve()
    fs.writeFile = write
    syncBuiltinESMExports()
  }
})

test('a returned RPC does not permanently fence its admitted native background work', async t => {
  const h = await harness(t)
  const release = deferred()
  let background
  await h.rt.identityBoundary.run(async () => {
    background = release.promise.then(async () => {
      h.rt.state.prefs.theme = 'native-background'
      await h.rt.save()
    })
  })
  h.setSession(null)
  release.resolve()
  await background
  assert.equal((await h.saved()).prefs.theme, 'native-background')
  assert.equal((await h.call('set-prefs', { theme: 'dark' })).error.code, 'bot/authentication-required')
})
