import { desktopRequire, productRoot } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { nativeCode } from './native-code.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { build } = require('esbuild')

test('Bot trigger menus have opaque native surfaces without changing ordinary menus', async t => {
  const temporaryRoot = await realpath(tmpdir())
  const output = await mkdtemp(join(temporaryRoot, 'seal-bot-menu-'))
  let browser
  t.after(async () => {
    await browser?.close()
    assert.equal(dirname(await realpath(output)), temporaryRoot)
    await rm(output, { recursive: true, force: true })
  })
  const source = path => JSON.stringify(join(productRoot, path).replaceAll('\\', '/'))
  const primitives = desktopRequire.resolve('@deepseek-ai/dsh-client-ui-primitives')
  const native = await readFile(primitives, 'utf8')
  const installed = nativeCode(native)
  const surface = `const MENU_TRANSITION_MS = ${installed.value('MENU_TRANSITION_MS')};\nconst MenuSurface = ${installed.value('MenuSurface')};`
  const cssName = surface.match(/clsx\(([^,]+)\.surface,/)[1]
  const entry = join(output, 'fixture.jsx')
  await writeFile(entry, `
    import React, { useState } from ${JSON.stringify(require.resolve('react'))}
    import { createRoot } from ${JSON.stringify(require.resolve('react-dom/client'))}
    import { MenuSurface } from ${JSON.stringify(desktopRequire.resolve('@deepseek-ai/dsh-client-ui-primitives'))}
    import { SHELL_CSS, CONVERSATION_CSS, botOwnCss } from ${source('src/client/styles.js')}
    const style = document.createElement('style')
    style.textContent = botOwnCss(SHELL_CSS) + CONVERSATION_CSS
    document.head.append(style)
    function Scene() {
      const [query, setQuery] = useState('')
      const menu = <MenuSurface data-trigger-menu="" style={{position:'absolute',inset:0,padding:16}}>
        <div role="listbox" aria-label="引用候选"><strong>Bot</strong><p>555</p><p>文件与文件夹</p><p>对话</p></div>
      </MenuSurface>
      return <><div className="columns">{['bot','ordinary'].map(id => <section key={id} id={id}
        {...(id === 'bot' ? {'data-seal-bot-session':''} : {})}>
        <div className="underlay">后面的聊天内容不应透出来</div>{query === '@' && menu}
      </section>)}</div><textarea aria-label="输入消息" value={query} onChange={event => setQuery(event.target.value)} /></>
    }
    createRoot(document.querySelector('#root')).render(<Scene />)
  `)
  const bundled = await build({ entryPoints: [entry], outdir: output, bundle: true, write: false,
    format: 'iife', platform: 'browser', loader: { '.css': 'local-css' },
    // 执行原组件与原 CSS，避免导入整个图标/代码高亮包的非浏览器依赖。
    plugins: [{ name: 'native-menu-surface', setup(build) {
      build.onLoad({ filter: /index\.js$/ }, args => args.path === primitives ? {
        contents: `import { Fragment, forwardRef, useId, useRef, useLayoutEffect } from ${JSON.stringify(require.resolve('react'))};
          import { jsx, jsxs } from ${JSON.stringify(require.resolve('react/jsx-runtime'))}; import { createPortal } from ${JSON.stringify(require.resolve('react-dom'))};
          import clsx from 'clsx'; import ${cssName} from './MenuSurface.module.css';
          ${surface}\nexport { MenuSurface };`, resolveDir: dirname(primitives),
      } : undefined)
    } }],
    define: { 'process.env.NODE_ENV': '"production"', __SEAL_DOT_ICON__: '""' } })
  browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
  for (const dark of [true, false]) await t.test(dark ? 'dark' : 'light', async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 400 } })
    try {
      await page.route('**/*', route => route.abort())
      await page.setContent(`<style>body{margin:20px;--dsw-menu-surface-fill:rgba(90,90,90,.6);--dsw-menu-backdrop-filter:none;--dsw-radius-lg:12px;--dsw-specific-menu:rgba(90,90,90,.6)}
        .columns{display:flex;gap:20px}section{position:relative;width:360px;height:210px}.underlay{position:absolute;inset:0;background:rgb(255,0,0);font-size:28px}textarea{margin-top:20px}</style><div id="root"></div>`)
      if (dark) await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
      await page.addStyleTag({ content: bundled.outputFiles.find(file => file.path.endsWith('.css')).text })
      await page.addScriptTag({ content: bundled.outputFiles.find(file => file.path.endsWith('.js')).text })
      await page.getByRole('textbox', { name: '输入消息' }).fill('@')
      const menu = page.locator('#bot [data-trigger-menu]')
      await menu.waitFor()
      const material = menu.locator(':scope > [aria-hidden=true]').first()
      const fill = await material.evaluate(element => getComputedStyle(element).backgroundColor)
      assert.match(fill, /^rgb\(/, 'the real MenuSurface material must be opaque')
      assert.equal(await material.evaluate(element => getComputedStyle(element).backdropFilter), 'none')
      assert.equal(await page.locator('#ordinary [data-trigger-menu] > [aria-hidden=true]').first()
        .evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(90, 90, 90, 0.6)')
      const box = await menu.boundingBox()
      const clip = { x: box.x + box.width - 35, y: box.y + 30, width: 12, height: 12 }
      const before = await page.screenshot({ clip })
      await page.locator('.underlay').evaluateAll(elements => elements.forEach(element => { element.style.background = 'rgb(0,255,0)' }))
      assert.deepEqual(await page.screenshot({ clip }), before, 'chat behind the menu cannot affect its visible pixels')
      await page.getByRole('textbox', { name: '输入消息' }).fill('')
      await page.waitForFunction(() => !document.querySelector('[data-trigger-menu]'))
    } finally { await page.close() }
  })
})
