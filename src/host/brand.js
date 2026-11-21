export const BRAND_NAME = 'Seal Bot'
export const LEGACY_BRAND_NAME = 'Seal Dot'
export const MAIN_ROLE = 'Team Leader'

// Rename only records still carrying the product's old default name. Custom Bot
// names and workspace titles belong to the user.
export async function migrateBrandNames({ workspace, mainBots, renameBot, updateRole }) {
  if (workspace?.title === LEGACY_BRAND_NAME) await workspace.setTitle(BRAND_NAME)
  for (const bot of mainBots) {
    if (bot?.name === LEGACY_BRAND_NAME) await renameBot(bot.id, BRAND_NAME)
    if (bot?.role === '团队协调员') await updateRole(bot.id, MAIN_ROLE)
  }
}
