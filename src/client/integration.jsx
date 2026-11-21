import { createElement as h, useLayoutEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

// 宿主可提供导航适配；普通 DSH 安装沿公开 main/sidebar 槽呈现相同 Bot 页面。
export function registerPanel(ctx, options, Panel, integration = {}) {
  if (typeof integration.registerPanel === 'function') return integration.registerPanel(ctx, options, Panel)
  let target = null
  const listeners = new Set()
  const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
  const setTarget = element => { target = element; for (const listener of listeners) listener() }
  function Sidebar({ children }) {
    const seat = useSyncExternalStore(subscribe, () => target)
    return seat ? createPortal(children, seat) : null
  }
  function SidebarOutlet() {
    return h('div', { ref: setTarget, style: { display: 'flex', flex: 1, minHeight: 0, height: '100%' } })
  }
  function Main() {
    useLayoutEffect(() => ctx.slots.register({ name: 'sidebar.workspaces', priority: -100 }, SidebarOutlet), [])
    return h(Panel, { Sidebar, onLeaveOfficeMode: () => ctx.layout.selectPanel(null) })
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: options.id }, Main))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: options.id, label: options.label, order: options.order,
  }, ({ size = 18 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
    h('rect', { x: 4, y: 7, width: 16, height: 13, rx: 3 }),
    h('path', { d: 'M12 3v4M8 12h1m6 0h1M9 16h6' }))))
}
