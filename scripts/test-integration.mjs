import { readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './build-client.mjs'

const home = mkdtempSync(join(tmpdir(), 'dsh-chatchat-tests-'))
try {
  const files = readdirSync(join(root, 'tests')).filter(file => file.endsWith('.test.mjs')).sort()
  const result = spawnSync(process.execPath, [
    '--import', './test/harness-resolve.mjs', '--test', '--test-concurrency=4', '--test-timeout=30000', '--test-force-exit',
    ...files.map(file => `tests/${file}`),
  ], { cwd: root, stdio: 'inherit', env: { ...process.env, DSH_HOME: home } })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(home, { recursive: true, force: true, maxRetries: 5 })
}
