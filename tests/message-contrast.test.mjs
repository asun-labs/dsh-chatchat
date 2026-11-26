import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { nativeCode } from './native-code.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { build } = require('esbuild')
const source = name => JSON.stringify(resolve('src/client', name).replaceAll('\\', '/'))

test('Bot reply Markdown keeps primary contrast and consecutive sender heads stay visible in both layouts', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'chatchat-message-contrast-'))
  let browser
  t.after(async () => { await browser?.close(); await rm(temporary, { recursive: true, force: true }) })
  const entry = join(temporary, 'scene.jsx')
  const primitives = require.resolve('@deepseek-ai/dsh-client-ui-primitives')
  const native = nativeCode(await readFile(primitives, 'utf8'))
  await writeFile(entry, `
    import React from ${JSON.stringify(require.resolve('react'))}
    import {createRoot} from ${JSON.stringify(require.resolve('react-dom/client'))}
    import {MarkdownText} from ${JSON.stringify(primitives)}
    import {SHELL_CSS,botOwnCss} from ${source('styles.js')}
    const style=document.createElement('style');style.dataset.testBotContrast='';style.textContent=botOwnCss(SHELL_CSS);document.head.append(style)
    const text=${JSON.stringify('正文应清晰可读。\n\n- 列表项目\n\n[参考链接](https://example.test) 和 `inline code`。')}
    const Header=({name})=><div className="bt-group-name"><span className="bt-lead"><span className="bt-mark" style={{width:22,height:22}}>●</span></span>{name}<span className="bt-group-time">16:35</span></div>
    function Scene(){return <>
      <section id="private"><h2>Bot 私聊</h2><Header name="文档助手"/><div className="bt-bubble"><MarkdownText text={text} variant="compact"/></div></section>
      <section id="group"><h2>群聊</h2>{['文档助手','文档助手','研究助手'].map((name,i)=><div className="bt-group-msg" key={i} data-chain-prev={i===1?'':undefined} data-chain-next={i===0?'':undefined}><Header name={name}/><div className="bt-bubble"><MarkdownText text={text} variant="compact"/></div></div>)}</section>
      <section id="ordinary"><h2>普通办公与用户消息</h2><MarkdownText text="未被 Bot 样式改写的普通 Markdown。" variant="compact"/></section>
    </>};createRoot(document.querySelector('main')).render(<Scene/>)
  `)
  const bundled = await build({ entryPoints: [entry], outdir: temporary, bundle: true, write: false, format: 'iife', platform: 'browser',
    loader: { '.css': 'local-css' }, define: { 'process.env.NODE_ENV': '"production"' },
    // 原生 MarkdownText 与其 CSS 原样执行；AST 内容夹具避免引入无关图标/代码高亮依赖。
    plugins: [{ name: 'native-markdown-surface', setup(builder) {
      builder.onLoad({ filter: /index\.js$/ }, args => args.path === primitives ? { contents: `
        import React,{memo,useMemo,useRef} from ${JSON.stringify(require.resolve('react'))}
        import {jsx} from ${JSON.stringify(require.resolve('react/jsx-runtime'))}
        import clsx from ${JSON.stringify(require.resolve('clsx'))}
        import markdownCss from './markdown/MarkdownText.module.css'
        const copyKatexAsTex=()=>{}
        const renderSettled=()=>React.createElement(React.Fragment,null,
          React.createElement('p',null,'正文应清晰可读。'),
          React.createElement('ul',null,React.createElement('li',null,'列表项目')),
          React.createElement('p',null,React.createElement('a',{href:'https://example.test'},'参考链接'),' 和 ',React.createElement('code',null,'inline code')))
        const MarkdownText=${native.value('MarkdownText')}
        export {MarkdownText}
      `, resolveDir: dirname(primitives) } : undefined)
    } }] })
  const nativeCss = bundled.outputFiles.find(file => file.path.endsWith('.css')).text
  const script = bundled.outputFiles.find(file => file.path.endsWith('.js')).text
  const html = `<!doctype html><meta charset="utf-8"><title>Bot 回复对比度验收</title><style>
    body{margin:0;padding:28px;background:var(--bt-main);color:var(--bt-ink);font:15px system-ui;--dsw-alias-label-primary:#141414;--dsw-alias-label-tertiary:rgba(20,20,20,.6);--dsw-alias-link:#3057d5;--dsw-font-markdown-base:14px/24px system-ui;--ds-font-family-code:monospace;--dsw-radius-xs:4px}
    body[data-ds-dark-theme]{--dsw-alias-label-primary:#f2f2f2;--dsw-alias-label-tertiary:rgba(242,242,242,.6);--dsw-alias-link:#91a8ff}
    main{max-width:980px;margin:auto;display:grid;gap:28px}h2{font-size:18px}#group{display:grid;gap:12px}.bt-bubble{margin-top:6px}#ordinary{padding-top:18px;border-top:1px solid #777}
    </style><style>${nativeCss}</style><main></main><script>${script.replaceAll('</script>', '<\\/script>')}</script>`
  if (process.env.CHATCHAT_CONTRAST_ARTIFACTS) {
    await mkdir(process.env.CHATCHAT_CONTRAST_ARTIFACTS, { recursive: true })
    await writeFile(join(process.env.CHATCHAT_CONTRAST_ARTIFACTS, 'index.html'), html.replace('<main>', '<script>document.addEventListener("DOMContentLoaded",()=>document.body.setAttribute("data-ds-dark-theme",""))</script><main>'))
  }
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.abort())
  await page.setContent(html)
  await page.locator('#private .bt-bubble p').first().waitFor()
  const previousColor = await page.evaluate(() => {
    document.body.setAttribute('data-ds-dark-theme', '')
    const style = document.querySelector('[data-test-bot-contrast]')
    // 重现旧的 own-CSS 过滤结果：去掉气泡文字覆盖后原生 compact 回落到三级色。
    style.textContent = style.textContent.replace(/\.bt-bubble \[data-markdown-variant=compact\]\{[^}]*\}/g, '')
    return getComputedStyle(document.querySelector('#private .bt-bubble p')).color
  })
  assert.equal(previousColor, 'rgba(242, 242, 242, 0.6)', 'native compact text reproduces the original dim reply')
  for (const dark of [true, false]) for (const layout of ['bubble', 'flat']) {
    await page.setContent(html)
    await page.evaluate(({ dark, layout }) => {
      document.body.toggleAttribute('data-ds-dark-theme', dark); document.body.dataset.btLayout = layout
    }, { dark, layout })
    await page.locator('#private .bt-bubble p').first().waitFor()
    const colors = await page.evaluate(() => {
      const color = selector => getComputedStyle(document.querySelector(selector)).color
      return { body: color('#private .bt-bubble'), paragraph: color('#private .bt-bubble p'), list: color('#private .bt-bubble li'),
        link: color('#private .bt-bubble a'), code: color('#private .bt-bubble code'), time: color('#private .bt-group-time'), ordinary: color('#ordinary [data-markdown-variant]'),
        background: getComputedStyle(document.querySelector('#private .bt-bubble')).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor }
    })
    const label = `${dark ? 'dark' : 'light'} ${layout}`
    for (const name of ['paragraph', 'list', 'link', 'code']) assert.equal(colors[name], colors.body, `${label}: ${name} uses primary Bot text`)
    assert.notEqual(colors.time, colors.body, `${label}: time remains secondary`)
    assert.notEqual(colors.ordinary, colors.body, `${label}: ordinary compact Markdown stays unchanged`)
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const foreground = luminance(colors.paragraph), background = luminance(layout === 'flat' ? colors.page : colors.background)
    const contrast = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
    assert(contrast >= 7, `${label}: reply contrast ${contrast.toFixed(2)} must reach 7:1`)
    for (const head of await page.locator('#group .bt-group-name').all()) assert(await head.isVisible(), `${label}: every reply names its sender`)
    for (const avatar of await page.locator('#group .bt-lead').all()) assert(await avatar.isVisible(), `${label}: consecutive reply avatars remain visible`)
  }
  assert.deepEqual(errors, [])
})
