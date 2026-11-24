import React, { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { createSource } from './sources.js'
import { currentPart } from './text.js'
import { TeamSidebar } from './sidebar.js'
import { HeaderPill } from './header.js'
import { Overlays } from './overlays.js'
import { ErrorToast } from './feedback.js'
import { DeepSeekSignIn } from './model-menu.js'
import { headerNavigation } from './header-navigation.js'
import { ChevronLeftIcon } from './icons.js'
import { chatRoom } from './frame-watch.js'

// 原版组件从 mainView 判断选中项。这里只投影显示，不切换或修改办公会话。
export function botSessionList(list, sessionId) {
  return { ...list, byId: Object.fromEntries(Object.entries(list.byId ?? {}).map(([id, row]) => [id, {
    ...row, retainedBy: { ...row.retainedBy, mainView: id === sessionId ? 1 : 0 },
  }])) }
}

const useSource = source => useSyncExternalStore(source.subscribe, source.getSnapshot)
const layout = `
.seal-bot-layout{display:flex;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--bt-main)}
.seal-bot-chat-seat{height:100%;min-width:0;min-height:0;display:flex;flex-direction:column}
.seal-bot-session{display:flex;flex:1;flex-direction:column;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--bt-main)}
.seal-bot-session>[data-slot="seal.bot.header"]{flex:none}
.seal-bot-header{display:flex;align-items:center;min-height:64px;position:relative}
.seal-bot-header .bt-head{flex:1;min-width:0}
.seal-bot-workbar{margin:0 16px 0 auto;z-index:1}
.seal-bot-views{display:grid;flex:none;min-width:0;padding:0 20px;border-bottom:1px solid var(--dsw-alias-border-l3)}
/* Bot 标题由上方头像栏呈现，原生 Header 在此提供页签与更多视图菜单。 */
.seal-bot-views [class*="_titleRow"]{display:none}
.seal-bot-session [data-conversation-content]{flex:1;min-height:0}
.seal-bot-session [data-composer-seat]{margin-top:auto}
.seal-bot-sidebar{display:flex;flex:1;flex-direction:column;width:100%;min-width:0;height:100%;min-height:0;color:var(--bt-ink);background:transparent;font-family:var(--bt-font)}
.seal-bot-chat-seat{flex:1}
.seal-bot-sidebar .bt-side{flex:1;min-height:0;width:100%;padding-right:0;background:transparent}
.seal-bot-sidebar .bt-side-top{justify-content:flex-end}
.seal-bot-sidebar .bt-side:not(.bt-rail)>.bt-list{margin-right:0;padding-inline:12px;box-sizing:border-box}
/* 主 Bot 固定在滚动列表外，但须沿用列表两侧 12px 内边距和右侧 12px 滚动条占位。 */
.seal-bot-sidebar .bt-side:not(.bt-rail)>.bt-row{flex-shrink:0;margin-inline:12px 24px;width:calc(100% - 36px)}
.seal-bot-sidebar .bt-seal-folder{padding-inline:0}
.seal-bot-sidebar .bt-rail{padding-inline:0}
.seal-bot-sidebar .bt-rail :is(.bt-row,.bt-rail-top){width:100%;min-width:0}
.seal-bot-sidebar .bt-rail .bt-row{height:44px;min-height:44px}
.seal-bot-sidebar .bt-rail .bt-row>:is(.bt-mark,.bt-cluster){zoom:.7}
.seal-bot-back{position:absolute;left:10px;top:8px;z-index:1}
.seal-bot-sidebar:has(.bt-rail) .seal-bot-back{position:static;align-self:center;flex:none;width:32px;height:32px;margin-bottom:8px}
.seal-bot-sidebar{position:relative}
`

export function EmbeddedBotPanel({ Sidebar, HeaderTools, onLeaveOfficeMode, actions }) {
  const [sidebar, setSidebar] = useState(null)
  const [chat, setChat] = useState(null)
  // Bot 独立模式只随整个页面进入/离开。
  useLayoutEffect(() => {
    actions.enterBotSurface()
    return actions.leaveBotSurface
  }, [actions])
  useLayoutEffect(() => {
    if (!sidebar || !chat) return undefined
    actions.mountSurface({ sidebar, chat, HeaderTools, onLeave: onLeaveOfficeMode })
  }, [sidebar, chat, HeaderTools, actions, onLeaveOfficeMode])
  return <>
    <Sidebar><aside className="seal-bot-sidebar" ref={setSidebar} aria-label="Bot 与群聊" /></Sidebar>
    <div className="seal-bot-layout">
      <section className="seal-bot-chat-seat" data-seal-dot-page ref={setChat} aria-label="Bot 会话" />
    </div>
  </>
}

export function installEmbeddedShell(ctx, { face, view, frame, sidebarPref, actions }) {
  const target = createSource(null)
  function SessionBody({ renderSlot, renderFactorySlot }) {
    return <div className="seal-bot-session" data-seal-bot-session>
      <div className="seal-bot-header">
        {renderSlot('seal.bot.header', {})}
        <div className="seal-bot-workbar">{renderSlot('seal.bot.workbar', {})}</div>
      </div>
      <div className="seal-bot-views">{renderSlot('seal.bot.views', {})}</div>
      {renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false })}
    </div>
  }
  function SurfaceSeat(props) {
    const seat = props.seat
    const selected = useSource(view)
    const team = props.useRoster(value => value)
    const list = props.useSessions(value => value)
    const fallback = team.byId[team.mainBotId]
    const sessionId = selected.sessionId ?? (fallback ? currentPart(fallback) : undefined)
    const listed = sessionId !== undefined && list.byId?.[sessionId] !== undefined
    const [ready, setReady] = useState(null)
    const [wide, setWide] = useState(true)
    useEffect(() => {
      if (!listed) return undefined
      let active = true
      const reference = ctx.sessions.retain(sessionId, { source: 'sealBotSurface' })
      void reference.ready.then(() => { if (active) setReady({ sessionId, reference }) })
        .catch(error => { if (active) actions.reportError(error, 'surface-session') })
      return () => { active = false; reference.release() }
    }, [sessionId, listed])
    useLayoutEffect(() => {
      const resize = () => {
        const rect = seat.sidebar.getBoundingClientRect()
        // 宿主侧栏的内边距仍放置顶部按钮；浮层从实际会话区开始，不能覆盖它们。
        const contentLeft = seat.chat.getBoundingClientRect().left
        const open = rect.width > 120
        setWide(open)
        sidebarPref.set(open ? 'open' : 'rail')
        frame.set(value => ({ ...value, viewport: window.innerWidth - rect.left, offset: rect.left, contentLeft, sidebarActualWidth: rect.width, sidebarWidth: open ? rect.width : value.sidebarWidth }))
      }
      const observer = new ResizeObserver(resize)
      observer.observe(seat.sidebar)
      observer.observe(seat.chat)
      resize()
      window.addEventListener('resize', resize)
      return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
    }, [seat])
    useEffect(() => {
      if (listed) return actions.bindSidebarSession(sessionId)
    }, [sessionId, listed])
    const displayList = useMemo(() => botSessionList(list, sessionId), [list, sessionId])
    const portable = {
      ...props,
      useSessions: selector => selector(displayList),
      useSessionRetainInfo: (id, selector) => props.useSessionRetainInfo(id, info => selector({ ...info, retainedBy: { ...info?.retainedBy, mainView: id === sessionId ? 1 : 0 } })),
      actions,
    }
    const Provider = props.SessionProvider
    const back = <button type="button" className="bt-round seal-bot-back" aria-label="返回办公" title="返回办公" onClick={seat.onLeave}><ChevronLeftIcon /></button>
    return <>
      <style>{layout}</style>
      {createPortal(<>
        {(!wide || !seat.HeaderTools) && back}
        <TeamSidebar {...portable} wide={wide} embedded HeaderTools={seat.HeaderTools} leadingTool={back} />
      </>, seat.sidebar)}
      {ready && ready.sessionId === sessionId ? createPortal(<Provider session={ready.reference}>
        {props.renderSlot('seal.bot.session', {})}
      </Provider>, seat.chat) : null}
      <Overlays {...portable} embedded />
      <ErrorToast {...portable} />
      <DeepSeekSignIn {...portable} />
    </>
  }
  function SurfacePortal({ renderSlot }) {
    const seat = useSource(target)
    return seat ? renderSlot('seal.bot.surface', { seat }) : null
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'seal-bot-surface', children: { 'seal.bot.surface': { kind: 'single', scope: 'root' } },
  }, SurfacePortal))
  ctx.slots.inject('seal.bot.surface', () => ctx.slots.register({
    name: 'seal.bot.surface', inject: face, children: { 'seal.bot.session': { kind: 'single', scope: 'session' } },
  }, SurfaceSeat))
  ctx.slots.inject('seal.bot.session', () => {
    let source
    let dispose
    const sync = () => {
      const next = ctx.slots.entries('conversation.session').find(entry => entry.store && entry.inject)
      if (next === source) return
      dispose?.()
      source = next
      dispose = next ? ctx.slots.register({ name: 'seal.bot.session', store: next.store, inject: next.inject,
        children: { 'seal.bot.header': { kind: 'single', scope: 'session' }, 'seal.bot.workbar': { kind: 'single', scope: 'session' }, 'seal.bot.views': { kind: 'single', scope: 'session' } },
      }, SessionBody) : undefined
    }
    const off = ctx.slots.subscribe('conversation.session', sync)
    sync()
    return () => { off(); dispose?.() }
  })
  ctx.slots.inject('seal.bot.header', () => {
    let dispose
    const sync = () => {
      dispose?.()
      dispose = ctx.slots.register({ name: 'seal.bot.header', ...headerNavigation(ctx.slots.entries('conversation.session.header'), face) }, HeaderPill)
    }
    const off = ctx.slots.subscribe('conversation.session.header', sync)
    sync()
    return () => { off(); dispose?.() }
  })
  ctx.slots.inject('seal.bot.views', () => {
    const nativeActions = 'conversation.session.header.views.actions'
    const botActions = 'seal.bot.views.actions'
    let source
    let dispose
    let menuReleases = []
    const syncMenu = () => {
      menuReleases.forEach(release => release())
      menuReleases = source ? ctx.slots.entries(nativeActions).map(entry => ctx.slots.register({
        name: botActions, ...entry.options, store: entry.store, inject: entry.inject, locale: entry.locale,
      }, entry.component)) : []
    }
    const sync = () => {
      const next = ctx.slots.entries('conversation.session.header').find(entry => entry.store && entry.inject)
      if (next === source) return
      menuReleases.forEach(release => release())
      menuReleases = []
      dispose?.()
      source = next
      // 原生 child slot 已有声明者，嵌入页用自有槽转接原生“更多”组件和回调。
      dispose = next ? ctx.slots.register({
        name: 'seal.bot.views', store: next.store, inject: next.inject, locale: next.locale,
        children: { [botActions]: { kind: 'list', scope: 'root' } },
      }, props => <next.component {...props} renderSlot={(name, owner, options) =>
        name === nativeActions ? props.renderSlot(botActions, owner, options) : null} />) : undefined
      syncMenu()
    }
    const off = ctx.slots.subscribe('conversation.session.header', sync)
    const offMenu = ctx.slots.subscribe(nativeActions, syncMenu)
    sync()
    return () => { off(); offMenu(); menuReleases.forEach(release => release()); dispose?.() }
  })
  // 复用原生展开按钮及其会话状态，右栏打开后由原生控件自行隐藏。
  ctx.slots.inject('seal.bot.workbar', () => {
    let source
    let dispose
    const sync = () => {
      const next = ctx.slots.entries('conversation.session.header.corner').find(entry => entry.locale === 'sidebarRight' && entry.store)
      if (next === source) return
      dispose?.()
      source = next
      dispose = next ? ctx.slots.register({ name: 'seal.bot.workbar', store: next.store, inject: next.inject, locale: next.locale }, next.component) : undefined
    }
    const off = ctx.slots.subscribe('conversation.session.header.corner', sync)
    sync()
    return () => { off(); dispose?.() }
  })
  let restoreRoom
  return {
    mount: seat => target.set(seat),
    enter() {
      restoreRoom = chatRoom.target('[data-seal-bot-session]')
      actions.setSurface('bot')
    },
    leave() {
      target.set(null)
      restoreRoom?.()
      restoreRoom = undefined
      actions.setSurface('agent', { selectHome: false })
    },
  }
}
