import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import React, { act, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createSource } from '../src/client/sources.js'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const bundle = await build({
  stdin: { contents: "export { Overlays } from './src/client/overlays.js'; export { SettingsDialog } from './src/client/settings.js'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  define: { __SEAL_DOT_ICON__: '""', __SEAL_BOT_ROBOT_AVATARS__: '[]' },
})

test('embedded Bot edit settings can close or Escape back to the unchanged chat; host settings remain embedded', async t => {
  const dom = new JSDOM('<main></main>')
  dom.window.matchMedia = () => ({ matches: true })
  dom.window.Element.prototype.scrollIntoView = () => {}
  const previous = { window: globalThis.window, document: globalThis.document, Element: globalThis.Element, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true })
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, window: dom.window, document: dom.window.document, Element: dom.window.Element,
    setTimeout, clearTimeout, requestAnimationFrame: callback => setTimeout(() => callback(performance.now()), 0), cancelAnimationFrame: clearTimeout,
    require: name => name === '@deepseek-ai/dsh-client-ui-primitives' ? new Proxy({}, { get: () => () => null }) : require(name),
  })
  const { Overlays, SettingsDialog } = module.exports
  const root = createRoot(document.querySelector('main'))
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, { window: previous.window, document: previous.document, Element: previous.Element, IS_REACT_ACT_ENVIRONMENT: previous.act })
  })
  const bot = { id: 'bot-111', name: 'QA-111', role: 'Assistant', instructions: '', avatar: null }
  const roster = { bots: [bot], byId: { [bot.id]: bot }, mainBotId: null, mainBotIds: [], rooms: [], roomsById: {}, models: [], prefs: {}, privateArchives: [] }
  const ui = createSource({ settings: { page: 'bots', id: bot.id } })
  const sessions = { byId: { [bot.id]: { retainedBy: { mainView: 1 } } } }
  const actions = { closeSettings: () => ui.set({ settings: null }), openSettings: (page, id) => ui.set({ settings: { page, id } }) }
  const hooks = {
    embedded: true, actions,
    useUi: pick => pick(useSyncExternalStore(ui.subscribe, ui.getSnapshot)),
    useRoster: pick => pick(roster), useRegistry: pick => pick({}),
    useSessions: pick => pick(sessions), useUpdate: pick => pick({}),
  }
  const Chat = () => React.createElement(React.Fragment, null,
    React.createElement('section', { 'aria-label': 'Bot chat', 'data-session': bot.id }, 'Preserved conversation'),
    React.createElement(Overlays, hooks),
  )
  await act(async () => root.render(React.createElement(Chat)))
  assert.equal(document.querySelector('[role=dialog] h2').textContent, 'QA-111')
  assert.deepEqual([...document.querySelectorAll('.bt-settings-item')].map(node => node.textContent), ['General', 'Bots', 'Group chats'])
  await act(async () => document.querySelector('button[aria-label="Close settings"]').click())
  assert.equal(ui.getSnapshot().settings, null)
  await act(async () => new Promise(resolve => setTimeout(resolve, 180)))
  assert.equal(document.querySelector('[role=dialog]'), null)
  assert.equal(document.querySelector('[aria-label="Bot chat"]').dataset.session, bot.id)
  assert.equal(document.querySelector('[aria-label="Bot chat"]').textContent, 'Preserved conversation')
  await act(async () => actions.openSettings('bots', bot.id))
  await act(async () => dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(ui.getSnapshot().settings, null)
  await act(async () => root.render(React.createElement(SettingsDialog, { embedded: true, page: 'groups', roster, actions, useUpdate: pick => pick({}) })))
  assert.ok(document.querySelector('[role=group][aria-label=Settings]'))
  assert.equal(document.querySelector('button[aria-label="Close settings"]'), null, 'the Seal settings section keeps its host-owned navigation')
})
