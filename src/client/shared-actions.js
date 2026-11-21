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
  return integration.installSettings?.(ctx, actions)
}
