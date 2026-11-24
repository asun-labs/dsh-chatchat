import { createElement as h } from 'react'
import { t } from './i18n.js'

export function BotConnectorSettings({ bot, roster, actions, run, SwitchRow }) {
  const data = roster?.connectors
  const list = (data?.connectors ?? []).filter(c => c.state === 'ready')
  const mailOn = (data?.mail?.accounts ?? []).length > 0
  if (list.length === 0 && !mailOn) return null
  const rows = [...list, ...(mailOn ? [{ id: 'mail', name: t('Mailbox'), offFor: (data.mail?.offFor ?? []) }] : [])]
  return h('div', { className: 'bt-drawer-model' },
    h('div', { key: 't', className: 'bt-section-title' }, t('Connectors')),
    rows.map((connector) => {
      const off = (connector.offFor ?? []).includes(bot.id)
      return h(SwitchRow, { key: connector.id, label: connector.name, on: !off, onChange: (checked) => {
        const next = checked ? (connector.offFor ?? []).filter(id => id !== bot.id) : [...(connector.offFor ?? []), bot.id]
        void run(actions.connectorSet(connector.id, { offFor: next }))
      } })
    }))
}
