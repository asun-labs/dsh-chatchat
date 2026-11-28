// Modified by DSH ChatChat contributors. See MODIFICATIONS.md.
// Modifications Copyright (c) 2026 DSH ChatChat contributors.

// 优先显式 SDK 安装根，其次独立 dev/harness，最后使用本包开发依赖。
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const plugin = resolve(import.meta.dirname, '..')
// 直接源码测试只使用占位宏，真实资源由构建和打包测试验证。
globalThis.__SEAL_DOT_ICON__ = ''
globalThis.__SEAL_BOT_ROBOT_AVATARS__ = []
const installed = join(plugin, 'dev', 'harness')
const harness = process.env.DSH_HARNESS
  ? resolve(process.env.DSH_HARNESS)
  : existsSync(join(installed, 'node_modules')) ? installed : plugin
// Tests that load other harness packages (jsdom) read the same checkout.
process.env.DSH_HARNESS = harness
// A checkout links the packages into its base bundle; an npm install has them at its root.
const base = resolve(harness, 'packages/bundle/base/package.json')
const anchor = pathToFileURL(existsSync(base) ? base : resolve(harness, 'package.json')).href
const pluginUrl = `${pathToFileURL(plugin).href}/`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'esbuild' && context.parentURL?.startsWith(pluginUrl) && context.parentURL !== new URL('./seal-esbuild.mjs', import.meta.url).href) {
      const fixture = new URL('./seal-esbuild.mjs', import.meta.url)
      return nextResolve(context.conditions?.includes('require') ? fileURLToPath(fixture) : fixture.href, context)
    }
    if (harness !== plugin && specifier.startsWith('@deepseek-ai/') && context.parentURL?.startsWith(pluginUrl)) {
      return nextResolve(specifier, { ...context, parentURL: anchor })
    }
    return nextResolve(specifier, context)
  },
})
