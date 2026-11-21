import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

const canonical = path => {
  try { return realpathSync.native(path) } catch { return resolve(path) }
}

// Only the team's internal workspace is private. A Bot working in an ordinary
// user workspace does not make that workspace private.
export function createBotWorkspaceOwnership(rt) {
  const getSessionIds = () => {
    const ids = new Set()
    const add = id => { if (typeof id === 'string') ids.add(id) }
    const segments = parts => { for (const part of parts ?? []) add(part.sessionId) }
    for (const bot of Object.values(rt.state.bots ?? {})) {
      add(bot.id)
      add(bot.sessionId)
      segments(bot.segments)
    }
    for (const room of Object.values(rt.state.rooms ?? {})) {
      add(room.id)
      add(room.sessionId)
      segments(room.parts)
      for (const id of Object.values(room.sessions ?? {})) add(id)
      for (const parts of Object.values(room.segments ?? {})) segments(parts)
    }
    for (const archive of rt.state.privateArchives ?? []) for (const id of archive.sessionIds ?? []) add(id)
    return [...ids]
  }
  return {
    ready: () => rt.load(),
    owns: id => rt.selfOf(id) !== undefined || rt.roomOf(id) !== undefined,
    getSessionIds,
    ownsWorkspace: id => {
      if (rt.state.workspaceId === id) return true
      const workspace = rt.ctx.workspaceRegistry?.get(id)
      return workspace !== undefined && canonical(workspace.path) === canonical(rt.defaultTeamFolder())
    },
    subscribe: listener => rt.onSaved(listener),
  }
}
