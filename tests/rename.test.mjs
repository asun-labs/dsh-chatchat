import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrateStorage, STORAGE } from '../src/client/storage.js'

test('package rename retains existing Seal Bot browser state and isolates independent DS-Bot state', () => {
  const values = new Map([
    ['seal-dot:unread', '{"bot-11":true}'],
    ['seal-dot:seen', '{"room-1":123}'],
    ['seal-dot:prefs', '{"theme":"paper"}'],
    ['seal-dot:agent-sessions', '["session-11"]'],
    ['seal-dot.browser.v2', '{"bot-11":{"tabs":[{"id":"tab-1","url":"https://example.test"}],"active":"tab-1"}}'],
    ['dsh-bot:prefs', '{"theme":"mono"}'],
  ])
  const before = [...values]
  migrateStorage({ getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) })
  assert.deepEqual([...values], before)
  assert.equal(values.get(STORAGE.unread), '{"bot-11":true}')
  assert.equal(values.get(STORAGE.agentSessions), '["session-11"]')
  assert.equal(JSON.parse(values.get(STORAGE.browsers))['bot-11'].active, 'tab-1')
})
