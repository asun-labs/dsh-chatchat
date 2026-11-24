import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRuntime } from './runtime-profile.mjs'
import { fakeContext } from './fake-ctx.js'

test('template creation binds before use, persists its snapshot, rolls back failure and releases the last copy', async t => {
  const home = mkdtempSync(join(tmpdir(), 'bot-templates-'))
  writeFileSync(join(home, 'state.json'), JSON.stringify({ version: 1, revision: 1, mainBotIds: ['chief'], whaleStored: true,
    bots: { chief: { id: 'chief', name: 'Chief', instructions: '', createdAt: 1 } }, rooms: {}, exchanges: [], exchangeTurns: {}, questions: {} }))
  const ctx = fakeContext(), bound = [], discarded = []
  let sequence = 0, rejectBinding = false, route
  Object.assign(ctx, {
    workspaceRegistry: { get: () => ({ id: 'w1' }), resolveByPath: async () => undefined, create: async () => ({ id: 'w1' }), archiveSession: async () => {} },
    sessionController: { create: async () => ({ sessionId: `new${++sequence}` }), resolveAgent: async id => ({ agent: { id, session: { id } } }) },
    sessionTitle: { rename: async () => {} }, sessions: { flush: async () => {} },
  })
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = options => { route = options; return register(options) }
  const reference = { name: 'immutable', version: '1.0.0', digest: 'a'.repeat(64) }
  const rt = createRuntime(ctx, { home, botTemplates: {
    list: async () => ({ items: [{ id: 'system:writer' }] }),
    prepare: async () => ({ reference, defaults: { instructions: 'Write proposals', role: 'Writer' } }),
    prepareAgent: async input => { if (rejectBinding) throw new Error('missing connector'); bound.push(input) },
    discard: async ref => discarded.push(ref),
  } })
  t.after(async () => { await ctx.dispose(); rmSync(home, { recursive: true, force: true, maxRetries: 5 }) })
  const call = async (endpoint, payload) => (await route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))).json()
  assert.equal((await call('bot-templates', {})).ok, true)
  const result = await call('create-bot-template', { templateId: 'system:writer', name: 'Writer', instructions: 'forged' })
  assert.equal(result.ok, true, JSON.stringify(result))
  const bot = rt.botOf('new1')
  assert.equal(bot.instructions, 'Write proposals')
  assert.deepEqual(bot.template, reference)
  assert.equal(bound[0].bot.id, bot.id)
  const restored = { id: bot.id, session: { id: bot.id } }
  await ctx.listeners.get('agent/created')[0]({ agent: restored })
  assert.equal(bound.at(-1).agent, restored, 'native Session creation restores template abilities before the first request')
  await rt.updateBot(bot.id, { instructions: 'Independent edit' })
  assert.equal(bot.instructions, 'Independent edit')
  const copy = await rt.duplicateBot(bot.id)
  assert.deepEqual(copy.template, reference)
  await rt.deleteBot(bot.id)
  assert.equal(discarded.length, 0, 'a duplicate still owns the immutable snapshot')
  await rt.deleteBot(copy.id)
  assert.equal(discarded.length, 1)
  rejectBinding = true
  const failed = await call('create-bot-template', { templateId: 'system:writer', name: 'Rejected' })
  assert.equal(failed.ok, false)
  assert.equal(discarded.length, 2)
  assert.ok(!Object.values(rt.state.bots).some(item => item.name === 'Rejected'))
})
