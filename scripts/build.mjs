import { build } from 'esbuild'
import { buildClient, root } from './build-client.mjs'

await buildClient()
await buildClient({ library: true })
await build({
  absWorkingDir: root,
  entryPoints: ['src/office/cli.js'],
  outfile: 'office.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
})
