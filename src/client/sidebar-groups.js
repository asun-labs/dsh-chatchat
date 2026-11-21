export function sidebarGroups(order, sections) {
  const sectionIds = new Set(sections.map(section => section.id))
  const ungrouped = order.filter(entry => !entry.item.sectionId || !sectionIds.has(entry.item.sectionId))
  const roomSections = sections.filter(section => {
    const entries = order.filter(entry => entry.item.sectionId === section.id)
    return entries.length > 0 && entries.every(entry => entry.kind === 'room')
  })
  const roomSectionIds = new Set(roomSections.map(section => section.id))
  return {
    ungrouped,
    bots: ungrouped.filter(entry => entry.kind !== 'room'),
    rooms: ungrouped.filter(entry => entry.kind === 'room'),
    botSections: sections.filter(section => !roomSectionIds.has(section.id)),
    roomSections,
  }
}
