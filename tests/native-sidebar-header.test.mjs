import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import React, { act, useSyncExternalStore } from 'react'
import { JSDOM } from 'jsdom'
import { desktopRequire } from './test-environment.mjs'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/integration.jsx', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom'],
  define: { __SEAL_DOT_ICON__: '""', __DSH_BOT_ICON__: '""' },
})
const { SlotCore } = await import(pathToFileURL(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-slots')).href)

test('native header portals tools above New session and removes them on collapse and panel disposal', async t => {
  const dom = new JSDOM('<header></header><main></main><aside></aside>')
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = await import('react-dom/client')
  const module = { exports: {} }
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require })
  const { registerPanel } = module.exports
  const core = new SlotCore()
  core.register({ name: 'root', children: {
    main: { kind: 'single', scope: 'root' },
    'sidebar.panellist': { kind: 'list', scope: 'root' },
    'sidebar.workspaces': { kind: 'single', scope: 'root' },
    'sidebar.session.action': { kind: 'hoc', scope: 'root' },
  } }, () => null)
  const ctx = { slots: {
    inject: (_name, factory) => factory(),
    entries: name => core.entries(name),
    register: (options, Component) => core.register(options, Component),
  } }
  let searches = 0
  let creations = 0
  let nativeSessions = 0
  const Panel = ({ Sidebar, HeaderTools, onLeaveOfficeMode }) => {
    assert.equal(onLeaveOfficeMode, undefined)
    return React.createElement(React.Fragment, null,
      React.createElement(Sidebar, null, React.createElement('span', null, 'Bots and groups')),
      React.createElement(HeaderTools, null,
        React.createElement('input', { 'aria-label': 'Search Bots', onFocus: () => searches++ }),
        React.createElement('button', { onClick: () => creations++ }, 'New Bot')))
  }
  const useEntry = name => useSyncExternalStore(
    listener => core.subscribe(name, listener), () => core.entries(name)[0] ?? null)
  function NativeHeader({ wide }) {
    const entry = useEntry('sidebar.session.action')
    const children = React.createElement('button', { 'data-native-new': '', onClick: () => nativeSessions++ }, 'New session')
    return entry ? React.createElement(entry.component, { wide, children }) : children
  }
  function NativeSidebar() {
    const entry = useEntry('sidebar.workspaces')
    return entry ? React.createElement(entry.component) : null
  }
  const main = createRoot(document.querySelector('main'))
  const header = createRoot(document.querySelector('header'))
  const sidebar = createRoot(document.querySelector('aside'))
  t.after(async () => {
    await act(async () => { main.unmount(); header.unmount(); sidebar.unmount() })
    Object.assign(globalThis, { window: previous.window, document: previous.document, IS_REACT_ACT_ENVIRONMENT: previous.act })
    dom.window.close()
  })
  registerPanel(ctx, { id: 'native-bot', label: 'Bot' }, Panel)
  await act(async () => {
    header.render(React.createElement(NativeHeader, { wide: true }))
    sidebar.render(React.createElement(NativeSidebar))
    main.render(React.createElement(core.entries('main')[0].component))
  })
  const search = document.querySelector('header input')
  const nativeNew = document.querySelector('[data-native-new]')
  assert.ok(search)
  assert.ok(search.compareDocumentPosition(nativeNew) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
  assert.equal(document.querySelector('aside input'), null)
  assert.equal(document.querySelector('aside').textContent, 'Bots and groups')
  await act(async () => {
    search.focus()
    document.querySelector('header .bt-native-header-tools button').click()
    nativeNew.click()
  })
  assert.deepEqual([searches, creations, nativeSessions], [1, 1, 1])
  await act(async () => header.render(React.createElement(NativeHeader, { wide: false })))
  assert.equal(document.querySelector('header input'), null)
  assert.equal(document.querySelectorAll('[data-native-new]').length, 1)
  await act(async () => header.render(React.createElement(NativeHeader, { wide: true })))
  assert.equal(document.querySelectorAll('header input').length, 1)
  await act(async () => main.render(null))
  assert.equal(core.entries('sidebar.session.action').length, 0)
  assert.equal(core.entries('sidebar.workspaces').length, 0)
  assert.equal(document.querySelector('header input'), null)
  assert.equal(document.querySelectorAll('[data-native-new]').length, 1)
  await act(async () => main.render(React.createElement(core.entries('main')[0].component)))
  assert.equal(document.querySelectorAll('header input').length, 1, 're-entering mounts a single tools row')
})
