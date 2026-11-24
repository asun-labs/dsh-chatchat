import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { JSDOM } from 'jsdom'
import { createSource } from '../src/client/sources.js'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
// The original components have their own migrated tests. This fixture exercises
// only the Seal/Slot/Session boundary with actual React effects and SlotCore.
const bundle = await build({
  entryPoints: [new URL('../src/client/embedded-shell.jsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  external: ['react', 'react-dom'],
  define: { __SEAL_DOT_ICON__: '""', __SEAL_BOT_ROBOT_AVATARS__: '[]' },
  plugins: [{ name: 'visual-components', setup(build) {
    const components = {
      'sidebar.js': 'TeamSidebar', 'header.js': 'HeaderPill', 'overlays.js': 'Overlays',
      'feedback.js': 'ErrorToast', 'model-menu.js': 'DeepSeekSignIn',
    }
    build.onLoad({ filter: /(?:sidebar|header|overlays|feedback|model-menu)\.js$/ }, args => ({
      contents: args.path.endsWith('sidebar.js')
        ? `import React from 'react'; export function TeamSidebar({wide}){return React.createElement('div',{'data-team-sidebar':wide?'open':'rail'})}`
        : `export function ${components[args.path.split(/[\\/]/).at(-1)]}(){return null}`,
    }))
  } }],
})
const module = { exports: {} }
const dom = new JSDOM('<main></main><aside></aside><section></section>')
const api = { module, exports: module.exports, require, window: dom.window, document: dom.window.document,
  ResizeObserver: class { observe() {} disconnect() {} },
}
runInNewContext(bundle.outputFiles[0].text, api)
const { botSessionList, EmbeddedBotPanel, installEmbeddedShell } = module.exports

test('Bot panel uses the host secondary sidebar and keeps primary navigation and collapse controls', async () => {
  const page = new JSDOM('<nav aria-label="一级导航"><button>办公</button></nav><aside data-native-sidebar><header><button aria-label="折叠侧栏">折叠</button></header><div data-sidebar-outlet></div></aside><main></main>')
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: page.window, document: page.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.querySelector('main'))
  const events = []
  const HeaderTools = () => null
  const actions = { enterBotSurface: () => events.push('enter'), leaveBotSurface: () => events.push('leave'),
    mountSurface: seat => { assert.equal(seat.HeaderTools, HeaderTools); events.push(seat.sidebar.parentElement.matches('[data-sidebar-outlet]') && seat.chat.closest('main') ? 'host-sidebar' : 'wrong-seat') } }
  const Sidebar = ({ children }) => createPortal(children, document.querySelector('[data-sidebar-outlet]'))
  await act(async () => root.render(React.createElement(EmbeddedBotPanel, { Sidebar, HeaderTools, actions, onLeaveOfficeMode() {} })))
  assert.ok(document.querySelector('[data-native-sidebar] .seal-bot-sidebar'))
  assert.equal(document.querySelector('main aside'), null)
  assert.ok(document.querySelector('nav[aria-label="一级导航"]'))
  assert.ok(document.querySelector('[data-native-sidebar] button[aria-label="折叠侧栏"]'))
  assert.ok(document.querySelector('main > .seal-bot-layout > section.seal-bot-chat-seat'))
  assert.deepEqual(events, ['enter', 'host-sidebar'])
  await act(async () => root.unmount())
  assert.equal(events.at(-1), 'leave')
  Object.assign(globalThis, { window: previous.window, document: previous.document, IS_REACT_ACT_ENVIRONMENT: previous.act })
  page.window.close()
})

test('original Bot selection is a display projection, without changing Office selection', () => {
  const list = { byId: { office: { retainedBy: { mainView: 1 } }, bot: { retainedBy: { group: 1 } } } }
  const projected = botSessionList(list, 'bot')
  assert.equal(projected.byId.office.retainedBy.mainView, 0)
  assert.equal(projected.byId.bot.retainedBy.mainView, 1)
  assert.equal(projected.byId.bot.retainedBy.group, 1)
  assert.deepEqual(list.byId.office.retainedBy, { mainView: 1 })
  assert.deepEqual(list.byId.bot.retainedBy, { group: 1 })
})

test('original surface shares native Session stores, keeps default transcript and releases switched references', async t => {
  const desktop = desktopRequire
  const { SlotCore } = await import(pathToFileURL(desktop.resolve('@deepseek-ai/dsh-client-ui-slots')).href)
  const core = new SlotCore()
  core.register({ name: 'root', children: {
    'shell.overlay': { kind: 'list', scope: 'root' },
    'conversation.session': { kind: 'single', scope: 'session' },
    'conversation.session.header': { kind: 'single', scope: 'session' },
    'conversation.session.header.corner': { kind: 'single', scope: 'session' },
  } }, () => null)
  const native = { store: {}, inject: () => ({}) }
  core.register({ name: 'conversation.session', ...native }, () => null)
  const releases = []
  const references = []
  const view = createSource({ sessionId: undefined })
  const roster = createSource({ byId: {}, mainBotId: null })
  const frame = createSource({ sidebarWidth: 280 })
  const pref = createSource('open')
  const modes = []
  const ctx = {
    slots: {
      inject: (_, install) => { const off = install(); releases.push(off); return off },
      entries: name => core.entries(name), subscribe: (name, fn) => core.subscribe(name, fn),
      register: (options, Component) => core.register(options, Component),
    },
    sessions: { retain(id) {
      let resolve
      const reference = { id, ready: new Promise(done => { resolve = done }), releases: 0,
        release() { this.releases++ }, resolve() { resolve() } }
      references.push(reference)
      return reference
    } },
  }
  const actions = { setSurface: mode => modes.push(mode), bindSidebarSession: () => () => {}, reportError: assert.fail }
  const surface = installEmbeddedShell(ctx, { face: () => ({}), view, frame, sidebarPref: pref, actions })
  assert.equal(core.entries('seal.bot.views').length, 0)
  const nativeViews = () => null
  const headerStore = {}
  const headerInject = () => ({ hooks: { conversationViews: {} }, selectView() {} })
  const headerChildren = { 'conversation.session.header.views.actions': { kind: 'list', scope: 'root' } }
  const removeHeader = core.register({ name: 'conversation.session.header', store: headerStore,
    inject: headerInject, locale: 'conversation', children: headerChildren }, nativeViews)
  await new Promise(resolve => setImmediate(resolve))
  const views = core.entries('seal.bot.views')[0]
  assert(views, 'Bot embeds the native header view tabs after their late registration')
  const menuOwner = { entries: [], onOpen() {}, onPinnedChange() {}, onDismiss() {} }
  const viewsElement = views.component({ renderSlot: (name, owner) => ({ name, owner }) })
  assert.equal(viewsElement.type, nativeViews)
  assert.deepEqual(viewsElement.props.renderSlot('conversation.session.header.views.actions', menuOwner), {
    name: 'seal.bot.views.actions', owner: menuOwner,
  })
  assert.equal(viewsElement.props.renderSlot('conversation.session.header.corner', {}), null)
  assert.equal(views.store, headerStore)
  assert.equal(views.inject, headerInject)
  assert.equal(views.locale, 'conversation')
  assert.equal(views.children['seal.bot.views.actions'].kind, 'list')
  assert.equal(views.children['seal.bot.views.actions'].scope, 'root')
  const menuComponent = () => null
  const removeMenu = core.register({ name: 'conversation.session.header.views.actions', id: 'native-menu', locale: 'entryCustomization' }, menuComponent)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(core.entries('seal.bot.views.actions')[0].component, menuComponent)
  assert.equal(core.entries('seal.bot.views.actions')[0].locale, 'entryCustomization')
  const nativeExpand = () => null
  const rightbarStore = {}
  const rightbarInject = () => ({ hooks: {} })
  const removeExpand = core.register({ name: 'conversation.session.header.corner', store: rightbarStore, inject: rightbarInject, locale: 'sidebarRight' }, nativeExpand)
  await new Promise(resolve => setImmediate(resolve))
  const workbar = core.entries('seal.bot.workbar')[0]
  assert.equal(workbar.component, nativeExpand, 'reuse the native expand control rather than a second toggle')
  assert.equal(workbar.store, rightbarStore)
  assert.equal(workbar.inject, rightbarInject)
  assert.equal(workbar.locale, 'sidebarRight')
  assert.equal(core.entries('conversation.session').length, 1)
  const session = core.entries('seal.bot.session')[0]
  assert.equal(session.store, native.store)
  assert.equal(session.inject, native.inject)
  const oldGlobals = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.querySelector('main'))
  const props = {
    useRoster: fn => fn(roster.getSnapshot()),
    useSessions: fn => fn({ byId: { bot: {}, room: {} } }),
    useSessionRetainInfo: (_, fn) => fn({ retainedBy: {} }),
    SessionProvider: ({ session, children }) => React.createElement('div', { 'data-session': session.id }, children),
  }
  let factoryCalls = 0
  const renderedSlots = []
  const renderSession = () => React.createElement(session.component, {
    renderSlot: name => { renderedSlots.push(name); return null },
    renderFactorySlot: (name, options, overrides) => {
      assert.equal(name, 'conversation.content')
      assert.equal(options.hero, false)
      assert.equal(overrides, undefined, 'the default native transcript must not be replaced by an empty view')
      factoryCalls++
      return React.createElement('div', { 'data-native-content': '' })
    },
  })
  const seatProps = { sidebar: document.querySelector('aside'), chat: document.querySelector('section'), onLeave() {} }
  let sidebarWidth = 300
  seatProps.sidebar.getBoundingClientRect = () => ({ width: sidebarWidth, left: 56 })
  seatProps.chat.getBoundingClientRect = () => ({ left: 56 + sidebarWidth + 24 })
  const seat = core.entries('seal.bot.surface')[0].component
  await act(async () => { surface.enter(); surface.mount(seatProps); root.render(React.createElement(seat, { ...props, seat: seatProps, renderSlot: renderSession })) })
  assert.equal(references.length, 0, 'startup with no selected session does not retain a reference')
  assert.equal(frame.getSnapshot().contentLeft, 380, 'overlays start beyond the padded host sidebar, not at its inner outlet edge')
  assert.ok(document.querySelector('[data-team-sidebar]'), 'Bot sidebar renders before a session is selected')
  assert.equal(document.querySelector('[data-native-content]'), null)
  await act(async () => view.set({ sessionId: 'bot' }))
  assert.equal(document.querySelector('[data-native-content]'), null)
  await act(async () => references[0].resolve())
  assert.equal(document.querySelector('[data-session]').dataset.session, 'bot')
  assert.ok(factoryCalls > 0)
  assert(renderedSlots.includes('seal.bot.views'))
  assert.equal(document.querySelector('[data-team-sidebar]').dataset.teamSidebar, 'open')
  sidebarWidth = 56
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('resize')))
  assert.equal(document.querySelector('[data-team-sidebar]').dataset.teamSidebar, 'rail')
  assert.equal(pref.getSnapshot(), 'rail')
  assert.equal(frame.getSnapshot().contentLeft, 136, 'overlay edge follows the host conversation when the sidebar collapses')
  assert.equal(references[0].releases, 0, 'native sidebar collapse keeps the active Bot conversation')
  sidebarWidth = 300
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('resize')))
  assert.equal(document.querySelector('[data-team-sidebar]').dataset.teamSidebar, 'open')
  const replacement = document.createElement('aside')
  document.body.appendChild(replacement)
  await act(async () => {
    const next = { ...seatProps, sidebar: replacement }
    surface.mount(next)
    root.render(React.createElement(seat, { ...props, seat: next, renderSlot: renderSession }))
  })
  assert.equal(references.length, 1, 'collapsing/replacing the sidebar portal keeps the same conversation reference')
  assert.deepEqual(modes, ['bot'], 'sidebar changes must not leave and re-enter Bot mode')
  assert.equal(references[0].releases, 0)
  await act(async () => view.set({ sessionId: 'room' }))
  assert.equal(references[0].releases, 1)
  assert.equal(document.querySelector('[data-native-content]'), null)
  await act(async () => root.unmount())
  assert.equal(references[1].releases, 1)
  references[1].resolve()
  surface.leave()
  assert.deepEqual(modes, ['bot', 'agent'])
  removeHeader()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(core.entries('seal.bot.views').length, 0)
  const reloadedViews = () => null
  const removeReloaded = core.register({ name: 'conversation.session.header', store: headerStore,
    inject: headerInject, locale: 'conversation', children: headerChildren }, reloadedViews)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(core.entries('seal.bot.views')[0].component({}).type, reloadedViews)
  releases.reverse().forEach(off => off?.())
  assert.equal(core.entries('seal.bot.session').length, 0)
  assert.equal(core.entries('seal.bot.views').length, 0)
  Object.assign(globalThis, { window: oldGlobals.window, document: oldGlobals.document, IS_REACT_ACT_ENVIRONMENT: oldGlobals.act })
  t.after(() => dom.window.close())
  removeExpand()
  removeMenu()
  removeReloaded()
})
