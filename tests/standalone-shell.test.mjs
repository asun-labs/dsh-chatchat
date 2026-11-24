import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { standaloneSurface, embeddedSurface } from '../src/client/surface.js'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const result = await build({ entryPoints: ['src/client/standalone-shell.jsx'], bundle: true, write: false,
  format: 'cjs', platform: 'node', external: ['react'] })
const module = { exports: {} }
runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require })

test('standalone takes over complete public shell and returns exact original width', () => {
  const rows = []
  const modes = []
  let width = 317
  const root = { getSnapshot: () => ({ layoutInfo: { sidebar: width } }), actions: { setSidebar: value => { width = value } } }
  const selected = []
  const ctx = { layout: { selectPanel: id => selected.push(id) }, slots: {
    inject: (_, factory) => factory(),
    entries: name => name === 'root' ? [{ store: { create: () => root } }] : [],
    register: (options, component) => {
      const row = { options, component }; rows.push(row)
      return () => rows.splice(rows.indexOf(row), 1)
    },
  } }
  const Panel = () => null
  const leave = module.exports.installStandaloneShell(ctx, Panel, { setSurface: mode => modes.push(mode) })
  assert.equal(width, 0)
  assert.deepEqual(selected, [null])
  assert.deepEqual(rows.map(row => row.options.name), ['sidebar', 'shell.leading', 'main'])
  const main = rows.find(row => row.options.name === 'main')
  assert.equal(main.options.key, 'conversation')
  const element = main.component()
  assert.equal(element.type, Panel)
  assert.equal(element.props.standalone, true)
  element.props.onLeaveOfficeMode()
  assert.deepEqual(modes, ['agent'])
  leave()
  assert.equal(width, 317)
  assert.equal(rows.length, 0)
})

test('independent install starts ChatChat; explicit host starts in host mode', () => {
  let mode = 'agent'
  const storage = { setItem: (_, value) => { mode = value } }
  assert.equal(standaloneSurface(storage).mode, 'bot')
  assert.equal(mode, 'bot')
  assert.equal(embeddedSurface(storage).mode, 'agent')
})

test('top navigation launcher enters the full surface without a footer or embedded panel', async () => {
  const dom = new JSDOM('<main></main>')
  const before = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.querySelector('main'))
  const rows = [], modes = []
  const ctx = { slots: { inject: (_, factory) => factory(), register: (options, component) => { rows.push({ options, component }) } } }
  try {
    const Icon = () => null
    module.exports.installStandaloneLauncher(ctx, { setSurface: mode => modes.push(mode) }, Icon)
    assert.deepEqual(rows.map(row => row.options.name), ['main', 'sidebar.panellist'])
    assert.equal(rows[1].options.label, 'ChatChat')
    assert.equal(rows[1].options.id, rows[0].options.key)
    assert.equal(rows[1].component, Icon)
    await act(async () => root.render(React.createElement(rows[0].component)))
    assert.deepEqual(modes, ['bot'])
    assert.equal(document.querySelector('main').textContent, '')
    await act(async () => root.unmount())
    assert.deepEqual(modes, ['bot'], 'launcher unmount must not undo the full takeover')
  } finally {
    Object.assign(globalThis, { window: before.window, document: before.document, IS_REACT_ACT_ENVIRONMENT: before.act })
    dom.window.close()
  }
})
