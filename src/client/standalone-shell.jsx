import React, { useLayoutEffect } from 'react'
import { freePriority } from './surface.js'

const Sidebar = ({ children }) => <div style={{ display: 'none' }}>{children}</div>
const HeaderTools = ({ children, leadingTool }) => React.cloneElement(children, {}, leadingTool, children.props.children)

export function installStandaloneLauncher(ctx, actions, Icon) {
  function Launch() {
    useLayoutEffect(() => { actions.setSurface('bot') }, [])
    return null
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'chatchat' }, Launch))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'chatchat', label: 'ChatChat', order: 15,
  }, Icon))
}

// Release the public slot replacements to reveal the original DSH interface.
export function installStandaloneShell(ctx, Panel, actions) {
  const releases = []
  const shadow = (name, options, component) => ctx.slots.inject(name, () => ctx.slots.register({
    name, ...options, priority: freePriority(ctx.slots.entries(name), { ...options, priority: -100 }),
  }, component))
  let restoreWidth
  try {
    const root = ctx.slots.entries('root').find(entry => entry.store?.create)?.store.create()
    if (root?.actions?.setSidebar) {
      const width = root.getSnapshot().layoutInfo.sidebar
      root.actions.setSidebar(0)
      restoreWidth = () => root.actions.setSidebar(width)
    }
    const onLeaveOfficeMode = () => actions.setSurface('agent')
    function Main() {
      return <Panel Sidebar={Sidebar} HeaderTools={HeaderTools} standalone onLeaveOfficeMode={onLeaveOfficeMode} />
    }
    releases.push(shadow('sidebar', {}, () => null))
    releases.push(shadow('shell.leading', {}, () => null))
    releases.push(shadow('main', { key: 'conversation' }, Main))
    ctx.layout.selectPanel(null)
  } catch (error) {
    releases.reverse().forEach(release => release())
    restoreWidth?.()
    throw error
  }
  return () => {
    releases.reverse().forEach(release => release())
    restoreWidth?.()
  }
}
