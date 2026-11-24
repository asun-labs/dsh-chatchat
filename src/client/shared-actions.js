import { t } from './i18n.js'

// 原版仍负责 Bot 专属设置；跨到公共能力时交给 Seal 已有的页面。
export function bindSharedActions(actions, { selectPanel, openSection, schedulePanelId = 'schedules' }) {
  const ownSettings = actions.openSettings
  actions.openSettings = (page = 'general', id = null) => {
    if (page === 'schedules') { actions.closePanel(); actions.closeSettings(); return selectPanel(schedulePanelId) }
    if (page === 'models' || page === 'dsh') { actions.closeSettings(); return openSection(page === 'dsh' ? id : 'models') }
    if (page === 'connectors') { actions.closePanel(); actions.closeSettings(); return selectPanel('connectors') }
    return ownSettings(page, id)
  }
  actions.openModels = () => actions.openSettings('models')
  actions.openHarnessOnboarding = () => actions.openModels()
  actions.openConnectors = () => actions.openSettings('connectors')
}

export function installSharedSettings(ctx, actions, integration = {}) {
  if (integration.installSettings != null) return integration.installSettings(ctx, actions)
  if (!ctx.slots?.entries) return
  // 原生设置由其公开 slot store 管理；Bot 的精简设置页不提供模型管理。
  const openModels = () => {
    const shell = ctx.slots.entries('sidebar.settings').find(entry => entry.store?.create)?.store.create()
    if (typeof shell?.actions?.openSection !== 'function') {
      actions.reportError(new Error(t('Model settings are unavailable in this profile.')), 'models-settings')
      return
    }
    actions.closeSettings()
    shell.actions.openSection('models')
  }
  actions.openModels = openModels
  actions.openHarnessOnboarding = openModels
}
