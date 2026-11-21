import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { nativeCode } from './native-code.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { build } = require('esbuild')
const code = nativeCode(readFileSync(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-conversation/client'), 'utf8'))
const classes = new Function(`return (${code.value('ConversationRoot_module_css_default')})`)()
const css = code.css(`.${classes.body}{`)
const botLayout = readFileSync(new URL('../src/client/embedded-shell.jsx', import.meta.url), 'utf8').match(/const layout = `([\s\S]*?)`/)[1]

test('installed native tabs keep view selection, More actions and pinning independent for each Bot', async t => {
  // 执行已安装的原生 Header/Views。菜单外壳与视图内容用夹具，槽接线另由真实 SlotCore 回归覆盖。
  const script = await build({ stdin: { resolveDir: import.meta.dirname, contents: `
    import * as react from 'react'
    import * as react_jsx_runtime from 'react/jsx-runtime'
    import { createRoot } from 'react-dom/client'
    import { createSource } from '../src/client/sources.js'
    const h = react.createElement
    const clsx = (...values) => values.filter(Boolean).join(' ')
    const ConversationRoot_module_css_default = ${JSON.stringify(classes)}
    const FIXED_VIEW_ID = ${code.value('FIXED_VIEW_ID')}
    const WIDE_GLYPH = ${code.value('WIDE_GLYPH')}
    const WIDE_GLYPH_WIDTH = ${code.value('WIDE_GLYPH_WIDTH')}
    const NARROW_GLYPH_WIDTH = ${code.value('NARROW_GLYPH_WIDTH')}
    const TAB_LABEL_MAX_WIDTH = ${code.value('TAB_LABEL_MAX_WIDTH')}
    const _deepseek_ai_dsh_client_ui_primitives = {
      Tooltip: ({children}) => children,
      Button: ({children, ...props}) => h('button', props, children),
      IconEllipsisOutlineRegular: () => '…',
      Menu: ({anchor, open, children}) => h(react.Fragment, null, anchor, open ? h('div', {role:'menu'}, children) : null),
    }
    ${['resolveActiveView', 'deriveAncestry', 'equalBreadcrumbs', 'labelNeedsTooltip', 'ViewTabLabel', 'ViewsMoreMenu', 'ConversationSessionHeader', 'conversationPhase', 'DefaultConversationViews'].map(name => code.function(name)).join('\n')}
    const stores = { bot: createSource({view:'chat'}), room: createSource({view:'chat'}) }
    const pins = createSource(['debug'])
    const tabs = [{id:'chat',label:'对话'},{id:'trajectory',label:'轨迹'},{id:'debug',label:'调试'}]
    window.views = () => [stores.bot.getSnapshot().view, stores.room.getSnapshot().view]
    function Scene() {
      const [sessionId, selectBot] = react.useState('bot')
      const store = stores[sessionId]
      const useStore = pick => pick(react.useSyncExternalStore(store.subscribe, store.getSnapshot))
      const selectView = view => store.set({view})
      const props = {
        sessionId, useStore, useConversationViews: pick=>pick(tabs),
        useEntryPins: pick=>pick(react.useSyncExternalStore(pins.subscribe,pins.getSnapshot)),
        useEntryActions: pick=>pick(true),
        useSessions: pick=>pick({byId:{[sessionId]:{id:sessionId,displayTitle:sessionId}}}),
        useContextMenu: ()=>({getTriggerProps:()=>({})}), open() {},
        t:key=>key, selectView,
        setPinned:(id,on)=>pins.set(on?pins.getSnapshot().filter(value=>value!==id):[...pins.getSnapshot(),id]),
        renderFactorySlot:()=>null,
        renderSlot:(name,owner)=>name==='conversation.session.header.views.actions'
          ? owner.entries.map(entry=>h('div',{key:entry.id},
              h('button',{role:'menuitem',onClick:()=>{owner.onOpen(entry.id);owner.onDismiss()}},entry.label),
              h('button',{onClick:()=>owner.onPinnedChange(entry.id,!entry.pinned)},(entry.pinned?'取消固定 ':'固定 ')+entry.label))) : null,
      }
      const views = {
        ...props, useSession:pick=>pick({blank:false}), useConversation:pick=>pick({}),
        useInspectCall:pick=>pick(undefined), bindDraftPersistence:()=>()=>{}, inputActions:{persistDraft(){}},
        actions:{setDraft(){},completeViewRequest(){}},
        renderSlot:(_name,_owner,options)=>h('section',{'aria-label':'当前视图'},options.only),
      }
      return h(react.Fragment,null,
        h('button',{onClick:()=>selectBot(sessionId==='bot'?'room':'bot')},'切换 Bot'),
        h('div',{className:'seal-bot-session','data-seal-bot-session':''},
          h('div',{className:'seal-bot-header'},'Seal Bot'),
          h('div',{className:'seal-bot-views'},h(ConversationSessionHeader,props)),
          h(DefaultConversationViews,views)))
    }
    createRoot(document.querySelector('main')).render(h(Scene))
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } })
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent(`<style>html,body,main{height:100%;margin:0}${css}${botLayout}</style><main></main>`)
  await page.addScriptTag({ content: script.outputFiles[0].text })
  await page.getByRole('tab', { name: '轨迹', exact: true }).click()
  assert.equal(await page.getByRole('region', { name: '当前视图' }).textContent(), 'trajectory')
  await page.getByRole('button', { name: 'session.moreViews', exact: true }).click()
  await page.getByRole('menuitem', { name: '调试', exact: true }).click()
  assert.equal(await page.getByRole('region', { name: '当前视图' }).textContent(), 'debug')
  await page.getByRole('button', { name: 'session.moreViews', exact: true }).click()
  await page.getByRole('button', { name: '固定 调试', exact: true }).click()
  await page.getByRole('button', { name: 'session.moreViews', exact: true }).click()
  assert.equal(await page.getByRole('tab', { name: '调试', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('tab', { name: '对话', exact: true }).click()
  await page.getByRole('tab', { name: '轨迹', exact: true }).click()
  await page.getByRole('button', { name: '切换 Bot', exact: true }).click()
  assert.equal(await page.getByRole('region', { name: '当前视图' }).textContent(), 'chat')
  await page.getByRole('button', { name: '切换 Bot', exact: true }).click()
  assert.equal(await page.getByRole('region', { name: '当前视图' }).textContent(), 'trajectory')
  await page.setViewportSize({ width: 390, height: 700 })
  await page.getByRole('button', { name: 'session.moreViews', exact: true }).click()
  await page.getByRole('button', { name: '取消固定 调试', exact: true }).click()
  await page.getByRole('menuitem', { name: '调试', exact: true }).click()
  await page.setViewportSize({ width: 260, height: 700 })
  await page.getByRole('button', { name: 'session.moreViews', exact: true }).click()
  await page.getByRole('menuitem', { name: '轨迹', exact: true }).click()
  assert.deepEqual(await page.evaluate(() => window.views()), ['trajectory', 'chat'])
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  assert.deepEqual(errors, [])
})
