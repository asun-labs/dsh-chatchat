const profile = Object.freeze({ id: 'dsh', hostName: 'DSH', botName: 'DSH Bot', agentName: 'DSH Agent' })

export function brandProfile(id = 'dsh') {
  // Older hosts may still pass their former branding option. It no longer
  // changes the plugin's identity, but must not prevent those hosts loading it.
  if (id !== 'dsh' && id !== 'seal') throw new Error('Unknown ChatChat host brand')
  return profile
}

export function agentDisplayName(agent, brand) {
  const name = agent?.name
  return !name || ['DSH Agent', 'Seal Agent'].includes(name) ? brand.agentName : name
}
