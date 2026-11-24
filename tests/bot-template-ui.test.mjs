import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createPayload } from '../src/client/bot-draft.js'

test('normal creation preserves responsibilities separately from the first message', () => {
  const value = createPayload({ name: 'Writer', look: {}, instructions: '  Write proposals  ', brief: 'Start now' })
  assert.equal(value.instructions, 'Write proposals')
  assert.equal(value.brief, 'Start now')
})

test('template picker switches system/personal, requires only a name and submits immutable selection', async t => {
  const dom = new JSDOM('<main></main>', { pretendToBeVisual: true })
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  // React 的旧输入事件探测在先导入 react-dom 的 JSDOM 测试中需要这两个 DOM 方法。
  dom.window.HTMLInputElement.prototype.attachEvent = () => {}
  dom.window.HTMLInputElement.prototype.detachEvent = () => {}
  const built = await build({ entryPoints: ['src/client/create-bot-template.js'], bundle: true, write: false, format: 'cjs', platform: 'node',
    define: { __SEAL_DOT_ICON__: '"data:image/png;base64,fixture"', __SEAL_BOT_ROBOT_AVATARS__: '[]' }, external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'] })
  const module = { exports: {} }, require = createRequire(import.meta.url)
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, require, window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, setTimeout, clearTimeout, setInterval, clearInterval })
  const root = createRoot(document.querySelector('main'))
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous) })
  const calls = [], created = []
  const actions = { botTemplates: async () => ({ items: [
    { id: 'system:writer', revision: 'v1', directory: 'system', displayName: 'Writer', description: 'Proposals' },
    { id: 'personal:researcher', revision: 'v2', directory: 'personal', displayName: 'Researcher', description: 'Evidence' },
  ] }), createBotFromTemplate: async input => { calls.push(input); return { id: 'new' } } }
  await act(async () => root.render(React.createElement(module.exports.CreateBotTemplate, { roster: { bots: [] }, actions, start: { sectionId: 'folder' }, onBack() {}, onCreated: value => created.push(value) })))
  const click = async text => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes(text))
    assert.ok(button, text); await act(async () => button.click())
  }
  assert.match(document.body.textContent, /Writer/)
  assert.doesNotMatch(document.body.textContent, /Researcher/)
  await click('Personal')
  await click('Researcher')
  assert.equal(document.querySelectorAll('input').length, 1, 'only a name is editable')
  assert.equal(document.querySelector('input').value, 'Researcher')
  await click('Create')
  assert.equal(calls[0].templateId, 'personal:researcher')
  assert.equal(calls[0].expectedRevision, 'v2')
  assert.equal(calls[0].sectionId, 'folder')
  assert.deepEqual(Object.keys(calls[0]).sort(), ['expectedRevision', 'name', 'sectionId', 'templateId'])
  assert.equal(created[0].id, 'new')
})
