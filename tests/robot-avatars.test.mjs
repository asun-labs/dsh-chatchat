import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

const catalogDir = fileURLToPath(new URL('../assets/avatar-catalog/', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../assets/avatar-catalog/catalog.json', import.meta.url), 'utf8'))
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const catalog = manifest.map(entry => ({
  ...entry,
  image: `data:image/png;base64,${readFileSync(`${catalogDir}/${entry.id}.png`).toString('base64')}`,
}))

globalThis.__SEAL_DOT_ICON__ = 'data:image/png;base64,AA=='
globalThis.__SEAL_BOT_ROBOT_AVATARS__ = catalog
const { AvatarEditor } = await import('../src/client/bot-settings.js')
const { CreateBot } = await import('../src/client/create-bot.js')
const { isRobotAvatar } = await import('../src/client/robot-avatars.js')
const { SHELL_CSS, botOwnCss } = await import('../src/client/styles.js')
const { BotMark, BotAvatar } = await import('../src/client/mark.js')
const { DICTIONARY, installLocale } = await import('../src/client/i18n.js')

test('curated robot avatars are distinct 160 px PNGs small enough for the Bot avatar field', () => {
  assert.equal(manifest.length, 16)
  assert.deepEqual(new Set(manifest.map(item => item.style)), new Set(['ip-as-logo']))
  const images = new Set()
  let totalBytes = 0
  for (const item of manifest) {
    const image = readFileSync(`${catalogDir}/${item.id}.png`)
    assert.ok(image.subarray(0, 8).equals(pngMagic), item.id)
    assert.equal(image.readUInt32BE(16), 160, item.id)
    assert.equal(image.readUInt32BE(20), 160, item.id)
    assert.ok(image.length < 120_000, item.id)
    assert.ok(item.label && item.originalName)
    assert.match(item.source, /^https:\/\/cdn\.ipaslogo\.com\/logos\/.+\.png$/)
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/)
    assert.equal(createHash('sha256').update(image).digest('hex'), item.sha256)
    images.add(image.toString('base64'))
    totalBytes += image.length
  }
  assert.equal(images.size, manifest.length)
  assert.ok(totalBytes < 600_000, `catalog adds ${totalBytes} bytes before base64`)
  assert.match(readFileSync(`${catalogDir}/PROVENANCE.md`, 'utf8'), /ipaslogo\.com/)
})

test('the shared avatar editor picks and reopens robots in creation and editing', async t => {
  const dom = new JSDOM('<!doctype html><main></main>')
  dom.window.matchMedia = () => ({ matches: true })
  dom.window.Element.prototype.scrollIntoView = () => {}
  const previous = { window: globalThis.window, document: globalThis.document, Element: globalThis.Element, act: globalThis.IS_REACT_ACT_ENVIRONMENT, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: callback => setTimeout(() => callback(performance.now()), 0), cancelAnimationFrame: clearTimeout })
  const root = createRoot(document.querySelector('main'))
  t.after(async () => {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, { window: previous.window, document: previous.document, Element: previous.Element, IS_REACT_ACT_ENVIRONMENT: previous.act, requestAnimationFrame: previous.requestAnimationFrame, cancelAnimationFrame: previous.cancelAnimationFrame })
  })
  const updates = []
  const actions = { updateBot: async (id, patch) => { updates.push({ id, patch }) } }
  const run = promise => promise
  const draft = { id: 'new-bot', name: 'New Bot', avatar: null }

  await act(async () => root.render(React.createElement(AvatarEditor, {
    bot: draft, actions, run, onClose: () => {}, onUpdate: patch => { updates.push({ id: 'new-bot', patch }); return Promise.resolve() },
  })))
  assert.deepEqual([...document.querySelectorAll('[role=tab]')].map(node => node.textContent), ['Bot', 'Upload', 'Library'])
  assert.equal(document.querySelectorAll('.bt-robots-pick').length, 16)
  assert.equal(document.querySelector('.bt-avatar-backgrounds'), null)
  await act(async () => document.querySelector(`[aria-label="${catalog[3].label}"]`).click())
  assert.equal(updates[0].id, 'new-bot')
  assert.equal(updates[0].patch.avatar.image, catalog[3].image)
  assert.equal(isRobotAvatar(updates[0].patch.avatar.image), true)

  await act(async () => root.render(null))
  await act(async () => root.render(React.createElement(AvatarEditor, {
    bot: { ...draft, ...updates[0].patch }, actions, run, onClose: () => {},
  })))
  assert.equal(document.querySelector('[role=tab][aria-selected=true]').textContent, 'Bot')
  assert.equal(document.querySelector(`[aria-label="${catalog[3].label}"]`).getAttribute('aria-pressed'), 'true')
  await act(async () => document.querySelector(`[aria-label="${catalog[4].label}"]`).click())
  assert.equal(updates[1].id, 'new-bot')
  assert.equal(updates[1].patch.avatar.image, catalog[4].image)

  await act(async () => root.render(null))
  let created
  const createProps = {
    inline: true,
    roster: { bots: [], models: [], prefs: {} },
    actions: { createBot: async payload => { created = payload; return { id: 'created' } }, avatarLibrary: async () => ({ items: [] }) },
    onBack() {}, onCreated() {},
  }
  await act(async () => root.render(React.createElement(CreateBot, createProps)))
  assert.match(document.querySelector('.bt-note').textContent, /Add a provider and a model in Seal Harness first/)
  await act(async () => document.querySelector('.bt-model-trigger').click())
  assert.equal(document.querySelector('.bt-model-none').textContent, 'No models are set up in Seal Harness yet.')
  const disposeLocale = installLocale({
    register: () => () => {}, bind: () => key => DICTIONARY.zh[key] ?? key,
    getLocale: () => ({ active: 'zh' }),
  })
  try {
    await act(async () => root.render(React.createElement(CreateBot, createProps)))
    assert.match(document.querySelector('.bt-note').textContent, /请先在 Seal Harness 里添加服务商和模型/)
    assert.doesNotMatch(document.querySelector('.bt-note').textContent, /DeepSeek Harness/)
    assert.equal(document.querySelector('.bt-model-none').textContent, 'Seal Harness 里还没有设置模型。')
  } finally { disposeLocale() }
  await act(async () => root.render(null))
  await act(async () => root.render(React.createElement(CreateBot, createProps)))
  assert.equal(document.querySelectorAll('.bt-avedit-inline').length, 1)
  assert.equal(document.querySelectorAll('.bt-robots-pick').length, 16)
  assert.equal(document.querySelector('.bt-lib'), null, 'library import is not shown beside the upload controls')
  await act(async () => document.querySelector(`[aria-label="${catalog[0].label}"]`).click())
  await act(async () => [...document.querySelectorAll('button')].find(node => node.textContent === 'Create').click())
  assert.equal(created.avatar.image, catalog[0].image)
  await act(async () => [...document.querySelectorAll('[role=tab]')].find(node => node.textContent === 'Upload').click())
  assert.match(document.querySelector('.bt-dropzone').textContent, /this Bot only/)
  assert.equal(document.querySelector('.bt-lib'), null)
  await act(async () => [...document.querySelectorAll('[role=tab]')].find(node => node.textContent === 'Library').click())
  assert.equal(document.querySelector('.bt-dropzone'), null)
  assert.match(document.querySelector('.bt-lib').textContent, /Batch import to library/)
  assert.match(document.querySelector('.bt-lib').textContent, /reuse them across Bots/)

  await act(async () => root.render(React.createElement(BotMark, { bot: { id: 'live', avatar: { image: catalog[0].image } }, live: true, gaze: true })))
  assert.equal(document.querySelector('[data-catalog]').dataset.shape, 'image')
  assert.equal(document.querySelector('img').getAttribute('src'), catalog[0].image)
  assert.equal(document.querySelector('svg'), null, 'website artwork is used directly without redrawing face layers')
  await act(async () => root.render(React.createElement(BotAvatar, { bot: { id: 'main', avatar: { image: globalThis.__SEAL_DOT_ICON__ } }, size: 60, main: true })))
  assert.deepEqual([...document.querySelectorAll('[data-seal-part]')].map(node => node.dataset.sealPart).sort(), ['body', 'eyes', 'fin', 'mouth'])
  assert.equal(document.querySelectorAll('.bt-badge-main').length, 1)
  const ownCss = botOwnCss(SHELL_CSS)
  assert.match(ownCss, /\.seal-bot-mascot__eye\{[^}]*animation:seal-mascot-blink/)
  assert.match(ownCss, /button:hover[^}]*seal-bot-mascot__fin/)
  assert.equal(document.querySelector('.seal-bot-mascot__star'), null, 'the existing Main Bot badge supplies the single star')
  await act(async () => root.render(React.createElement(BotMark, { bot: { id: 'main', avatar: { image: globalThis.__SEAL_DOT_ICON__ } }, live: false })))
  assert.ok(document.querySelector('img'), 'transcript avatars stay static')
  const oldCatalogPhoto = 'data:image/png;base64,b2xkY2F0YWxvZw=='
  await act(async () => root.render(React.createElement(AvatarEditor, { bot: { id: 'old-catalog', avatar: { image: oldCatalogPhoto } }, actions, run, onClose() {} })))
  assert.equal(document.querySelector('[role=tab][aria-selected=true]').textContent, 'Upload')
  assert.equal(document.querySelector('.bt-dropzone img').getAttribute('src'), oldCatalogPhoto)
  const legacyPhoto = 'data:image/png;base64,bGVnYWN5'
  await act(async () => root.render(React.createElement(BotMark, { bot: { id: 'old', avatar: { image: legacyPhoto } }, live: true })))
  assert.equal(document.querySelector('img').getAttribute('src'), legacyPhoto)
  assert.equal(document.querySelector('[data-catalog]'), null, 'custom and previously selected images remain intact')
})
