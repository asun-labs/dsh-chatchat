import React from 'react'
import { createRoot } from 'react-dom/client'
import { TeamSidebar, SIDEBAR_CSS } from '../../src/client/sidebar.js'
import { DetailsDrawer } from '../../src/client/details-drawer.js'
import { CreateBot } from '../../src/client/create-bot.js'
import { ChevronLeftIcon } from '../../src/client/icons.js'
import { SHELL_CSS } from '../../src/client/styles.js'
import { installLocale } from '../../src/client/i18n.js'
import { installBranding, brandImage } from '../../src/client/branding.js'
import { ROBOT_AVATARS } from '../../src/client/robot-avatars.js'
import { MODEL_CSS } from '../../src/client/model-menu.js'
import { BOT_SETTINGS_CSS } from '../../src/client/bot-settings.js'
import { AGENT_CARDS_CSS } from '../../src/client/agent-cards.js'
import { AVATAR_LIBRARY_CSS } from '../../src/client/avatar-library.js'
import { SCHEDULE_CSS } from '../../src/client/schedules.js'

const english = new URLSearchParams(location.search).get('lang') === 'en'
const text = (zh, en) => english ? en : zh
document.documentElement.lang = english ? 'en' : 'zh-CN'
let dictionary = {}
if (!english) installLocale({
  register: (_namespace, _language, values) => { dictionary = values },
  bind: () => key => dictionary[key] ?? key,
  getLocale: () => ({ active: 'zh-CN' }),
})
installBranding(new URLSearchParams(location.search).get('branding') ?? 'dsh')
const image = index => ({ image: ROBOT_AVATARS[index].image })
const main = { id: 'main', name: 'DSH Bot', role: text('团队协调员', 'Team coordinator'), avatar: { image: brandImage() }, createdAt: 1 }
const writer = { id: 'writer', name: text('内容编辑', 'Editor'), role: text('写作与表达', 'Writing and communication'), avatar: image(2), createdAt: 3,
  instructions: text('把复杂的信息整理成清楚、易读的文档。\n先确认读者和目标，再组织结构；重要结论保留依据。', 'Turn complex information into clear, readable documents.\nStart with the audience and purpose. Keep evidence for key conclusions.'), capabilities: [text('文档写作', 'Document writing'), text('内容整理', 'Content organization')], parts: [] }
const researcher = { id: 'researcher', name: text('研究助手', 'Researcher'), role: text('信息检索与核实', 'Research and verification'), avatar: image(5), createdAt: 2, parts: [] }
const room = { id: 'room', name: text('产品发布小组', 'Product launch'), named: true, members: ['main', 'writer', 'researcher'], admin: 'main', createdAt: 4,
  preview: text('内容编辑：我来整理发布文档的结构。', 'Editor: I will organize the release documentation.') }
