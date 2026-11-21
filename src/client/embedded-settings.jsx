import React, { useState, useSyncExternalStore } from 'react'
import { SettingsDialog } from './settings.js'

const layout = `
.seal-dot-settings{height:100%;min-height:0;color:var(--dsw-alias-label-primary,inherit)}
.seal-dot-settings .bt-settings-layer{position:static;inset:auto;z-index:auto;display:block;width:100%;height:100%;padding:0;font-family:inherit}
.seal-dot-settings .bt-settings{width:100%;height:100%;min-height:520px;max-height:none;border:0;border-radius:0;box-shadow:none;background:transparent;color:inherit;animation:none}
.seal-dot-settings .bt-settings-nav{flex:0 0 190px;max-width:190px;border-right:1px solid var(--dsw-alias-border-l2,#ffffff24);background:transparent}
.seal-dot-settings .bt-settings-main{min-width:0;flex:1;background:transparent}
.seal-dot-settings .bt-settings-head{padding:22px 24px 16px}
.seal-dot-settings .bt-settings-scroll{padding:0 24px 32px}
.seal-dot-settings .bt-settings-item{border-radius:8px}
.seal-dot-settings .bt-set-card{background:var(--dsw-alias-settings-card-fill,var(--bt-card));border-color:var(--dsw-alias-settings-card-stroke,var(--bt-line-2))}
@media(max-width:700px){.seal-dot-settings .bt-settings{flex-direction:column}.seal-dot-settings .bt-settings-nav{max-width:none;flex:none;width:100%;height:auto;max-height:150px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2,#ffffff24)}}
`

export function EmbeddedSettings({ rosterSource, updateSource, actions, ownStyles }) {
  const roster = useSyncExternalStore(rosterSource.subscribe, rosterSource.getSnapshot)
  const [location, setLocation] = useState({ page: 'general', id: null })
  const sectionActions = {
    ...actions,
    setSurface: undefined,
    openSettings: (page = 'general', id = null) => setLocation({ page, id }),
    openSession: id => setLocation({ page: 'bots', id }),
    closeSettings: () => setLocation({ page: 'general', id: null }),
  }
  const useUpdate = selector => selector(useSyncExternalStore(updateSource.subscribe, updateSource.getSnapshot))
  return <div className="seal-dot-settings" data-seal-dot-settings>
    <style>{ownStyles + layout}</style>
    <SettingsDialog embedded page={location.page} id={location.id} roster={roster} actions={sectionActions} useUpdate={useUpdate} />
  </div>
}
