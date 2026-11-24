import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/details-drawer.js', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  define: { __SEAL_DOT_ICON__: '"data:image/png;base64,fixture"', __SEAL_BOT_ROBOT_AVATARS__: '[]' },
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})

test('Bot overview separates profile and live activity from settings and retains browser navigation', async t => {
  const dom = new JSDOM('<main></main>', { pretendToBeVisual: true })
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports,
    require: name => name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : require(name),
    window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, Element: dom.window.Element,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class { observe() {} disconnect() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, console,
  })
  const root = createRoot(document.querySelector('main'))
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous) })
  const bot = { id: 'bot', name: 'Researcher', role: 'Research', avatar: { image: 'data:image/png;base64,fixture' }, instructions: 'Cite original sources.', capabilities: ['research-skill'], parts: [] }
  const room = { id: 'room', name: 'Project', members: ['bot'] }
  const updates = [], opened = [], connectorUpdates = []
  const actions = {
    updateBot: async (id, patch) => updates.push({ id, patch }),
    connectorSet: async (id, patch) => connectorUpdates.push({ id, patch }),
    openSession: id => opened.push(id),
    openSharedBrowser: id => opened.push('browser:' + id),
  }
  const roster = { byId: { bot }, roomsById: { room }, rooms: [room], bots: [bot],
    mainBotId: 'bot', mainBotIds: ['bot'], models: [], memory: false, exchangeTurns: {},
    connectors: { connectors: [{ id: 'db', name: 'Database', state: 'ready' }] },
    permissions: { defaultPreset: 'read-only', options: [{ value: 'read-only', label: 'Read only' }, { value: 'workspace-write', label: 'Workspace write' }] },
  }
  const props = { sessionId: 'bot', roster, actions,
    useSessions: select => select({ byId: {}, projectionsBySession: { bot: { values: { tokenUsage: { uncachedInputTokens: 123, outputTokens: 7 } } } } }),
    useSessionStatus: select => select(new Map()),
    useActivity: select => select({}),
    useWork: select => select({ bots: {}, rooms: { room: [{ botId: 'bot', note: 'Checking sources' }] }, approvals: [] }),
    useBrowserTabs: select => select({}), useBrowserPages: select => select({}),
  }
  const render = async next => act(async () => root.render(React.createElement(module.exports.DetailsDrawer, { ...props, ...next })))
  const click = async label => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === label || item.getAttribute('aria-label') === label)
    assert.ok(button, 'missing button ' + label)
    await act(async () => button.click())
  }
  await render()
  assert.ok(document.querySelector('.bt-drawer-id .seal-bot-mascot [data-seal-part=fin]'), 'details reuse the layered animated mascot')
  assert.ok(document.querySelector('.bt-drawer-id .bt-badge-main'), 'the main Bot star moves with its avatar')
  assert.match(document.body.textContent, /Role card/)
  assert.match(document.body.textContent, /Cite original sources\./)
  assert.match(document.body.textContent, /Checking sources/)
  assert.equal(document.querySelector('.bt-drawer-model'), null, 'configuration pickers leave the overview')
  await click('Project')
  assert.deepEqual(opened, ['room'])
  await click('Browser')
  assert.equal(opened.at(-1), 'browser:bot')
  await click('Edit Bot')
  for (const title of ['Model', 'Working folder', 'Permissions', 'Usage']) {
    assert.equal([...document.querySelectorAll('h3')].filter(item => item.textContent === title).length, 1, title + ' occurs once')
  }
  assert.equal(document.querySelectorAll('.bt-drawer-permission').length, 0)
  const permission = [...document.querySelectorAll('[aria-pressed]')].find(item => item.textContent === 'Workspace')
  assert.ok(permission)
  await act(async () => permission.click())
  assert.deepEqual(JSON.parse(JSON.stringify(updates.at(-1))), { id: 'bot', patch: { permission: 'workspace-write' } })
  const connector = document.querySelector('.bt-drawer-model [role=switch]')
  assert.ok(connector)
  await act(async () => connector.click())
  assert.deepEqual(JSON.parse(JSON.stringify(connectorUpdates.at(-1))), { id: 'db', patch: { offFor: ['bot'] } })
  await click('Back to details')
  assert.ok(document.querySelector('[data-bot-overview]'))
  await render({ useWork: select => select({ bots: {}, rooms: {}, approvals: [] }) })
  assert.match(document.body.textContent, /No activity right now/)
})
