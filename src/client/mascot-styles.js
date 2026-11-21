export const sealMascotStyles = `
.seal-bot-mascot{display:block;width:100%;height:100%;overflow:visible}
.seal-bot-mascot__ring{fill:rgba(125,125,125,.035);stroke:rgba(150,150,150,.22);stroke-width:1.5}
.seal-bot-mascot__star{fill:#f8a52d;stroke:#483b2b;stroke-width:2;stroke-linejoin:round;paint-order:stroke}
.seal-bot-mascot__fin{transform-origin:98px 96px;animation:seal-mascot-wave 6.4s ease-in-out infinite}
.seal-bot-mascot__eye{transform-box:fill-box;transform-origin:center;animation:seal-mascot-blink 4.6s ease-in-out infinite}
.seal-bot-mascot__eye+.seal-bot-mascot__eye{animation-delay:.04s}
.seal-bot-mascot__mouth{transform-box:fill-box;transform-origin:center;opacity:0;animation:seal-mascot-talk 6.4s ease-in-out infinite}
@keyframes seal-mascot-blink{0%,38%,43%,72%,77%,100%{transform:scaleY(1)}40%,41%,74%,75%{transform:scaleY(.08)}}
@keyframes seal-mascot-wave{0%,10%,42%,100%{transform:rotate(0)}16%,28%{transform:rotate(-22deg)}22%,34%{transform:rotate(8deg)}}
@keyframes seal-mascot-talk{0%,12%,38%,100%{opacity:0;transform:scaleY(.25)}15%,23%,31%{opacity:1;transform:scaleY(1)}19%,27%,35%{opacity:1;transform:scaleY(.35)}}
:is(button:hover,button:focus-visible) .seal-bot-mascot__fin{animation-name:seal-mascot-wave-hello;animation-duration:1.5s}
:is(button:hover,button:focus-visible) .seal-bot-mascot__mouth{animation-name:seal-mascot-talk-hello;animation-duration:1.5s}
@keyframes seal-mascot-wave-hello{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-22deg)}40%,80%{transform:rotate(8deg)}}
@keyframes seal-mascot-talk-hello{0%,100%{opacity:0;transform:scaleY(.25)}15%,45%,75%{opacity:1;transform:scaleY(1)}30%,60%,90%{opacity:1;transform:scaleY(.35)}}
`
