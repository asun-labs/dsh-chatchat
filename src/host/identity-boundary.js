import { AsyncLocalStorage } from 'node:async_hooks'

const requests = new AsyncLocalStorage()
const refused = (code, message) => Object.assign(new Error(message), { code })

// 只约束统一登录发起的请求及其异步写入，不改变原生会话的数据归属。
export function assertRequestIdentity() {
  const scope = requests.getStore()
  if (scope?.active) scope.check()
}

export function captureIdentityGuard() {
  const scope = requests.getStore()
  return () => { if (scope?.active) scope.check() }
}

export function installIdentityBoundary(rt) {
  if (rt.identityBoundary) return rt.identityBoundary
  const serviceName = rt.config?.identityService ?? 'dshChatchatIdentity'
  const identity = () => rt.ctx.get?.(serviceName) ?? rt.ctx[serviceName]
  const run = async (operation) => {
    if (rt.config?.integrated !== true) return operation()
    const service = identity()
    const initial = service?.getSession()
    if (!initial?.accountId || initial.epoch === undefined) throw refused('bot/authentication-required', '请先登录，再使用 Bot。')
    const check = () => {
      const current = service.getSession()
      if (identity() !== service || !current || current.accountId !== initial.accountId || current.epoch !== initial.epoch) {
        throw refused('bot/identity-changed', '登录状态已变化，请登录后重试。')
      }
    }
    const scope = { check, active: true }
    return requests.run(scope, async () => {
      try {
        check()
        const result = await operation()
        check()
        return result
      } finally {
        // RPC 已接纳的原生后台任务继续原版生命周期，不继承永久的旧登录门禁。
        scope.active = false
      }
    })
  }
  return (rt.identityBoundary = { run })
}
