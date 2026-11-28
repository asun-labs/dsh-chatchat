import { readFileSync } from 'node:fs'
import { brandProfile } from '../shared/branding.js'

export const BRAND_NAME = 'DSH Bot'
export const LEGACY_BRAND_NAME = 'Seal Dot'
export const MAIN_ROLE = 'Team Leader'
export const DEFAULT_AVATARS = Object.freeze({
  seal: `data:image/png;base64,${readFileSync(new URL('../../assets/seal-dot.png', import.meta.url)).toString('base64')}`,
  dsh: `data:image/svg+xml;base64,${readFileSync(new URL('../../assets/dsh-host.svg', import.meta.url)).toString('base64')}`,
})

export function hostBranding(config = {}) {
  const profile = brandProfile(config.branding ?? 'dsh')
  return { ...profile, image: DEFAULT_AVATARS[profile.id] }
}

// Rename only records still carrying the product's old default name. Custom Bot
// names and workspace titles belong to the user.
export async function migrateBrandNames({ workspace, mainBots, renameBot, updateRole, updateAvatar, brand }) {
  const names = [LEGACY_BRAND_NAME, 'Seal Bot', 'DSH Bot']
  const workspaceName = brand?.botName ?? BRAND_NAME
  if (names.includes(workspace?.title) && workspace.title !== workspaceName) await workspace.setTitle(workspaceName)
  for (const bot of mainBots) {
    if (!bot) continue
    if (!brand) {
      if (bot?.name === LEGACY_BRAND_NAME) await renameBot(bot.id, BRAND_NAME)
    } else {
      const images = Object.values(DEFAULT_AVATARS)
      if (!bot.brandDefaults && (names.includes(bot.name) || images.includes(bot.avatar?.image))) {
        bot.brandDefaults = { name: names.includes(bot.name), avatar: images.includes(bot.avatar?.image) }
      }
      if (bot.brandDefaults?.name === true && names.includes(bot.name) && bot.name !== brand.botName) await renameBot(bot.id, brand.botName)
      if (bot.brandDefaults?.avatar === true && images.includes(bot.avatar?.image) && bot.avatar.image !== brand.image) await updateAvatar(bot.id, { ...bot.avatar, image: brand.image })
    }
    if (bot?.role === '团队协调员') await updateRole(bot.id, MAIN_ROLE)
  }
}
