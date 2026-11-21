import { createElement as h } from 'react'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'

export const historyFilesSlot = 'seal.bot.history.files'
const nativeSlot = 'conversation.chat.turnTail'
const nativeActions = 'deliverables.file.actions'
const historyActions = 'seal.bot.history.files.actions'

// 历史接口的交付元数据适配到原生卡片入口，复用其图标、Host 能力及操作状态。
export function installHistoryDeliveries(ctx) {
  return ctx.slots.inject(historyFilesSlot, () => {
    let source
    let dispose
    let releases = []
    const clearActions = () => { releases.forEach(release => release()); releases = [] }
    const syncActions = () => {
      clearActions()
      if (source) releases = ctx.slots.entries(nativeActions).map(entry => ctx.slots.register({
        name: historyActions, ...entry.options, store: entry.store, inject: entry.inject, locale: entry.locale,
      }, entry.component))
    }
    const sync = () => {
      const next = ctx.slots.entries(nativeSlot).find(entry => entry.options.id === '@deepseek-ai/dsh-client-ui-deliverables')
      if (next === source) return
      clearActions()
      dispose?.()
      source = next
      dispose = next ? ctx.slots.register({
        name: historyFilesSlot, store: next.store, inject: next.inject, locale: next.locale,
        children: { [historyActions]: { kind: 'list', scope: 'session' } },
      }, props => {
        const { delivery } = props
        return h(next.component, {
          ...props, sessionId: delivery.sessionId, seq: delivery.seq,
          turn: { turn: delivery.turn, data: new Map([['deliverables', { produced: [], presented: delivery.files }]]) },
          openFile: path => ctx.get('sidebarRight')?.openResource(sessionFileAddress(delivery.sessionId, path)),
          renderSlot: (name, owner, options) => name === nativeActions ? props.renderSlot(historyActions, owner, options) : null,
        })
      }) : undefined
      syncActions()
    }
    const off = ctx.slots.subscribe(nativeSlot, sync)
    const offActions = ctx.slots.subscribe(nativeActions, syncActions)
    sync()
    return () => { off(); offActions(); clearActions(); dispose?.() }
  })
}
