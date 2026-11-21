// 历史文字分页也保留正式交付；坐标来自原事件，不能用新分段的 seq 或数组下标替换。
export function withHistoryDeliveries(items, events, sessionId, hidden) {
  const turns = new Map()
  for (const event of events) {
    const data = event.data
    if (event.type !== 'deliverables/presented' || !Number.isSafeInteger(event.seq) || event.seq < 0
      || !Number.isSafeInteger(data?.turn) || data.turn < 1 || hidden.has(data.turn)
      || typeof data.callId !== 'string' || !data.callId || !Array.isArray(data.files)) continue
    let delivery = turns.get(data.turn)
    if (!delivery) {
      delivery = { kind: 'files', sessionId, turn: data.turn, seq: event.seq, time: event.time, files: new Map() }
      turns.set(data.turn, delivery)
    }
    for (const [index, file] of data.files.entries()) {
      if (!file || typeof file.path !== 'string' || !file.path.trim()
        || (file.description !== undefined && typeof file.description !== 'string')) continue
      delivery.files.set(file.path, { path: file.path, ...(file.description === undefined ? {} : { description: file.description }), seq: event.seq, index })
    }
  }
  return mergeHistoryDeliveries([...items, ...[...turns.values()]
    .filter(delivery => delivery.files.size).map(delivery => ({ ...delivery, files: [...delivery.files.values()] }))])
}

// 旧分页继续加载时，同轮同路径仍使用最新交付，避免一份文件出现多张历史卡片。
export function mergeHistoryDeliveries(items) {
  const result = items.filter(item => item.kind !== 'files')
  const turns = new Map()
  for (const row of items.filter(item => item.kind === 'files')) {
    const key = `${row.sessionId}:${row.turn}`
    let delivery = turns.get(key)
    if (!delivery) {
      delivery = { ...row, files: new Map() }
      turns.set(key, delivery)
    }
    for (const file of row.files) {
      const before = delivery.files.get(file.path)
      if (!before || file.seq >= before.seq) delivery.files.set(file.path, file)
    }
  }
  for (const delivery of turns.values()) {
    const at = result.findLastIndex(item => item.turn === delivery.turn)
    // 分页边界可能只包含交付事件，仍应保留可恢复的卡片。
    const position = at >= 0 ? at + 1 : result.findIndex(item => Number.isInteger(item.seq) && item.seq > delivery.seq)
    result.splice(position < 0 ? result.length : position, 0, { ...delivery, files: [...delivery.files.values()] })
  }
  return result
}
