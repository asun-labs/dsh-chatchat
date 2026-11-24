import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const catalog = join(root, 'assets/avatar-catalog')

export function assetDefines() {
  const avatars = JSON.parse(readFileSync(join(catalog, 'catalog.json'), 'utf8')).map(entry => ({
    ...entry,
    image: `data:image/png;base64,${readFileSync(join(catalog, `${entry.id}.png`)).toString('base64')}`,
  }))
  return {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __SEAL_DOT_ICON__: JSON.stringify(`data:image/png;base64,${readFileSync(join(root, 'assets/seal-dot.png')).toString('base64')}`),
    __DSH_BOT_ICON__: JSON.stringify(`data:image/svg+xml;base64,${readFileSync(join(root, 'assets/dsh-host.svg')).toString('base64')}`),
    __SEAL_BOT_ROBOT_AVATARS__: JSON.stringify(avatars),
  }
}

export async function buildClient({ write = true, library = false } = {}) {
  return build({
    absWorkingDir: root,
    entryPoints: ['src/client/index.js'],
    outfile: library ? 'lib/client-api.cjs' : 'lib/client.js',
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    metafile: true,
    write,
    external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/dsh-client-ui-primitives'],
    define: assetDefines(),
    ...library ? {} : {
      banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;` },
      // 原生 Loader 第二参是同步配置；宿主接入回调只由 client-api 显式传入。
      footer: { js: 'return { ...module.exports, apply: (ctx) => module.exports.apply(ctx) }; } });' },
    },
  })
}

export async function bundleClient() {
  const result = await buildClient({ write: false })
  return result.outputFiles.find(file => file.path.endsWith('/client.js') || file.path.endsWith('\\client.js')).text
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildClient()
