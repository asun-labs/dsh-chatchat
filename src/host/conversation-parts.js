export function conversationParts(rt, id, partsOf) {
  return rt.roomOf(id) ? partsOf(undefined, id) : partsOf(id)
}
