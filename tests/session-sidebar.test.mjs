import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createBotSidebarSession } from '../src/client/session-sidebar.js'
import { nativeCode } from './native-code.mjs'


test('Bot file sidebar resolves the exact Bot cwd from raw Sessions even when Office workspaces omit it', () => {
  let binding
  const bot = createBotSidebarSession({ provide: (_name, source) => { binding = source } })
  bot.bind('bot-chat')
  const source = readFileSync(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-sidebar-files/client'), 'utf8')
  const prefix = nativeCode(source).prefix('FilesBody', statement => /^if\s*\(cwd\s*===\s*void 0\)/u.test(statement))
  const FilesBody = new Function('react', `return ${prefix} return cwd; }`)(
    { useEffect: callback => callback(), useLayoutEffect: callback => callback(), useRef: value => ({ current: value }), useCallback: callback => callback })
  const calls = []
  const sessions = { byId: { 'bot-chat': { cwd: '/private/bot' }, office: { cwd: '/ordinary/office' } } }
  const cwd = FilesBody({ sessionId: binding.getSnapshot().sessionId,
    useTabInfo: () => ({ tab: { id: 'files-bot', actions: { bindCommands() {}, openResource() {} } }, panel: { id: 'bot-pane', isFloating: false } }),
    useContextMenu: () => ({ getTriggerProps() {} }), refresh() {}, placeBeside: id => calls.push(id),
    useSessions: select => select(sessions), useStore: select => select({ byPane: {} }), actions: {},
  })
  assert.equal(cwd, '/private/bot')
  assert.deepEqual(calls, ['files-bot'])
})

test('the native header control hides after opening and follows each Bot session independently', () => {
  const code = readFileSync(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-sidebar-right/client'), 'utf8')
  const jsx = desktopRequire('react/jsx-runtime')
  const ExpandButton = new Function('react_jsx_runtime', '_deepseek_ai_dsh_client_ui_primitives', 'ExpandButton_module_css_default', 'clsx', `${nativeCode(code).function('ExpandButton')}; return ExpandButton`)(jsx, { Tooltip: 'tooltip', Button: 'button', IconPanelLeftOutlineRegular: 'icon', isMobileDevice: () => false }, {}, (...values) => values.filter(Boolean).join(' '))
  const state = { bySession: { bot: { layout: { expanded: false } }, room: { layout: { expanded: false } } } }
  const render = sessionId => ExpandButton({ sessionId, useStore: pick => pick(state), useShortcuts: pick => pick([]), t: key => key,
    actions: { setExpanded: (id, expanded) => { state.bySession[id].layout.expanded = expanded } },
  })
  render('bot').props.children.props.onClick()
  assert.equal(render('bot'), null)
  assert.ok(render('room'), 'a collapsed group still has its own entry')
  render('room').props.children.props.onClick()
  assert.equal(render('room'), null)
  state.bySession.bot.layout.expanded = false
  assert.ok(render('bot'), 'closing from the native sidebar restores the entry')
  assert.equal(render('room'), null)
})
