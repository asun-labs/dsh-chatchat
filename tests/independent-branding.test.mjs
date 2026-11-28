import assert from 'node:assert/strict'
import test from 'node:test'
import { brandProfile, agentDisplayName } from '../src/shared/branding.js'
import { hostBranding } from '../src/host/brand.js'
import { installBranding, currentBrand, brandImage, isLegacyMascot } from '../src/client/branding.js'
import { t, hostText, installLocale, DICTIONARY } from '../src/client/i18n.js'

test('legacy host options cannot rebrand the independent plugin', () => {
  for (const config of [{}, { branding: 'seal' }, { integrated: true, identityService: 'sealHarnessIdentity' }]) {
    const brand = hostBranding(config)
    assert.equal(brand.id, 'dsh')
    assert.equal(brand.hostName, 'DSH')
    assert.equal(brand.botName, 'DSH Bot')
    assert.equal(brand.agentName, 'DSH Agent')
  }
  assert.equal(brandProfile('seal'), brandProfile('dsh'), 'old option remains an alias for compatibility')
  assert.equal(agentDisplayName({ name: 'Seal Agent' }, brandProfile()), 'DSH Agent')
  assert.equal(agentDisplayName({ name: 'My researcher' }, brandProfile()), 'My researcher')
})

test('Client brand aliases and late Host snapshots retain the independent name and icon', () => {
  const before = globalThis.__DSH_BOT_ICON__
  globalThis.__DSH_BOT_ICON__ = 'data:image/svg+xml;base64,ZHNo'
  const scope = installBranding('seal')
  try {
    assert.equal(currentBrand().id, 'dsh')
    assert.equal(brandImage(), globalThis.__DSH_BOT_ICON__)
    scope.update('seal')
    assert.equal(currentBrand().botName, 'DSH Bot')
    assert.equal(brandImage(), globalThis.__DSH_BOT_ICON__)
  } finally {
    scope.dispose()
    if (before === undefined) delete globalThis.__DSH_BOT_ICON__
    else globalThis.__DSH_BOT_ICON__ = before
  }
})

test('legacy avatars are recognized as saved user images without choosing a Host brand', () => {
  const before = globalThis.__SEAL_DOT_ICON__
  globalThis.__SEAL_DOT_ICON__ = 'data:image/png;base64,bGVnYWN5'
  try {
    assert.equal(isLegacyMascot(globalThis.__SEAL_DOT_ICON__), true)
    assert.equal(isLegacyMascot('data:image/svg+xml;base64,ZHNo'), false)
    assert.equal(isLegacyMascot('data:image/png;base64,Y3VzdG9t'), false)
    assert.equal(currentBrand().id, 'dsh')
  } finally {
    if (before === undefined) delete globalThis.__SEAL_DOT_ICON__
    else globalThis.__SEAL_DOT_ICON__ = before
  }
})

test('current Host wording is localized without changing user names or legacy message compatibility', () => {
  const dispose = installLocale({ getLocale: () => ({ active: 'zh' }), register: () => () => {}, bind: () => key => DICTIONARY.zh[key] ?? key })
  try {
    assert.equal(hostText('DSH ChatChat restarted before this answer finished.'), 'DSH ChatChat 在回答完成前重启了。')
    assert.equal(hostText('Seal Bot restarted before this answer finished.'), 'DSH Bot 在回答完成前重启了。')
    assert.equal(hostText('The API key for My Seal Bot is set outside DSH ChatChat and cannot be changed here'), 'My Seal Bot 的 API key 是在 DSH ChatChat 之外设置的，这里改不了')
    assert.equal(t('Message {name}', { name: 'Seal Bot' }), '给 Seal Bot 发消息')
  } finally { dispose() }
})
