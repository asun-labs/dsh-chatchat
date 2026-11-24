import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import React, { act, useSyncExternalStore } from 'react'
import { JSDOM } from 'jsdom'
import { createSource } from '../src/client/sources.js'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/model-menu.js', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  plugins: [{ name: 'unrelated-avatar', setup(builder) {
    builder.onLoad({ filter: /[\\/]mark\.js$/ }, () => ({
      contents: 'export function BotMark(){return null} export function BotAvatar(){return null}', loader: 'js',
    }))
  } }],
})

test('model guidance appears proactively, opens setup, and clears after an explicit model choice', async t => {
  const dom = new JSDOM('<main></main>')
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = await import('react-dom/client')
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports,
    require: name => name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : require(name),
  })
  const { ModelChoiceDock } = module.exports
  const root = createRoot(document.querySelector('main'))
  t.after(async () => {
    await act(async () => root.unmount())
    Object.assign(globalThis, { window: previous.window, document: previous.document, IS_REACT_ACT_ENVIRONMENT: previous.act })
    dom.window.close()
  })
  const bot = { id: 'test-bot', name: 'Test Bot' }
  const roster = createSource({ ready: false, models: [], byId: { [bot.id]: bot } })
  let setup = 0
  let refreshes = 0
  const actions = {
    refreshModels() { refreshes++ },
    openModels() { setup++ },
    updateBot(id, patch) {
      roster.set(state => ({ ...state, byId: { ...state.byId, [id]: { ...state.byId[id], ...patch } } }))
      return Promise.resolve()
    },
  }
  const useRoster = selector => selector(useSyncExternalStore(roster.subscribe, roster.getSnapshot))
  await act(async () => root.render(React.createElement(ModelChoiceDock, { sessionId: bot.id, useRoster, actions })))
  assert.equal(document.querySelector('.bt-model-dock'), null)
  await act(async () => roster.set(state => ({ ...state, ready: true })))
  assert.match(document.querySelector('.bt-model-dock').textContent, /don't have a model yet/)
  assert.equal(refreshes, 1)
  await act(async () => document.querySelector('.bt-model-chip').click())
  assert.equal(setup, 1)
  const model = { ref: 'test-provider/model', provider: 'test-provider', providerName: 'Test provider', name: 'Test model' }
  await act(async () => roster.set(state => ({ ...state, models: [model] })))
  assert.match(document.querySelector('.bt-model-dock').textContent, /Pick a model/)
  await act(async () => document.querySelector('button[aria-label="Test model · Test provider"]').click())
  assert.equal(document.querySelector('.bt-model-dock'), null)
  await act(async () => roster.set(state => ({ ...state, models: [], byId: { [bot.id]: { ...bot, model: 'local-codex-cli/default' } } })))
  assert.equal(document.querySelector('.bt-model-dock'), null, 'local agents do not receive an unrelated model setup guide')
})
