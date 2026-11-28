import { brandProfile, agentDisplayName } from '../shared/branding.js'

let active = { profile: brandProfile(), disposed: false, previous: null }
export const currentBrand = () => active.profile
export const currentAgentName = agent => agentDisplayName(agent, currentBrand())
export const brandImage = () => typeof __DSH_BOT_ICON__ === 'undefined' ? '' : __DSH_BOT_ICON__

// A previously chosen avatar is user data, not a request to rebrand the plugin.
export const isLegacyMascot = image => Boolean(image && typeof __SEAL_DOT_ICON__ !== 'undefined' && image === __SEAL_DOT_ICON__)

// 与 locale 相同的模块作用域；卸载旧 Client 不得清除后装载实例的品牌。
export function installBranding(id = 'dsh') {
  const scope = { profile: brandProfile(id), previous: active, disposed: false }
  active = scope
  return {
    update: id => { scope.profile = brandProfile(id) },
    dispose: () => {
      scope.disposed = true
      if (active === scope) while (active.disposed && active.previous) active = active.previous
    },
  }
}

export function brandText(text) {
  const brand = currentBrand()
  return text.replaceAll('Seal Bot', brand.botName).replaceAll('Seal Agent', brand.agentName).replaceAll('Seal Harness', brand.hostName)
}
