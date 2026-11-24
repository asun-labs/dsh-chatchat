import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bindSharedActions, installSharedSettings } from '../src/client/shared-actions.js'

test('Bot settings stay local while an explicit host bridge selects shared settings and panels', () => {
  const calls = []
  const actions = {
    openSettings: (...args) => calls.push(['own', ...args]),
    closeSettings: () => calls.push(['closeSettings']),
    closePanel: () => calls.push(['closePanel']),
  }
  bindSharedActions(actions, { selectPanel: id => calls.push(['panel', id]), openSection: id => calls.push(['section', id]), schedulePanelId: 'host-schedules' })
  actions.openSettings('bots', '11')
  actions.openSettings('groups', 'group')
  assert.deepEqual(calls.splice(0), [['own', 'bots', '11'], ['own', 'groups', 'group']])
  actions.openModels()
  assert.deepEqual(calls.splice(0), [['closeSettings'], ['section', 'models']])
  actions.openHarnessOnboarding('deepseek-official')
  assert.deepEqual(calls.splice(0), [['closeSettings'], ['section', 'models']])
  actions.openSettings('dsh', 'plugins')
  assert.deepEqual(calls.splice(0), [['closeSettings'], ['section', 'plugins']])
  actions.openConnectors()
  assert.deepEqual(calls.splice(0), [['closePanel'], ['closeSettings'], ['panel', 'connectors']])
  actions.openSettings('schedules', '11')
  assert.deepEqual(calls, [['closePanel'], ['closeSettings'], ['panel', 'host-schedules']])
})

test('standalone settings preserve the original actions and optional integration receives the same context', () => {
  const calls = []
  const ctx = {}
  const openSettings = (...args) => calls.push(args)
  const actions = { openSettings }
  installSharedSettings(ctx, actions)
  assert.equal(actions.openSettings, openSettings)
  actions.openSettings('schedules', 'bot-11')
  assert.deepEqual(calls, [['schedules', 'bot-11']])
  let installed = 0
  installSharedSettings(ctx, actions, { installSettings(actualContext, actualActions) {
    assert.equal(actualContext, ctx)
    assert.equal(actualActions, actions)
    installed++
  } })
  assert.equal(installed, 1)
})

test('the generic host bridge uses the public schedules panel by default', () => {
  const calls = []
  const actions = { openSettings() {}, closePanel() {}, closeSettings() {} }
  bindSharedActions(actions, { selectPanel: id => calls.push(id), openSection() {} })
  actions.openSettings('schedules')
  assert.deepEqual(calls, ['schedules'])
})

test('native model setup uses the current native settings store instead of the trimmed Bot dialog', () => {
  const calls = []
  let entry
  const ctx = { slots: { entries(name) {
    assert.equal(name, 'sidebar.settings')
    return entry ? [entry] : []
  } } }
  const actions = {
    openSettings: () => calls.push('bot-settings'),
    closeSettings: () => calls.push('close-bot-settings'),
    reportError: error => calls.push(error.message),
  }
  installSharedSettings(ctx, actions)
  actions.openModels()
  assert.match(calls.pop(), /Model settings are unavailable/)
  entry = { store: { create: () => ({ actions: { openSection: id => calls.push(['native', id]) } }) } }
  actions.openModels()
  actions.openHarnessOnboarding('deepseek-official')
  assert.deepEqual(calls, ['close-bot-settings', ['native', 'models'], 'close-bot-settings', ['native', 'models']])
  calls.length = 0
  actions.returnToNative = () => calls.push('native-surface')
  actions.openModels()
  assert.deepEqual(calls, ['close-bot-settings', 'native-surface', ['native', 'models']])
})
