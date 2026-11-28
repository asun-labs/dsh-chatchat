import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { root } from './build-client.mjs'

const payload = ['index.js', 'web-search.js', 'office.js', 'office.js.map', 'lib', 'src', 'assets', 'third-party', 'LICENSE', 'NOTICE', 'MODIFICATIONS.md', 'README.md', 'README.en.md', 'cordis.patch.yml']

// 发布包不执行安装脚本，不携带开发依赖；构建仅发生在插件维护者的打包阶段。
export function releaseManifest(manifest) {
  const { scripts, devDependencies, files, ...runtime } = manifest
  return { ...runtime, files: [...payload, 'npm-shrinkwrap.json'] }
}

function npmCli() {
  const candidates = [process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
    '/usr/share/nodejs/npm/bin/npm-cli.js']
  const cli = candidates.find(path => path && basename(path) === 'npm-cli.js' && existsSync(path))
  if (!cli) throw new Error('找不到 npm CLI；请通过 npm run pack:release 运行。')
  return cli
}

export function packRelease({ destination = join(root, 'dist'), build = true } = {}) {
  destination = resolve(destination)
  if (build) execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true })
  const stage = mkdtempSync(join(tmpdir(), 'dsh-chatchat-release-'))
  try {
    const manifest = releaseManifest(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')))
    for (const file of payload) cpSync(join(root, file), join(stage, file), { recursive: true })
    writeFileSync(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
    lock.name = manifest.name
    lock.version = manifest.version
    lock.packages[''] = { ...lock.packages[''], version: manifest.version }
    delete lock.packages[''].devDependencies
    delete lock.packages[''].hasInstallScript
    writeFileSync(join(stage, 'npm-shrinkwrap.json'), `${JSON.stringify(lock, null, 2)}\n`)
    writeFileSync(join(stage, '.npmrc'), '')
    writeFileSync(join(stage, '.npmrc-global'), '')
    mkdirSync(destination, { recursive: true })
    const output = execFileSync(process.execPath, [npmCli(), 'pack', '--ignore-scripts', '--json', '--pack-destination', destination], {
      cwd: stage, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, DSH_HOME: stage, npm_config_cache: join(stage, '.npm-cache'), npm_config_userconfig: join(stage, '.npmrc'), npm_config_globalconfig: join(stage, '.npmrc-global'), npm_config_offline: 'true', npm_config_update_notifier: 'false' },
    })
    const [{ filename, files }] = JSON.parse(output)
    const archive = join(destination, filename)
    const bytes = readFileSync(archive)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    writeFileSync(`${archive}.sha256`, `${sha256}  ${filename}\n`)
    const info = { name: manifest.name, version: manifest.version, filename, sha256, integrity, bytes: bytes.length, files: files.length }
    writeFileSync(`${archive}.json`, `${JSON.stringify(info, null, 2)}\n`)
    return { ...info, archive }
  } finally {
    rmSync(stage, { recursive: true, force: true, maxRetries: 5 })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    process.stdout.write('生成独立预编译插件包，无安装编译脚本。\n用法：npm run pack:release -- [输出目录]\n示例：npm run pack:release -- ./dist\n')
  } else {
    if (args.length > 1) throw new Error('只接受一个输出目录；运行 --help 查看示例。')
    process.stdout.write(`${JSON.stringify(packRelease(args[0] ? { destination: args[0] } : {}), null, 2)}\n`)
  }
}
