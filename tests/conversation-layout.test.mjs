import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { nativeCode } from './native-code.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const executablePath = process.env.SEAL_TEST_CHROMIUM ?? chromium.executablePath()
const source = readFileSync(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-conversation/client'), 'utf8')
const installed = nativeCode(source)
const mapText = installed.value('ConversationRoot_module_css_default')
const classes = new Function(`return (${mapText})`)()
const nativeCss = installed.css(`.${classes.body}{`)
const functionOf = name => installed.function(name)
const phase = new Function(`return ${functionOf('conversationPhase')}`)()
const resolveView = new Function(`return ${functionOf('resolveActiveView')}`)()
const NativeViews = new Function('react', 'react_jsx_runtime', 'ConversationRoot_module_css_default', 'resolveActiveView', 'conversationPhase', `return ${functionOf('DefaultConversationViews')}`)(React, jsx, classes, resolveView, phase)
const NativeContent = new Function('react', 'react_jsx_runtime', 'ConversationRoot_module_css_default', 'clsx', 'ConversationSessionView', 'NoConversationWidthControls', 'WorkspaceChip', 'workspaceLabel', 'workspaceDisplayTitle', `return ${functionOf('ConversationContent')}`)(React, jsx, classes, (...values) => values.filter(Boolean).join(' '), () => null, () => null, () => null, value => value, value => value)
const shell = readFileSync(new URL('../src/client/embedded-shell.jsx', import.meta.url), 'utf8').match(/const layout = `([\s\S]*?)`/)[1]

function html(kind, sidebarWidth) {
  const blank = kind === 'blank'
  const session = { blank, awaitingFirstTurn: false, running: false }
  const viewProps = {
    useSession: pick => pick(session), useConversation: pick => pick({ activeTargets: new Set() }),
    useConversationViews: pick => pick([{ id: 'chat' }]), useStore: pick => pick({ view: 'chat' }), useInspectCall: pick => pick(null),
    actions: {}, inputActions: { persistDraft() {} }, bindDraftPersistence: () => () => {},
    renderSlot: () => React.createElement('div', { 'data-test-transcript': '', style: { minHeight: kind === 'long' ? 1400 : 80 } }, 'Native view content'),
  }
  const content = renderToStaticMarkup(React.createElement(NativeContent, {
    sessionId: 'test-bot', variant: 'embedded', phase: 'active', hero: false,
    useSession: pick => pick(session), useSessions: pick => pick({ byId: {} }), useSessionStatus: pick => pick(new Map()),
    useInput: pick => pick({}), useWorkspaces: pick => pick({ items: [], phase: 'ready' }), useComposerBlock: pick => pick(undefined),
    useFactorySlot: name => name === 'views' ? () => React.createElement(NativeViews, viewProps) : () => null,
    renderSlot: (name, _owner, options) => name === 'conversation.composer.bar'
      ? React.createElement('textarea', { 'aria-label': 'Native composer', style: { height: 72, boxSizing: 'border-box', width: '100%', resize: 'none' } })
      : name === 'conversation.hero.frame' ? options.children : null,
    renderSlotChain: (_name, _props, options) => options.fallback, t: value => value,
  }))
  return `<!doctype html><style>html,body{margin:0;height:100%}.host{display:flex;height:100%;min-width:0}.primary{flex:0 0 56px}.secondary{flex:0 0 ${sidebarWidth}px}.seal-nav-content{display:flex;flex:1;flex-direction:column;height:100%;min-width:0;min-height:0}.seal-nav-content>:last-child{min-height:0;flex:1}${nativeCss}${shell}</style>
    <div class="host"><nav class="primary"></nav><aside class="secondary"></aside><main class="seal-nav-content"><div class="seal-bot-layout"><section class="seal-bot-chat-seat"><div class="seal-bot-session" data-seal-bot-session><div class="seal-bot-header">Bot header</div>${content}</div></section></div></main></div>`
}

test('real Chromium keeps the native Bot composer docked for blank, short and scrollable conversations', { skip: !existsSync(executablePath) && 'set SEAL_TEST_CHROMIUM to an installed Chromium binary' }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath })
  t.after(() => browser.close())
  const page = await browser.newPage()
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const sidebarWidth of viewport.width < 700 ? [56] : [300, 56]) {
      for (const kind of ['blank', 'short', 'long']) {
        await page.setContent(html(kind, sidebarWidth))
        const before = await page.evaluate(() => {
          const content = document.querySelector('[data-conversation-content]'), scroll = document.querySelector('[data-conversation-scroll]'), composer = document.querySelector('[data-composer-seat]')
          const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height } }
          return { content: rect(content), scroll: rect(scroll), composer: rect(composer), session: rect(document.querySelector('[data-seal-bot-session]')), header: rect(document.querySelector('.seal-bot-header')), transcript: document.querySelector('[data-test-transcript]') ? rect(document.querySelector('[data-test-transcript]')) : null, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, pageWidth: document.documentElement.scrollWidth }
        })
        const label = `${viewport.width}x${viewport.height}/${sidebarWidth}/${kind}`
        assert(Math.abs(before.composer.bottom - before.session.bottom) <= 1, `${label}: composer must stay at the bottom: ${JSON.stringify(before)}`)
        assert.equal(before.session.height, viewport.height, `${label}: session fills the host main`)
        assert(before.scroll.height > viewport.height / 2, `${label}: native scrollport fills remaining height`)
        assert(before.pageWidth <= viewport.width, `${label}: no horizontal overflow`)
        if (kind === 'blank') assert.equal(before.transcript, null, 'the actual native blank views render no spacer')
        else assert(Math.abs(before.transcript.top - before.header.bottom) <= 1, `${label}: messages start below the header`)
        if (kind === 'long') {
          assert(before.scrollHeight > before.clientHeight, `${label}: long content remains scrollable`)
          const end = await page.evaluate(() => {
            const scroll = document.querySelector('[data-conversation-scroll]'); scroll.scrollTop = scroll.scrollHeight
            return { top: scroll.scrollTop, composerBottom: document.querySelector('[data-composer-seat]').getBoundingClientRect().bottom, scrollBottom: scroll.getBoundingClientRect().bottom }
          })
          assert(end.top > 0, `${label}: the scrollport reaches older and newer content`)
          assert(Math.abs(end.composerBottom - end.scrollBottom) <= 1, `${label}: composer stays docked after scrolling`)
        }
      }
    }
  }
})
