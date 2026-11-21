import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { install as installBotPrompt } from '../src/host/prompt.js'

const fromDesktop = name => import(pathToFileURL(desktopRequire.resolve(name)).href)

test('native Team policy is opt-in for ordinary sessions while Bot requests keep their own identity', async t => {
  const [{ Context }, { default: SystemPrompt, renderContextSections, renderPrompt }, { default: ToolRuntime }, { createScope }, nativeTeam, nativeExecutor] = await Promise.all([
    fromDesktop('@deepseek-ai/cordis'),
    fromDesktop('@deepseek-ai/dsh-system-prompt'),
    fromDesktop('@deepseek-ai/dsh-tools'),
    fromDesktop('@deepseek-ai/dsh-scope'),
    fromDesktop('@deepseek-ai/dsh-tool-agent-team'),
    fromDesktop('@deepseek-ai/dsh-tool-executor-native'),
  ])
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, { personaPrefix: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(nativeExecutor)
  const agents = []
  await ctx.plugin(Object.assign(inner => {
    for (const id of ['bot-111', 'bot-main', 'room', 'office']) {
      const agent = { id: `agent-${id}`, session: { id } }
      agent.ctx = createScope(inner, agent).ctx
      agents.push(agent)
    }
  }, { inject: ['systemPrompt', 'tools'] }))
  ctx.provide('agents', { list: () => agents })
  ctx.provide('subagents', {})
  ctx.provide('agentTeams', { isEnabled: agent => agent.session.id === 'office' })
  await ctx.plugin(nativeTeam)

  const [bot, main, room, office] = agents
  const stale = await ctx.systemPrompt.assemble({ scope: bot, agent: bot })
  assert.doesNotMatch(renderPrompt(stale), /Agent Teams is available|Team Lead named "lead"/)

  const bots = { 'bot-111': { name: '111', role: '研究助理' }, 'bot-main': { name: 'Seal Bot' } }
  await ctx.plugin(Object.assign(inner => installBotPrompt({
    ctx: inner,
    selfOf: id => Object.hasOwn(bots, id) ? id : undefined,
    botOf: id => bots[id],
    isMain: id => id === 'bot-main',
    roomOf: id => id === 'room' ? { id } : undefined,
  }), { inject: ['systemPrompt'] }))

  const contextsAtAdmission = (assembly, scope) => renderContextSections(ctx.systemPrompt.refreshContext(assembly, { scope }))
  assert.equal(contextsAtAdmission(stale, bot).some(section => section.name === 'team:identity'), false)
  for (const agent of [bot, main, room]) {
    const assembly = await ctx.systemPrompt.assemble({ scope: agent, agent })
    assert.equal(contextsAtAdmission(assembly, agent).some(section => section.name === 'team:identity'), false)
    const prompt = renderPrompt(assembly)
    assert.doesNotMatch(prompt, /Agent Teams is available|Team Lead named "lead"/)
    if (agent === bot) {
      assert.match(prompt, /You are 111.*Your role: 研究助理/)
      assert.doesNotMatch(prompt, /You are the Main Bot/)
    } else if (agent === main) {
      assert.match(prompt, /You are Seal Bot/)
      assert.match(prompt, /You are the Main Bot/)
    } else {
      assert.match(prompt, /You are only the relay/)
    }
  }
  const ordinary = await ctx.systemPrompt.assemble({ scope: office, agent: office })
  assert.match(renderPrompt(ordinary), /Agent Teams is available in this session/)
  assert.doesNotMatch(renderPrompt(ordinary), /You are Seal Bot|You are only the relay/)
})
