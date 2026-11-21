import { createElement as h, useId } from 'react'

// 两种模式共用品牌原图的分层，身体固定，右鳍和表情独立动作。
export function SealMascot({ image, star = true }) {
  const id = `seal-mascot-${useId().replaceAll(':', '')}`
  const fin = 'M94 69C99 81 102 94 101 108L140 136V40H118Z'
  const url = name => `url(#${id}-${name})`
  const gradient = (name, from, to) => h('radialGradient', { id: `${id}-${name}` }, h('stop', { stopColor: from }), h('stop', { offset: '1', stopColor: to }))
  return h('svg', { className: 'seal-bot-mascot', viewBox: '-8 -8 144 148', 'aria-hidden': true, focusable: false },
    h('defs', null,
      h('clipPath', { id: `${id}-round` }, h('circle', { cx: 64, cy: 65, r: 62 })),
      h('clipPath', { id: `${id}-fin` }, h('path', { d: fin })),
      h('mask', { id: `${id}-body`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 128, height: 128 },
        h('rect', { width: 128, height: 128, fill: 'white' }), h('path', { d: fin, fill: 'black' }),
        h('ellipse', { cx: 35.7, cy: 44.8, rx: 5.1, ry: 5.3, fill: 'black' }), h('ellipse', { cx: 77.6, cy: 37.6, rx: 5.1, ry: 5.3, fill: 'black' })),
      gradient('cream-left', '#f2e8d7', '#f1e7d6'), gradient('cream-right', '#faf3e8', '#f8f0e4'),
      h('linearGradient', { id: `${id}-eye`, x2: '.7', y2: '1' }, h('stop', { stopColor: '#465362' }), h('stop', { offset: '1', stopColor: '#273440' }))),
    h('circle', { className: 'seal-bot-mascot__ring', cx: 64, cy: 65, r: 63 }),
    h('g', { clipPath: url('round') },
      h('g', { className: 'seal-bot-mascot__fin', 'data-seal-part': 'fin' }, h('image', { href: image, width: 128, height: 128, clipPath: url('fin') })),
      h('image', { 'data-seal-part': 'body', href: image, width: 128, height: 128, mask: url('body') }),
      h('g', { 'data-seal-part': 'eyes' },
        h('ellipse', { cx: 35.7, cy: 44.8, rx: 5.2, ry: 5.4, fill: url('cream-left') }), h('ellipse', { cx: 77.6, cy: 37.6, rx: 5.2, ry: 5.4, fill: url('cream-right') }),
        h('ellipse', { className: 'seal-bot-mascot__eye', cx: 35.7, cy: 44.8, rx: 3.9, ry: 4.1, fill: url('eye') }), h('ellipse', { className: 'seal-bot-mascot__eye', cx: 77.6, cy: 37.6, rx: 3.9, ry: 4.1, fill: url('eye') })),
      h('g', { className: 'seal-bot-mascot__mouth', 'data-seal-part': 'mouth' }, h('ellipse', { cx: 59.8, cy: 55.2, rx: 4, ry: 3.7, fill: '#263440' }), h('ellipse', { cx: 60, cy: 57, rx: 2.4, ry: 1.3, fill: '#d69090' }))),
    star ? h('path', { className: 'seal-bot-mascot__star', d: 'm108 101 3.6 7.7 8.4.9-6.2 5.7 1.7 8.3-7.5-4.2-7.4 4.2 1.7-8.3-6.3-5.7 8.5-.9Z' }) : null)
}
