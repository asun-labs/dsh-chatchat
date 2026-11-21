import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const plugin = resolve(import.meta.dirname, '..')
const exclusions = JSON.parse(readFileSync(new URL('./profile-exclusions.json', import.meta.url), 'utf8'))
const files = readdirSync(import.meta.dirname).filter(file => file.endsWith('.test.js') && !exclusions[file])
console.log(`Running ${files.length} inherited suites; ${Object.keys(exclusions).length} historical profile suites excluded (see test/profile-exclusions.json).`)
const home = mkdtempSync(join(tmpdir(), 'seal-bot-upstream-'))
try {
  const result = spawnSync(process.execPath, [
    '--import', './test/harness-resolve.mjs', '--test', '--test-concurrency=4', '--test-timeout=30000', '--test-force-exit',
    ...files.map(file => `test/${file}`),
  ], { cwd: plugin, stdio: 'inherit', env: { ...process.env,
    DSH_HOME: home,
  } })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally { rmSync(home, { recursive: true, force: true, maxRetries: 5 }) }
