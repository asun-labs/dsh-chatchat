// Upstream's fixtures exercise the standalone runtime and explicitly name Chief.
// Seal's apply() intentionally selects the integrated service profile instead;
// product tests cover that boundary and Seal defaults separately.
import { createRuntime as runtime } from '../index.js'
export * from '../index.js'
export const createRuntime = (ctx, config = {}) => runtime(ctx, {
  mainName: 'Chief', mainRole: 'Chief of Staff', ...config,
})
export const apply = (ctx, config) => { createRuntime(ctx, config) }
