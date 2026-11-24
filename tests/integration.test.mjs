import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { embeddedSurface, groupsFor, readMode } from '../src/client/surface.js'
import { migrateStorage, STORAGE } from '../src/client/storage.js'
import { conversationParts } from '../src/host/conversation-parts.js'
import { promptSessionId } from '../src/host/prompt-context.js'
import { migrateBrandNames } from '../src/host/brand.js'
import { install as installPrompt } from '../src/host/prompt.js'
import { modulesFor, name } from '../index.js'
import { createRequire } from 'node:module'
import { installSharedSettings } from '../src/client/shared-actions.js'
import * as im from '../src/host/im/index.js'
import * as connectors from '../src/host/connectors/index.js'
import * as schedules from '../src/host/schedules.js'
import * as browserPlugins from '../src/host/browser-plugins.js'

const root = fileURLToPath(new URL('..', import.meta.url))

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

test('embedded assistant clears an earlier full-skin preference', () => {
  const storage = memoryStorage({ [STORAGE.surface]: 'bot' })
  const surface = embeddedSurface(storage)
  assert.equal(readMode(storage), 'agent')
  assert.deepEqual(groupsFor(surface), { shell: false, conversation: false })
})

test('integrated Dot leaves IM, connectors, scheduling and browser integration to Seal', () => {
  const integrated = modulesFor({ integrated: true })
  for (const module of [im, connectors, schedules, browserPlugins]) {
    assert.equal(integrated.includes(module), false)
    assert.equal(modulesFor().includes(module), true)
  }
})

test('new Dot storage does not consume a separately installed Bot team', () => {
  const storage = memoryStorage({ 'ds-bot:prefs': '{"theme":"old"}', 'dsh-bot:unread': '{"old":true}' })
  migrateStorage(storage)
  assert.equal(storage.getItem(STORAGE.prefs), null)
  assert.equal(storage.getItem('ds-bot:prefs'), '{"theme":"old"}')
  assert.equal(storage.getItem('dsh-bot:unread'), '{"old":true}')
})

test('embedded package retains the original legal notices', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(manifest.name, 'dsh-chatchat')
  assert.equal(name, manifest.name)
  assert.notEqual(manifest.private, true)
  assert.match(readFileSync(join(root, 'third-party/ds-bot/LICENSE'), 'utf8'), /Apache License/)
  assert.match(readFileSync(join(root, 'third-party/ds-bot/NOTICE'), 'utf8'), /Copyright 2026 Fei2411/)
})

test('explicit host integration owns panel registration', async () => {
  const require = createRequire(import.meta.url)
  const { build } = require('esbuild')
  const { runInNewContext } = await import('node:vm')
  const result = await build({ entryPoints: [join(root, 'src/client/integration.jsx')], bundle: true, format: 'cjs', platform: 'node', write: false })
  const module = { exports: {} }
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require })
  const calls = []
  const ctx = {}
  const Panel = () => null
  module.exports.registerPanel(ctx, { id: 'host-bot' }, Panel, { registerPanel: (...args) => calls.push(args) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], ctx)
  assert.equal(calls[0][1].sidebarDefaultWidth, 272)
  assert.equal(calls[0][2], Panel)
})

test('Bot prompt providers resolve the active DSH scope so each Bot keeps its own identity', () => {
  const bot = { id: 'session-11', session: { id: 'session-11' } }
  assert.equal(promptSessionId({ scope: bot }), 'session-11')
  assert.equal(promptSessionId({ agent: bot }), 'session-11')
  assert.equal(promptSessionId({ scope: { session: { id: 'session-11' } } }), 'session-11')
  assert.equal(promptSessionId({}), undefined)
  let section
  const bots = { 'session-11': { name: '11', role: '研究助理', instructions: '负责资料检索' }, lead: { name: 'Seal Bot', role: '团队协调员' } }
  installPrompt({
    ctx: { provide() {}, effect: effect => effect(), systemPrompt: { section: value => { section = value } } },
    selfOf: id => id,
    botOf: id => bots[id],
    roomOf: () => undefined,
    isMain: id => id === 'lead',
  })
  const own = section.text({ scope: bot })
  assert.match(own, /You are 11/)
  assert.match(own, /负责资料检索/)
  assert.doesNotMatch(own, /You are the Main Bot/)
  assert.match(section.text({ scope: { id: 'lead' } }), /You are Seal Bot/)
  assert.match(section.text({ scope: { id: 'lead' } }), /You are the Main Bot/)
})

test('legacy display names migrate without changing custom Bot names or histories', async () => {
  const workspace = { title: 'Seal Dot', setTitle: async name => { workspace.title = name } }
  const main = { id: 'main', name: 'Seal Dot' }
  const custom = { id: 'custom', name: '11' }
  const renamed = []
  const renameBot = async (id, name) => { renamed.push([id, name]); main.name = name }
  await migrateBrandNames({ workspace, mainBots: [main, custom], renameBot })
  assert.equal(workspace.title, 'DSH Bot')
  assert.deepEqual(renamed, [['main', 'DSH Bot']])
  await migrateBrandNames({ workspace, mainBots: [main, custom], renameBot })
  assert.deepEqual(renamed, [['main', 'DSH Bot']])
  assert.equal(custom.name, '11')
})

test('embedded history resolves group sessions separately from Bot sessions', () => {
  const calls = []
  const partsOf = (...args) => { calls.push(args); return [{ sessionId: 'current' }] }
  const rt = { roomOf: id => id === 'room' ? { id } : undefined }
  assert.equal(conversationParts(rt, 'main', partsOf)[0].sessionId, 'current')
  assert.equal(conversationParts(rt, 'room', partsOf)[0].sessionId, 'current')
  assert.deepEqual(calls, [['main'], [undefined, 'room']])
})


test('old default Main Bot role upgrades once while custom roles stay intact', async () => {
  const main = { id: 'main', name: 'Seal Bot', role: '团队协调员' }
  const custom = { id: 'custom', name: 'Custom', role: 'Research Lead' }
  const updates = []
  const args = { mainBots: [main, custom], renameBot: () => assert.fail('names must stay unchanged'),
    updateRole: async (id, role) => { updates.push([id, role]); main.role = role },
  }
  await migrateBrandNames(args)
  await migrateBrandNames(args)
  assert.deepEqual(updates, [['main', 'Team Leader']])
  assert.equal(custom.role, 'Research Lead')
})
