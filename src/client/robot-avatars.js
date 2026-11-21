import { createElement as h } from 'react'
import { t } from './i18n.js'

// 构建时嵌入网站原图的缩略图，创建和编辑头像均可离线使用。
export const ROBOT_AVATARS = typeof __SEAL_BOT_ROBOT_AVATARS__ === 'undefined' ? [] : __SEAL_BOT_ROBOT_AVATARS__

export function isRobotAvatar(image) {
  return ROBOT_AVATARS.some(item => item.image === image)
}

export function randomRobotAvatar() {
  return ROBOT_AVATARS[Math.floor(Math.random() * ROBOT_AVATARS.length)]
}

export function RobotAvatarGallery({ selected, onPick }) {
  return h('div', { className: 'bt-robots' },
    h('div', { className: 'bt-robots-grid', role: 'group', 'aria-label': t('Illustrated robots') }, ROBOT_AVATARS.map(item =>
      h('button', {
        key: item.id, type: 'button', className: 'bt-robots-pick',
        'aria-label': item.label, title: item.label, 'aria-pressed': selected === item.image,
        onClick: () => onPick(item),
      }, h('img', { src: item.image, alt: '', draggable: false })))))
}
