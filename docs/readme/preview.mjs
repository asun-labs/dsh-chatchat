import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { assetDefines } from '../../scripts/build-client.mjs'

// Documentation scenes use production components with local, fictional data.
// No Host, user profile, model service or persistent storage is connected.
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const result = await build({
  entryPoints: [join(root, 'docs/readme/scenes.jsx')],
  absWorkingDir: root, bundle: true, write: false, format: 'iife',
  define: assetDefines(),
  plugins: [{ name: 'unused-host-primitives', setup(builder) {
    builder.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: 'host-primitives', namespace: 'readme' }))
    builder.onLoad({ filter: /.*/, namespace: 'readme' }, () => ({
      contents: 'export function FishLogo(){throw new Error("This scene needs the DSH Host")}; export const MarkdownText=FishLogo; export const writeClipboard=FishLogo; export const projectUserText=undefined, fileExtension=undefined, fileSizeText=undefined, FileTypeIcon=undefined, JsonBlock=undefined',
    }))
  } }],
})
const types = { '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html; charset=utf-8' }
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('Cache-Control', 'no-store')
  if (url.pathname === '/scene.js') {
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    response.end(result.outputFiles[0].text)
    return
  }
  if (url.pathname === '/') {
    response.setHeader('Content-Type', types['.html'])
    response.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatChat documentation scenes</title><body data-ds-dark-theme><div id="root"></div><script src="/scene.js"></script></body></html>')
    return
  }
  const path = resolve(root, '.' + decodeURIComponent(url.pathname))
  if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) {
    response.writeHead(403).end()
    return
  }
  try {
    const data = await readFile(path)
    response.setHeader('Content-Type', types[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream')
    response.end(data)
  } catch {
    response.writeHead(404).end()
  }
})
server.listen(0, '127.0.0.1', () => console.log(`README preview: http://127.0.0.1:${server.address().port}`))
