import { FALLBACK_SIDEBAR_WIDTH } from './frame-layout.js'

// Explicit hosts own their navigation; standalone DSH uses the full surface.
export function registerPanel(ctx, options, Panel, integration = {}) {
  return integration.registerPanel(ctx, { ...options, sidebarDefaultWidth: FALLBACK_SIDEBAR_WIDTH }, Panel)
}
