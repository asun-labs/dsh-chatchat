import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createSource } from '../src/client/sources.js'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const desktop = desktopRequire
const { SlotCore } = await import(pathToFileURL(desktop.resolve('@deepseek-ai/dsh-client-ui-slots')).href)

test('an empty signed-out Bot surface keeps its sidebar and return action without retaining an undefined session', async t => {
  const page = new JSDOM('<main></main><aside></aside><section></section>')
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: page.window, document: page.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.querySelector('main'))
  const releases = []
  t.after(async () => {
    await act(async () => root.unmount())
    releases.reverse().forEach(release => release?.())
    Object.assign(globalThis, { window: previous.window, document: previous.document, IS_REACT_ACT_ENVIRONMENT: previous.act })
    page.window.close()
  })
  const bundle = await build({
    entryPoints: [new URL('../src/client/embedded-shell.jsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
    bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom'],
    define: { __SEAL_DOT_ICON__: '""', __SEAL_BOT_ROBOT_AVATARS__: '[]' },
    plugins: [{ name: 'unrelated-visual-components', setup(builder) {
      const names = { 'sidebar.js': 'TeamSidebar', 'header.js': 'HeaderPill', 'overlays.js': 'Overlays',
        'feedback.js': 'ErrorToast', 'model-menu.js': 'DeepSeekSignIn' }
      builder.onLoad({ filter: /(?:sidebar|header|overlays|feedback|model-menu)\.js$/ }, args => ({
        contents: args.path.endsWith('sidebar.js')
          ? `import React from 'react'; export function TeamSidebar(){return React.createElement('nav',{'aria-label':'Bot 空目录'})}`
          : `export function ${names[args.path.split(/[\\/]/).at(-1)]}(){return null}`,
      }))
    } }],
  })
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require,
    window: page.window, document: page.window.document,
    ResizeObserver: class { observe() {} disconnect() {} },
  })
  const core = new SlotCore()
  core.register({ name: 'root', children: {
    'shell.overlay': { kind: 'list', scope: 'root' },
    'conversation.session': { kind: 'single', scope: 'session' },
    'conversation.session.header': { kind: 'single', scope: 'session' },
    'conversation.session.header.corner': { kind: 'single', scope: 'session' },
  } }, () => null)
  core.register({ name: 'conversation.session', store: {}, inject: () => ({}) }, () => null)
  let retains = 0, returned = 0
  const ctx = { slots: {
    inject(_name, install) { const release = install(); releases.push(release); return release },
    register: (options, Component) => core.register(options, Component),
    entries: name => core.entries(name), subscribe: (name, listener) => core.subscribe(name, listener),
  }, sessions: { list: createSource({ byId: {} }), retain() { retains++; assert.fail('an empty surface must not retain a session') } } }
  let bindings = 0
  const actions = { setSurface() {}, bindSidebarSession() { bindings++; assert.fail('an unlisted session must not reach the native sidebar') }, reportError: assert.fail }
  const view = createSource({ sessionId: undefined })
  module.exports.installEmbeddedShell(ctx, {
    face: () => ({}), view,
    frame: createSource({ sidebarWidth: 300 }), sidebarPref: createSource('open'), actions,
  })
  const SurfaceSeat = core.entries('seal.bot.surface')[0].component
  const seat = { sidebar: document.querySelector('aside'), chat: document.querySelector('section'), onLeave() { returned++ } }
  seat.sidebar.getBoundingClientRect = () => ({ width: 300, left: 0 })
  await act(async () => root.render(React.createElement(SurfaceSeat, {
    seat, useRoster: select => select({ byId: {}, mainBotId: null }),
    useSessions: select => select({ byId: {} }), useSessionRetainInfo: (_id, select) => select({ retainedBy: {} }),
    SessionProvider() { assert.fail('no SessionProvider before a real reference is ready') },
    renderSlot() { assert.fail('no session body before a real reference is ready') },
  })))
  assert.ok(document.querySelector('aside [aria-label="Bot 空目录"]'))
  const back = document.querySelector('aside button[aria-label="返回办公"]')
  assert.ok(back)
  await act(async () => back.click())
  assert.equal(returned, 1)
  assert.equal(retains, 0)
  await act(async () => view.set({ sessionId: 'remembered-but-not-loaded' }))
  assert.ok(document.querySelector('aside [aria-label="Bot 空目录"]'))
  assert.equal(bindings, 0)
  assert.equal(retains, 0)
  assert.equal(document.querySelector('section').childElementCount, 0)
})
