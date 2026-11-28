const profiles = Object.freeze({
  dsh: Object.freeze({ id: 'dsh', hostName: 'DSH', botName: 'DSH Bot', agentName: 'DSH Agent' }),
  seal: Object.freeze({ id: 'seal', hostName: 'Seal Harness', botName: 'Seal Bot', agentName: 'Seal Agent' }),
})

export function brandProfile(id = 'dsh') {
  if (!Object.hasOwn(profiles, id)) throw new Error('Unknown ChatChat host brand')
  return profiles[id]
}

export function agentDisplayName(agent, brand) {
  const name = agent?.name
  return !name || ['DSH Agent', 'Seal Agent'].includes(name) ? brand.agentName : name
}
