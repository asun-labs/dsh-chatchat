import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Context } from '@deepseek-ai/cordis'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const built = await build({
  entryPoints: [new URL('../src/host/local-agents/index.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
  plugins: [{ name: 'deferred-local-discovery', setup(builder) {
    builder.onLoad({ filter: /local-agents[/\\]discover\.js$/ }, () => ({ contents: `
      export const refreshSearchDirs = () => discovery.refresh()
      export const findExecutable = name => name === 'codex' ? '/fixture/codex' : undefined
      export const cleanEnv = value => value
      export const probeVersion = async () => ({ version: 'fixture' })
      export const probeSignIn = async () => true
      export const spawnAgent = () => { throw new Error('no CLI must be spawned') }
    ` }))
  } }],
})

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function fixture() {
  const discovery = deferred()
  const loaded = deferred()
  const module = { exports: {} }
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, require, discovery: { refresh: () => discovery.promise } })
  const root = new Context()
  let ctx
  const events = [], warnings = []
  root.provide('llm', { registerAdapter(routes) {
    events.push(['register', routes])
    const dispose = ctx.effect(() => () => events.push(['dispose']), 'fixture: adapter registration')
    dispose.replace = routes => {
      ctx.effect(() => () => {}, 'fixture: replacing adapter')()
      events.push(['replace', routes])
    }
    return dispose
  } })
  const rt = { state: { bots: {}, localAgents: { custom: [], sessions: {} } }, load: () => loaded.promise, warn: (...args) => warnings.push(args) }
  await root.plugin({ name: 'local-agent-lifecycle-fixture', inject: ['llm'], apply(inner) {
    ctx = rt.ctx = inner
    module.exports.install(rt)
  } })
  return { root, ctx, rt, discovery, loaded, events, warnings }
}

test('deferred CLI discovery and state load cannot register adapters after actual Cordis disposal', async t => {
  const f = await fixture()
  t.after(() => f.root.fiber.dispose())
  await f.ctx.fiber.dispose()
  f.rt.state.localAgents.custom.push({ id: 'late', name: 'Late', command: 'late', args: [] })
  f.loaded.resolve()
  f.discovery.resolve()
  await setImmediate()
  assert.deepEqual(f.events, [])
  assert.deepEqual(f.warnings, [])
})

test('active discovery and loaded custom routes register and replace normally, then dispose once', async t => {
  const f = await fixture()
  t.after(() => f.root.fiber.dispose())
  f.discovery.resolve()
  await setImmediate()
  assert.equal(f.events.filter(([kind]) => kind === 'register').length, 1)
  f.rt.state.localAgents.custom.push({ id: 'custom', name: 'Custom', command: 'fixture', args: [] })
  f.loaded.resolve()
  await setImmediate()
  assert.equal(f.events.filter(([kind]) => kind === 'replace').length, 1)
  assert(f.events.find(([kind]) => kind === 'replace')[1].includes('local-acp-custom'))
  await f.ctx.fiber.dispose()
  assert.equal(f.events.filter(([kind]) => kind === 'dispose').length, 1)
})

test('active background discovery and state load failures are reported instead of unhandled or swallowed', async t => {
  const f = await fixture()
  t.after(() => f.root.fiber.dispose())
  const scanFailure = new Error('discovery fixture failed')
  const loadFailure = new Error('load fixture failed')
  f.discovery.reject(scanFailure)
  f.loaded.reject(loadFailure)
  await setImmediate()
  assert(f.warnings.some(args => args.includes(scanFailure)))
  assert(f.warnings.some(args => args.includes(loadFailure)))
  await f.ctx.fiber.dispose()
})
