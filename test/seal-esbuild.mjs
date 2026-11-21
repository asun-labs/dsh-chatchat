// 源码测试沿用构建期资源宏，但不依赖宿主产品的工具链。
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
export const build = options => esbuild.build({ ...options, define: {
  __SEAL_DOT_ICON__: '""',
  __SEAL_BOT_ROBOT_AVATARS__: '[]',
  ...options.define,
} })
