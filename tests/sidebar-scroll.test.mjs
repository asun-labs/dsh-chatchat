import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/sidebar.js', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  define: { __SEAL_DOT_ICON__: '""', __SEAL_BOT_ROBOT_AVATARS__: '[]' },
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports,
  // This SSR fixture checks DOM ownership; effects and pixel scrolling are covered by the browser smoke.
  require: name => name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : name === 'react' ? { ...React, useLayoutEffect: React.useEffect } : require(name),
})
const { TeamSidebar } = module.exports

for (const wide of [true, false]) {
  test(`Main Bot stays outside the scrolling list in ${wide ? 'expanded' : 'rail'} mode`, () => {
    const main = { id: 'main', name: 'Seal Bot', role: 'Coordinator' }
    const bot = { id: 'bot', name: 'Writer', createdAt: 1 }
    const room = { id: 'room', name: 'Group', members: ['main', 'bot'], createdAt: 2 }
    const roster = { ready: true, mainBotId: 'main', bots: [main, bot], rooms: [room], byId: { main, bot }, roomsById: { room }, agentOf: {}, exchangeTurns: {} }
    const html = renderToStaticMarkup(React.createElement(TeamSidebar, {
      embedded: true, wide,
      useRoster: pick => pick(roster), useUi: pick => pick({ unread: {} }), useRegistry: pick => pick({}),
      useSessions: pick => pick({ ids: ['office'], byId: { office: { id: 'office', title: 'Office session' } } }),
      useSessionStatus: pick => pick(new Map()), useSessionRetainInfo: (_id, pick) => pick({}), useActivity: pick => pick({}),
      actions: {},
    }))
    const dom = new JSDOM(html)
    try {
      const sidebar = dom.window.document.querySelector('.bt-side')
      const list = sidebar.querySelector('.bt-list')
      const tile = sidebar.querySelector('[data-bot-id="main"]')
      assert.ok(tile)
      assert.equal(list.contains(tile), false, 'scrolling Bot, group and Seal Agent entries must leave the Main Bot fixed')
      assert.ok(list.querySelector('[data-bot-id="bot"]'))
      assert.ok(list.querySelector('[data-room-id="room"]'))
      assert.ok(list.querySelector('.bt-seal-folder'))
      assert.equal(sidebar.querySelectorAll('[data-bot-id="main"]').length, 1)
    } finally { dom.window.close() }
  })
}
