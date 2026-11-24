import { createElement as h, useEffect, useState } from 'react'
import { BotMark } from './mark.js'
import { ChevronLeftIcon, CloseIcon } from './icons.js'
import { freshBotName } from './bot-draft.js'
import { nameProblem } from '../shared/mentions.js'
import { hostText, t } from './i18n.js'
import { useEscape } from './overlay-hooks.js'

export function CreateBotTemplate({ roster, actions, start, onBack, onCreated }) {
  const [items, setItems] = useState([]), [tab, setTab] = useState('system')
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(null)
  const [name, setName] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  useEscape(onBack)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    actions.botTemplates().then(result => { if (active) setItems(result.items) })
      .catch(failure => { if (active) setError(failure.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [actions, reload])
  const finalName = name.trim(), problem = nameProblem(finalName)
  const clash = roster.bots.some(bot => bot.name.toLowerCase() === finalName.toLowerCase())
  const choose = item => { setSelected(item); setName(freshBotName(roster, item.displayName)); setError('') }
  const create = async () => {
    if (!selected || !finalName || problem || clash || busy) return
    setBusy(true); setError('')
    try {
      const bot = await actions.createBotFromTemplate({ templateId: selected.id, expectedRevision: selected.revision, name: finalName, sectionId: start?.sectionId })
      onCreated(bot)
    } catch (failure) { setError(failure.message); setBusy(false) }
  }
  const wanted = query.trim().toLowerCase()
  const visible = items.filter(item => item.directory === tab && `${item.displayName} ${item.description}`.toLowerCase().includes(wanted))
  return h('div', { className: 'bt-create', role: 'dialog', 'aria-label': t('Create Bot from template') },
    h('header', { className: 'bt-create-head' },
      h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Back'), disabled: busy, onClick: selected ? () => setSelected(null) : onBack }, h(ChevronLeftIcon)),
      h('strong', null, t('Create Bot from template')),
      h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Close'), disabled: busy, onClick: onBack }, h(CloseIcon))),
    h('div', { className: selected ? 'bt-create-body' : 'bt-create-body bt-template-body' }, h('div', { className: selected ? 'bt-create-card' : 'bt-create-card bt-template-catalog' },
      h('p', { className: 'bt-note' }, t('Template settings are copied. This Bot and the original expert can be edited independently.')),
      selected ? h('div', null,
        h('div', { className: 'bt-create-preview' }, h(BotMark, { look: { image: selected.avatar }, size: 52 }), h('strong', null, selected.displayName)),
        h('p', { className: 'bt-note' }, selected.description),
        h('label', { className: 'bt-field' }, h('span', { className: 'bt-field-label' }, t('Name')),
          h('input', { className: 'bt-input', autoFocus: true, value: name, maxLength: 40, 'aria-label': t('Name'), disabled: busy, onChange: event => setName(event.target.value) }),
          problem ? h('span', { className: 'bt-note bt-danger' }, hostText(problem)) : clash ? h('span', { className: 'bt-note bt-danger' }, t('A Bot named {name} already exists', { name: finalName })) : null),
        h('div', { className: 'bt-create-foot' }, h('button', { type: 'button', className: 'bt-send', disabled: busy || !finalName || !!problem || clash, onClick: create }, t('Create'))))
      : h('div', null,
        h('div', { className: 'bt-template-tabs', role: 'tablist' }, ['system', 'personal'].map(value => h('button', { key: value, type: 'button', role: 'tab', 'aria-selected': tab === value, className: 'bt-soft', onClick: () => setTab(value) }, t(value === 'system' ? 'System templates' : 'Personal templates')))),
        h('input', { className: 'bt-input', value: query, placeholder: t('Search templates'), 'aria-label': t('Search templates'), onChange: event => setQuery(event.target.value) }),
        loading ? h('p', { className: 'bt-note' }, t('Loading…')) : h('div', { className: 'bt-template-list' },
          visible.map(item => h('button', { key: item.id, type: 'button', className: 'bt-template-item', onClick: () => choose(item) },
            h(BotMark, { look: { image: item.avatar }, size: 30 }), h('span', null, h('strong', null, item.displayName), h('span', { className: 'bt-note' }, item.description)))),
          !visible.length ? h('p', { className: 'bt-note' }, t('No templates found')) : null)),
      error ? h('div', { className: 'bt-error' }, error, !selected ? h('button', { type: 'button', className: 'bt-soft', onClick: () => setReload(value => value + 1) }, t('Retry')) : null) : null)))
}
