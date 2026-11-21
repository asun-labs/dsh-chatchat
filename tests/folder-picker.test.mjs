import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { teamActions } from '../src/client/team-actions.js'

test('desktop Bot folders prefer the existing native chooser and keep the selected path', async t => {
  const previous = globalThis.window
  t.after(() => { globalThis.window = previous })
  const paths = ['C:\\Users\\Example\\Documents\\新工作区', null]
  let picks = 0
  globalThis.window = { __DSH_DESKTOP_PICK_DIRECTORY__: async () => { picks++; return paths.shift() } }
  const calls = []
  const info = { picker: 'browse', team: '/team', folders: [{ path: '/known', title: 'Known' }] }
  const actions = teamActions({
    call: async (endpoint, payload) => {
      calls.push([endpoint, payload])
      if (endpoint === 'folders') return info
      if (endpoint === 'team-workspace') return payload.path
      assert.fail(`unexpected host request ${endpoint}`)
    },
    after: promise => promise,
  })
  assert.deepEqual(await actions.folders(), { ...info, picker: 'native' })
  assert.equal(info.picker, 'browse')
  const selected = await actions.folderPick()
  assert.equal(selected, 'C:\\Users\\Example\\Documents\\新工作区')
  assert.equal(await actions.setTeamWorkspace(selected), selected)
  assert.equal(await actions.folderPick(), null)
  assert.equal(picks, 2)
  assert.deepEqual(calls.map(([endpoint]) => endpoint), ['folders', 'team-workspace'])
  globalThis.window.__DSH_DESKTOP_PICK_DIRECTORY__ = async () => { throw new Error('native chooser failed') }
  await assert.rejects(actions.folderPick(), /native chooser failed/)
  assert.equal(calls.length, 2)
})

test('without a desktop bridge Bot folders retain the host picker and browse actions', async t => {
  const previous = globalThis.window
  t.after(() => { globalThis.window = previous })
  globalThis.window = {}
  const calls = []
  const info = { picker: 'browse', team: '/remote/team', folders: [] }
  const actions = teamActions({ call: async (endpoint, payload) => {
    calls.push([endpoint, payload])
    if (endpoint === 'folders') return info
    if (endpoint === 'folder-pick') return '/host/chosen'
    if (endpoint === 'folder-list') return { path: payload.path, entries: [] }
    assert.fail(endpoint)
  } })
  assert.equal(await actions.folders(), info)
  assert.equal(await actions.folderPick(), '/host/chosen')
  assert.deepEqual(await actions.folderList('/remote'), { path: '/remote', entries: [] })
  assert.deepEqual(calls.map(([endpoint]) => endpoint), ['folders', 'folder-pick', 'folder-list'])
})

test('Bot, group and team folder menus use the native bridge and cancellation keeps the saved directory', async t => {
  const require = createRequire(import.meta.url)
  const { build } = require('esbuild')
  const { chromium } = require('playwright')
  const fixture = await build({
    stdin: { resolveDir: fileURLToPath(new URL('..', import.meta.url)), contents: `
      import React, { useState } from 'react'
      import { createRoot } from 'react-dom/client'
      import { FolderMenu } from './src/client/folder-menu.js'
      import { teamActions } from './src/client/team-actions.js'
      window.events = []
      window.chosen = 'D:/素材/新项目'
      window.__DSH_DESKTOP_PICK_DIRECTORY__ = async () => {
        window.events.push(['native-pick'])
        return window.chosen
      }
      const actions = teamActions({
        call: async (endpoint, payload) => {
          window.events.push([endpoint, payload])
          if (endpoint === 'folders') return { picker: 'browse', folders: [], team: 'D:/team' }
          if (['update-bot', 'update-room', 'team-workspace'].includes(endpoint)) return payload
          throw Error('Unexpected request ' + endpoint)
        },
        after: promise => promise,
      })
      function Scene({ kind }) {
        const [value, setValue] = useState('D:/original')
        const onPick = async path => {
          if (kind === 'team') await actions.setTeamWorkspace(path)
          else if (kind === 'group') await actions.updateRoom('group-1', { workDir: path })
          else await actions.updateBot('bot-1', { workDir: path })
          setValue(path)
        }
        return React.createElement(FolderMenu, {
          value, actions, onPick, run: promise => promise, group: kind === 'group', team: kind === 'team',
        })
      }
      createRoot(document.querySelector('main')).render(React.createElement(Scene, { kind: window.kind }))
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"', __SEAL_DOT_ICON__: '""' },
  })
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  t.after(() => browser.close())
  for (const kind of ['bot', 'group', 'team']) await t.test(kind, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
    try {
      await page.setContent('<!doctype html><main style="margin:80px"></main>')
      await page.evaluate(kind => { window.kind = kind }, kind)
      await page.addScriptTag({ content: fixture.outputFiles[0].text })
      const trigger = page.locator('.bt-model-trigger')
      await trigger.click()
      await page.getByRole('menuitem', { name: 'Choose a folder…', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.bt-model-provider')?.textContent === 'D:/素材/新项目')
      const events = await page.evaluate(() => window.events)
      assert.deepEqual(events.map(([endpoint]) => endpoint), ['folders', 'native-pick',
        kind === 'team' ? 'team-workspace' : kind === 'group' ? 'update-room' : 'update-bot'])
      assert.equal(kind === 'team' ? events[2][1].path : events[2][1].workDir, 'D:/素材/新项目')
      await page.waitForFunction(() => !document.querySelector('[role="menu"]'))
      await page.evaluate(() => { window.chosen = null; window.events = [] })
      await trigger.click()
      await page.getByRole('menuitem', { name: 'Choose a folder…', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('[role="menu"]'))
      assert.deepEqual((await page.evaluate(() => window.events)).map(([endpoint]) => endpoint), ['folders', 'native-pick'])
      assert.equal(await page.locator('.bt-model-provider').textContent(), 'D:/素材/新项目')
    } finally { await page.close() }
  })
})
