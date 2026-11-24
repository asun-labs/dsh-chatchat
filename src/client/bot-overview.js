import { createElement as h } from 'react'
import { ChevronRightIcon } from './icons.js'
import { MemoryRow } from './memory-panel.js'
import { ScheduleSummary } from './schedules.js'
import { workPhrase } from './cells.js'
import { t } from './i18n.js'

function Section({ title, onEdit, children }) {
  return h('section', { className: 'bt-profile-box' },
    h('div', { className: 'bt-profile-heading' }, h('h3', null, t(title)),
      onEdit ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: onEdit }, t('Edit')) : null),
    h('div', { className: 'bt-profile-content' }, children))
}

export function BotOverview({ bot, roster, actions, running, doing, useWork, openSettings }) {
  const work = useWork(value => value)
  const groups = (roster.rooms ?? []).filter(room => room.members?.includes(bot.id))
  const groupWork = Object.entries(work.rooms ?? {}).flatMap(([id, entries]) => {
    const current = entries.find(entry => entry.botId === bot.id)
    const room = roster.roomsById?.[id]
    return current && room ? [{ room, current }] : []
  })
  const current = work.bots?.[bot.id] ?? doing
  return h('div', { className: 'bt-profile', 'data-bot-overview': bot.id },
    h('style', null, BOT_OVERVIEW_CSS),
    h(Section, { title: 'Role card', onEdit: openSettings },
      h('dl', { className: 'bt-profile-facts' },
        h('dt', null, t('Name')), h('dd', null, bot.name),
        h('dt', null, t('Label')), h('dd', null, bot.role || t('Not specified')),
        h('dt', null, t('Capabilities')), h('dd', null,
          bot.capabilities?.length ? h('div', { className: 'bt-profile-tags' }, bot.capabilities.map(name => h('span', { key: name }, name))) : t('No capabilities selected')))),
    h(Section, { title: 'Persona', onEdit: openSettings },
      h('p', { className: bot.instructions ? 'bt-profile-persona' : 'bt-profile-empty' },
        bot.instructions || t('Add instructions in Bot settings'))),
    h(Section, { title: 'Current activity' },
      current || running ? h('p', { className: 'bt-profile-activity', role: 'status' }, workPhrase(current)) : null,
      groupWork.map(({ room, current: task }) => h('button', { key: room.id, type: 'button', className: 'bt-profile-entry', onClick: () => actions.openSession(room.id) },
        h('span', null, h('strong', null, room.name), h('small', null, workPhrase(task))), h(ChevronRightIcon))),
      !current && !running && groupWork.length === 0 ? h('p', { className: 'bt-profile-empty' }, t('No activity right now')) : null),
    h(Section, { title: 'Resources' },
      roster.memory === false ? null : h(MemoryRow, { owner: { id: bot.id, name: bot.name }, actions }),
      h(ScheduleSummary, { bot, actions })),
    groups.length ? h(Section, { title: 'Group chats' }, groups.map(room =>
      h('button', { key: room.id, type: 'button', className: 'bt-profile-entry', onClick: () => actions.openSession(room.id) },
        h('span', null, room.name), h(ChevronRightIcon)))) : null)
}

export const BOT_OVERVIEW_CSS = `
.bt-profile{display:flex;flex-direction:column;gap:16px;min-width:0}
.bt-profile-box{border:1px solid var(--bt-line);border-radius:14px;overflow:hidden;background:var(--bt-card)}
.bt-profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--bt-line)}
.bt-profile-heading h3{margin:0;font-size:13px;line-height:20px;font-weight:600}
.bt-profile-content{display:flex;flex-direction:column;gap:14px;padding:14px;min-width:0}
.bt-profile-facts{display:grid;grid-template-columns:68px minmax(0,1fr);gap:12px;margin:0;line-height:20px}
.bt-profile-facts dt{color:var(--bt-ink-2)}
.bt-profile-facts dd{margin:0;overflow-wrap:anywhere}
.bt-profile-tags{display:flex;flex-wrap:wrap;gap:6px}
.bt-profile-tags span{padding:2px 8px;border-radius:6px;background:var(--bt-hover);font-size:12px}
.bt-profile-persona,.bt-profile-empty,.bt-profile-activity{margin:0;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.bt-profile-empty{color:var(--bt-ink-3)}
.bt-profile-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;border:0;border-radius:8px;padding:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.bt-profile-entry:hover{background:var(--bt-hover)}
.bt-profile-entry span{min-width:0;overflow-wrap:anywhere}
.bt-profile-entry strong,.bt-profile-entry small{display:block}
.bt-profile-entry small{color:var(--bt-ink-2);line-height:20px}
.bt-profile-entry svg{flex:none;width:16px;height:16px}
`