const roster = {
  ready: true, mainBotId: 'main', mainBotIds: ['main'], bots: [main, writer, researcher],
  byId: { main, writer, researcher }, rooms: [room], roomsById: { room },
  agentOf: {}, exchangeTurns: {}, sections: [], models: [], memory: false,
  permissions: { defaultPreset: 'read-only', options: [{ value: 'read-only', label: text('只读', 'Read only') }] },
}
const sessions = { ids: [], byId: {}, projectionsBySession: {} }
const select = value => pick => pick(value)
const noop = () => {}
const actions = {
  openSession: noop, openPalette: noop, openNewChat: noop, openSettings: noop,
  closeOverlay: noop, setSidebar: noop, openMenu: noop, clearUnread: noop,
  teamSessionIds: () => new Set(['main', 'writer', 'researcher', 'room']),
  schedules: async () => ({ available: true, tasks: [] }),
}
const props = {
  roster, actions, useRoster: select(roster), useUi: select({ unread: {} }), useRegistry: select({}),
  useSessions: select(sessions), useSessionStatus: select(new Map()),
  useSessionRetainInfo: (_id, pick) => pick({}), useActivity: select({}),
  useWork: select({ bots: {}, rooms: {}, approvals: [] }),
  useBrowserTabs: select({}), useBrowserPages: select({}),
}
const style = `
*{box-sizing:border-box}body{margin:0;background:#0b101b;color:#f0f2f6;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
button,input,textarea{font:inherit}button{cursor:pointer}body{--dsw-font-family:"Segoe UI","Microsoft YaHei",sans-serif}
.stage{width:1200px;height:1194px;margin:0 auto;padding:38px 48px;background:radial-gradient(ellipse at 90% 0%,#202e56 0,transparent 55%),#0b101b}
.caption{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;font-size:12px;letter-spacing:2px;color:#9faed0}
.caption strong{color:#dfe7ff;letter-spacing:0;font-size:15px}.caption span{font-size:11px}
h1{margin:0 0 10px;font-size:34px;letter-spacing:-1px;line-height:1.3}p.lead{margin:0 0 28px;color:#a8b4cd;font-size:15px}
.window{height:960px;background:var(--bt-main);border:1px solid #35415b;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px #0006;display:flex}
.scene-sidebar{width:310px;flex:none;background:var(--bt-sidebar);padding:20px 12px 12px 20px;border-right:1px solid var(--bt-line);display:flex}
.scene-sidebar .bt-side{width:100%;padding-right:0}.scene-sidebar .bt-main-tile{margin-top:4px}
.scene-content{display:flex;flex:1;min-width:0;flex-direction:column;overflow:hidden;color:var(--bt-ink);font-size:13px}
.scene-content .bt-drawer-body{flex:1;overflow:auto}.scene-content .bt-create-body{overflow:auto}
.scene-content .bt-create-card{max-width:640px}.scene-content .bt-create-head{min-height:52px}
.demo-note{font-size:10px;letter-spacing:1px;color:#7b89a6;margin-top:15px;display:flex;justify-content:space-between}
`
function App() {
  const scene = new URLSearchParams(location.search).get('scene') ?? 'team'
  return <><style>{SHELL_CSS}{SIDEBAR_CSS}{MODEL_CSS}{BOT_SETTINGS_CSS}{AGENT_CARDS_CSS}{AVATAR_LIBRARY_CSS}{SCHEDULE_CSS}{style}</style><main className="stage">
    <div className="caption"><strong>DSH / ChatChat</strong><span>{scene === 'create' ? '02 — BUILD YOUR TEAM' : '01 — KNOW YOUR TEAM'}</span></div>
    <h1>{scene === 'create' ? text('让每个 Bot，都有自己的职责。', 'A clear role for every bot.') : text('谁负责什么，打开就知道。', 'Know your team at a glance.')}</h1>
    <p className="lead">{scene === 'create' ? text('选择头像、写下职责，在 DSH 中配置它使用的模型。', 'Choose an avatar, define its responsibilities, and configure its model in DSH.') : text('Bot、群聊和角色详情，用一套清晰的界面组织起来。', 'Bring bots, group chats, and role details into one clear interface.')}</p>
    <div className="window">
      <aside className="scene-sidebar"><TeamSidebar {...props} embedded wide selectedSessionId="writer"
        HeaderTools={({ children }) => <><div style={{ marginBottom: 10 }}><button className="bt-round" aria-label={text('返回 DSH', 'Back to DSH')}><ChevronLeftIcon /></button></div>{children}</>} /></aside>
      <section className="scene-content">
        {scene === 'create' ? <CreateBot roster={roster} actions={actions} start={{ name: text('设计搭档', 'Design partner'), instructions: text('协助梳理界面结构与视觉方向。\n先理解目标，再提供有依据的设计建议。', 'Help shape interface structure and visual direction.\nUnderstand the goal first, then offer reasoned design suggestions.') }} onBack={noop} onCreated={noop} />
          : <DetailsDrawer {...props} sessionId="writer" />}
      </section>
    </div>
    <div className="demo-note"><span>{text('现有组件 · 演示数据 · 未连接模型', 'EXISTING COMPONENTS · DEMO DATA · NO LIVE MODEL')}</span><span>DSH CHATCHAT</span></div>
  </main></>
}
createRoot(document.getElementById('root')).render(<App />)
