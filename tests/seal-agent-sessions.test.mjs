import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexRoster, sealAgentSessions } from '../src/client/sources.js'

test('Seal Agent folder projects native sessions without stealing Bot, room or DSH Agent sessions', () => {
  const roster = indexRoster({
    bots: [{ id: 'bot', parts: ['bot', 'bot-next'] }],
    rooms: [{ id: 'room', ownParts: ['room-old'] }],
    agents: [{ id: 'agent', sessions: ['agent-chat'] }], sections: [],
  })
  const list = { ids: ['seal-old', 'bot', 'bot-next', 'room', 'room-old', 'agent-chat', 'child', 'seal-new'], byId: {
    'seal-old': { id: 'seal-old', updatedAt: 1 }, bot: { id: 'bot' }, 'bot-next': { id: 'bot-next' },
    room: { id: 'room' }, 'room-old': { id: 'room-old' }, 'agent-chat': { id: 'agent-chat' },
    child: { id: 'child', origin: 'subagent' }, 'seal-new': { id: 'seal-new', updatedAt: 2 },
  } }
  assert.deepEqual(sealAgentSessions(list, roster, new Set(['seal-old'])).map(row => row.id), ['seal-new'])
  assert.equal(list.ids.length, 8)
})
