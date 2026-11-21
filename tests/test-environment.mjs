import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const productRoot = fileURLToPath(new URL('..', import.meta.url))

// SDK integration tests may use a separately installed DSH SDK. The location is
// explicit so this suite never discovers a neighboring product checkout.
const harness = process.env.DSH_HARNESS
if (harness && !isAbsolute(harness)) throw new Error('DSH_HARNESS must be an absolute DSH SDK installation root')
const manifest = harness ? join(resolve(harness), 'package.json') : join(productRoot, 'package.json')
if (!existsSync(manifest)) throw new Error(`DSH SDK installation package.json was not found: ${manifest}`)
export const desktopRequire = createRequire(manifest)
