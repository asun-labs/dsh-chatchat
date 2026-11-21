import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const legacyFiles = new Set([
  'embedded-panel.jsx', 'embedded-model.js', 'embedded-styles.js',
  'native-composer.js', 'live-chat.js',
])
const legacyMarkers = /\b(?:EmbeddedPanel|NoTranscript|watchLiveChat|mergeLiveChatItems|liveChatItems|useEmbeddedDictation|embeddedSpeech)\b|embedded-(?:panel|model|styles)\.|(?:native-composer|live-chat)\.|seal-dot-page__|data-seal-bot-composer/
const originalModules = [
  'index.js', 'embedded-shell.jsx', 'sidebar.js', 'header.js', 'overlays.js',
  'cells.js', 'user-message.js', 'new-chat.js', 'create-bot.js',
  'questions.js', 'queue-dock.js', 'composer.js', 'at-menu.js',
]

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:js|jsx)$/.test(entry.name) ? [path] : []
  })
}

// 同时用于源码构建和安装结果；不能靠保留几段未执行的原版代码掩盖旧页面。
export function assertNativeBotPackage(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['./client'], './lib/client.js', 'Seal Bot 必须从唯一的产品构建入口加载')
  const files = sourceFiles(join(directory, 'src'))
  for (const file of files) {
    assert.ok(!legacyFiles.has(basename(file)), `Seal Bot 废弃简化文件仍然存在：${file}`)
    assert.doesNotMatch(readFileSync(file, 'utf8'), legacyMarkers, `Seal Bot 源码仍引用简化链路：${file}`)
  }
  const client = join(directory, 'lib/client.js')
  assert.doesNotMatch(readFileSync(client, 'utf8'), legacyMarkers, 'Seal Bot 构建产物仍包含简化页面')
  const mapPath = `${client}.map`
  assert.ok(existsSync(mapPath), 'Seal Bot 缺少构建 source map，无法核对实际依赖图')
  const map = JSON.parse(readFileSync(mapPath, 'utf8'))
  const sources = map.sources.map(source => source.replaceAll('\\', '/'))
  for (const source of sources) {
    assert.ok(!legacyFiles.has(source.split('/').at(-1)), `Seal Bot 构建仍引入废弃简化模块：${source}`)
  }
  for (const file of originalModules) {
    assert.ok(sources.some(source => source.endsWith(`/src/client/${file}`)), `Seal Bot 实际构建未包含原版组件：${file}`)
  }
}
