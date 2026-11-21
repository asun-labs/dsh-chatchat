import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sidebarGroups } from '../src/client/sidebar-groups.js'

test('Bot sidebar separates Bots and group chats without losing custom sections', () => {
  const sections = [{ id: 'bots' }, { id: 'rooms' }, { id: 'mixed' }]
  const entry = (kind, id, sectionId) => ({ kind, item: { id, sectionId } })
  const order = [
    entry('room', 'free-room'), entry('bot', 'free-bot'), entry('agent', 'free-agent'),
    entry('bot', 'named-bot', 'bots'), entry('room', 'named-room', 'rooms'),
    entry('room', 'mixed-room', 'mixed'), entry('bot', 'mixed-bot', 'mixed'),
    entry('bot', 'orphan', 'deleted-section'),
  ]
  const groups = sidebarGroups(order, sections)
  assert.deepEqual(groups.bots.map(entry => entry.item.id), ['free-bot', 'free-agent', 'orphan'])
  assert.deepEqual(groups.rooms.map(entry => entry.item.id), ['free-room'])
  assert.deepEqual(groups.botSections.map(section => section.id), ['bots', 'mixed'])
  assert.deepEqual(groups.roomSections.map(section => section.id), ['rooms'])
  assert.deepEqual(groups.ungrouped.map(entry => entry.item.id), ['free-room', 'free-bot', 'free-agent', 'orphan'])
})
