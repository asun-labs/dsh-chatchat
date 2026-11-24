import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import { buildClient } from '../scripts/build-client.mjs'

test('native Loader configuration stays separate from explicit host integration', async () => {
  const result = await buildClient({ write: false })
  const code = result.outputFiles.find(file => file.path.endsWith('client.js')).text
  const registrations = []
  runInNewContext(code, {
    window: { __ModuleLoader__: { load: plugin => registrations.push(plugin) } },
  })
  const require = createRequire(import.meta.url)
  const plugin = registrations[0].factory(name =>
    name === '@deepseek-ai/dsh-client-ui-primitives' ? {} : require(name))
  const reachedClient = new Error('client activation reached its first effect')
  const ctx = { effect() { throw reachedClient } }
  // 新版原生 Loader 的配置字段是引用对象，不能用于读取宿主回调。
  const config = new Proxy({}, {
    get(_target, field) {
      throw new Error(`native configuration was read as integration: ${String(field)}`)
    },
  })
  assert.throws(() => plugin.apply(ctx, config), error => error === reachedClient)
})
