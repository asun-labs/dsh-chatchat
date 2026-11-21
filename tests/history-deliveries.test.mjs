import { desktopRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { withHistoryDeliveries, mergeHistoryDeliveries } from '../src/shared/history-deliveries.js'
import { installHistoryDeliveries, historyFilesSlot } from '../src/client/history-deliveries.js'
import { nativeCode } from './native-code.mjs'

const require = createRequire(import.meta.url)
const desktop = desktopRequire
const event = (seq, turn, files) => ({ type:'deliverables/presented', seq, time:seq, data:{turn,callId:'present',files} })

test('history deliveries keep original indices, latest declarations, boundaries and hidden turns', () => {
  const text = {kind:'bot',turn:7,seq:50,text:'See `sample.pdf`.'}
  const rows = withHistoryDeliveries([text], [
    event(12,7,[null,{path:'/old/sample.pdf',description:'old'},{path:'/old/sample.docx'}]),
    event(40,7,[{path:'/old/sample.pdf',description:'new'}]),
    event(42,8,[{path:'/secret.pdf'}]), event(-1,7,[{path:'/invalid.pdf'}]),
  ], 'old', new Set([8]))
  assert.equal(rows[0],text)
  assert.equal(rows[1].sessionId,'old')
  assert.deepEqual(rows[1].files,[
    {path:'/old/sample.pdf',description:'new',seq:40,index:0},
    {path:'/old/sample.docx',seq:12,index:2},
  ])
  assert.equal(withHistoryDeliveries([], [event(1,1,[{path:' '}])], 'old',new Set()).length,0)
  assert.equal(withHistoryDeliveries([], [event(1,1,[{path:'/only.pdf'}])], 'old',new Set())[0].files[0].path,'/only.pdf')
})

test('prepending an older page never restores an obsolete declaration or duplicates a card', () => {
  const old = withHistoryDeliveries([], [event(1,1,[{path:'/same.pdf',description:'old'}])], 'old', new Set())
  const recent = withHistoryDeliveries([{kind:'bot',turn:1,seq:8,text:'done'}], [event(7,1,[{path:'/same.pdf',description:'new'}])], 'old',new Set())
  const merged=mergeHistoryDeliveries([...old,...recent])
  assert.deepEqual(merged.map(row=>row.kind),['bot','files'])
  assert.equal(merged[1].files.length,1)
  assert.equal(merged[1].files[0].seq,7)
})

test('history reuses the native tail injection and owns its action alias through late load and HMR', async () => {
  const {SlotCore}=await import(pathToFileURL(desktop.resolve('@deepseek-ai/dsh-client-ui-slots')).href)
  const core=new SlotCore()
  core.register({name:'root',children:{
    [historyFilesSlot]:{kind:'single',scope:'session'},
    'conversation.chat.turnTail':{kind:'list',scope:'session'},
  }},()=>null)
  const opens=[]
  const ctx={get:()=>({openResource:address=>opens.push(address)}),slots:{
    inject:(_name,install)=>install(), entries:name=>core.entries(name),
    subscribe:(...args)=>core.subscribe(...args),register:(...args)=>core.register(...args),
  }}
  const dispose=installHistoryDeliveries(ctx)
  assert.equal(core.entries(historyFilesSlot).length,0)
  const inject=()=>({hooks:{}})
  const native=()=>null
  const register=()=>core.register({name:'conversation.chat.turnTail',id:'@deepseek-ai/dsh-client-ui-deliverables',inject,locale:'deliverables',
    children:{'deliverables.file.actions':{kind:'list',scope:'session'}}},native)
  let off=register()
  await new Promise(resolve=>setImmediate(resolve))
  const entry=core.entries(historyFilesSlot)[0]
  assert.equal(entry.inject,inject)
  assert.equal(entry.locale,'deliverables')
  const delivery={sessionId:'old',turn:7,seq:12,files:[{path:'/old/sample.pdf',seq:12,index:1}]}
  const element=entry.component({delivery,sessionId:'new',renderSlot:(name,owner)=>({name,owner})})
  assert.equal(element.type,native)
  assert.equal(element.props.sessionId,'old')
  assert.deepEqual(element.props.turn.data.get('deliverables').presented,delivery.files)
  element.props.openFile('/old/sample.pdf')
  assert.match(opens[0],/file\/session\/old\//)
  const action=()=>null
  const offAction=core.register({name:'deliverables.file.actions',id:'open-with'},action)
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(core.entries('seal.bot.history.files.actions')[0].component,action)
  assert.equal(element.props.renderSlot('deliverables.file.actions',{}).name,'seal.bot.history.files.actions')
  offAction(); off()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(core.entries(historyFilesSlot).length,0)
  off=register()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(core.entries(historyFilesSlot).length,1)
  dispose(); off()
  assert.equal(core.entries(historyFilesSlot).length,0)
})

test('Chromium renders native PDF and Word cards and sends actions to the original session', async t => {
  const {chromium}=require('playwright')
  const {build}=require('esbuild')
  const native=nativeCode(readFileSync(desktop.resolve('@deepseek-ai/dsh-client-ui-deliverables/client'),'utf8'))
  const names=['DeliverablesTail','selectDeliverables','changesForClosing','presentedForClosing','Deliverables',
    'PresentedFileCard','cardDescription','basename','resolveWorkspacePath','presentedFileUrl','isAbsoluteWorkspacePath','isWindowsStylePath']
  const cssClasses=new Function(`return (${native.value('Deliverables_module_css_default')})`)()
  const script=await build({stdin:{resolveDir:import.meta.dirname,contents:`
    import * as react from 'react'
    import * as react_jsx_runtime from 'react/jsx-runtime'
    import {createRoot} from 'react-dom/client'
    import {installHistoryDeliveries,historyFilesSlot} from '../src/client/history-deliveries.js'
    const h=react.createElement
    const Deliverables_module_css_default=${JSON.stringify(cssClasses)}
    const COLLAPSED_PRESENTED_COUNT=${native.value('COLLAPSED_PRESENTED_COUNT')}
    const PRESENT_OPEN_PATH=${native.value('PRESENT_OPEN_PATH')}
    const PRESENT_OPEN_ROUTE=${native.value('PRESENT_OPEN_ROUTE')}
    const _deepseek_ai_dsh_client_ui_primitives={
      fileExtension:path=>path.split('.').at(-1),
      FileTypeIcon:({path,size})=>h('svg',{'data-file-type':path.split('.').at(-1),width:size,height:size}),
    }
    ${names.map(name=>native.function(name)).join('\n')}
    const dictionary=${native.value('zh')}
    const t=(key,values={})=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll('{'+name+'}',value),dictionary[key]??key)
    window.opens=[];window.previews=[]
    let contribution
    const injected={useContextMenu:()=>({getTriggerProps:()=>({})}),useSessions:pick=>pick({byId:{old:{cwd:'/old'}}}),
      usePresentedOpen:pick=>pick({}),usePresentedHost:pick=>pick({available:true,fileManager:'explorer'}),
      useShowCodeDiff:pick=>pick(false),useChangesSummary:pick=>pick({}),reloadPresentedHost(){},
      openPresented:(...args)=>window.opens.push(args)}
    const source={options:{id:'@deepseek-ai/dsh-client-ui-deliverables'},component:DeliverablesTail,inject:()=>injected,locale:'deliverables'}
    const ctx={get:()=>({openResource:address=>window.previews.push(address)}),slots:{
      inject:(_name,fn)=>fn(),subscribe:()=>()=>{},entries:name=>name==='conversation.chat.turnTail'?[source]:[],
      register:(meta,component)=>{if(meta.name===historyFilesSlot)contribution=component;return()=>{}},
    }}
    installHistoryDeliveries(ctx)
    const delivery={sessionId:'old',turn:7,seq:12,files:[{path:'/old/sample.pdf',seq:12,index:1},{path:'/old/sample.docx',seq:14,index:0}]}
    createRoot(document.getElementById('root')).render(h(contribution,{...injected,t,delivery,sessionId:'new',
      renderSlot:(name,owner)=>h('button',{'aria-label':'原生打开 '+owner.actionUrl,onClick:()=>owner.onAction('open')},'打开')}))
  `},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'})
  const browser=await chromium.launch({headless:true,executablePath:process.env.SEAL_TEST_CHROMIUM})
  t.after(()=>browser.close())
  const page=await browser.newPage({viewport:{width:800,height:550}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.setContent('<div id="root"></div>')
  await page.addStyleTag({content:native.css(`.${cssClasses.file}{`)})
  await page.addScriptTag({content:script.outputFiles[0].text})
  assert.deepEqual(errors,[])
  const cards=page.locator('[data-presented-file]')
  await cards.first().waitFor()
  assert.equal(await cards.count(),2)
  assert.equal(await cards.nth(0).locator('[data-file-type="pdf"]').count(),1)
  assert.equal(await cards.nth(1).locator('[data-file-type="docx"]').count(),1)
  await cards.nth(0).locator('button').first().click()
  await cards.nth(1).getByRole('button',{name:/原生打开/}).click()
  assert.match(await page.evaluate(()=>window.previews[0]),/file\/session\/old\//)
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(window.opens))),[['old',14,0,'open',null]])
  assert.deepEqual(errors,[])
})
