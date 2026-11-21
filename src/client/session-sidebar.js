import { createSource } from './sources.js'

// 嵌入页独立呈现聊天，工作栏仍交给 DSH 按真实会话保存页签。
export function createBotSidebarSession(ctx) {
  const source = createSource(null)
  ctx.provide('sidebarSessionPanel', source)
  return {
    bind(sessionId) {
      const binding = sessionId ? { panelId: 'seal-dot', sessionId } : null
      source.set(binding)
      return () => { if (source.getSnapshot() === binding) source.set(null) }
    },
    toggle() {
      const sidebar = ctx.get('sidebarRight')
      if (!sidebar) throw new Error('右侧工作栏尚未加载，请稍后重试。')
      sidebar.toggleExpanded()
    },
  }
}
