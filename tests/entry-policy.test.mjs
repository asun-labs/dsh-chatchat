import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { assertNativeBotPackage } from '../scripts/bot-entry-policy.mjs'

const source = fileURLToPath(new URL('..', import.meta.url))

test('the actual Bot package contains only the original/native conversation UI', () => {
  assertNativeBotPackage(source)
})

test('the package gate rejects stale files, callers and build graphs, even alongside the original UI', async t => {
  const temporaryRoot = realpathSync(tmpdir())
  for (const [name, mutate, reason] of [
    ['alternate client entry', root => {
      const path = join(root, 'package.json')
      const manifest = JSON.parse(readFileSync(path, 'utf8'))
      manifest.exports['./client'] = './legacy-client.js'
      writeFileSync(path, JSON.stringify(manifest))
    }, /唯一的产品构建入口/],
    ['old page file', root => writeFileSync(join(root, 'src/client/embedded-panel.jsx'), 'export const view = null'), /废弃简化文件/],
    ['old caller', root => writeFileSync(join(root, 'src/client/leftover.js'), "import './embedded-panel.jsx'\nexport const Old = EmbeddedPanel"), /源码仍引用简化链路/],
    ['empty native transcript fallback', root => writeFileSync(join(root, 'src/client/leftover.js'), 'function NoTranscript() { return null }'), /源码仍引用简化链路/],
    ['stale bundle', root => writeFileSync(join(root, 'lib/client.js'), 'function EmbeddedPanel() {}'), /构建产物仍包含简化页面/],
    ['stale source map', root => updateMap(root, map => map.sources.push('../src/client/live-chat.js')), /构建仍引入废弃简化模块/],
    ['unbundled original renderer', root => updateMap(root, map => { map.sources = map.sources.filter(file => !file.endsWith('/cells.js')) }), /未包含原版组件：cells.js/],
  ]) {
    await t.test(name, () => {
      const root = mkdtempSync(join(temporaryRoot, 'seal-bot-entry-'))
      try {
        cpSync(join(source, 'src'), join(root, 'src'), { recursive: true })
        cpSync(join(source, 'package.json'), join(root, 'package.json'))
        mkdirSync(join(root, 'lib'))
        for (const file of ['client.js', 'client.js.map']) cpSync(join(source, 'lib', file), join(root, 'lib', file))
        mutate(root)
        assert.throws(() => assertNativeBotPackage(root), reason)
      } finally {
        assert.equal(dirname(realpathSync(root)), temporaryRoot)
        rmSync(root, { recursive: true, force: true })
      }
    })
  }
})

function updateMap(root, mutate) {
  const path = join(root, 'lib/client.js.map')
  const map = JSON.parse(readFileSync(path, 'utf8'))
  mutate(map)
  writeFileSync(path, JSON.stringify(map))
}
