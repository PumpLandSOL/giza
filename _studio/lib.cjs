// shared look for the GIZA kit: engraved-note page head, pyramid mark, lace rule, and the seekable engraved pyramid
'use strict';
const fs = require('fs'), path = require('path');
// set these two when the handle and the domain exist; every graphic footer, video end card and the X kit pick them up
const X = '', SITE = 'gizarh.xyz', TICK = '$GIZA';
const LINE = [SITE, X].filter(Boolean).join(' · ') || 'Robinhood Chain';
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Instrument+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">`;
const MARK = (s = 40) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#030604"/><circle cx="32" cy="32" r="29.5" fill="none" stroke="#00c805" stroke-width="1"/><path d="M32 12 33.3 23.5H25.6Z" fill="#eaffec"/><path d="M32 12 38.4 23.5H33.3Z" fill="#9dffa8"/><path d="M24.1 26.2H33.6L36 48H11.5Z" fill="#00c805"/><path d="M33.6 26.2H39.9L52.5 48H36Z" fill="#067a1e"/><path d="M19.9 33.5H34.4M15.7 40.8H35.2" stroke="#030604" stroke-width="1.3"/><path d="M34.4 33.5H44.1M35.2 40.8H48.3" stroke="#030604" stroke-width="1.3" opacity=".7"/></svg>`;
const LACE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='18' viewBox='0 0 48 18'%3E%3Cg fill='none' stroke='%2300c805' stroke-width='.7' opacity='.6'%3E%3Cpath d='M0 9c6-10 18-10 24 0s18 10 24 0'/%3E%3Cpath d='M0 9c6 10 18 10 24 0s18-10 24 0'/%3E%3Cpath d='M-12 9c6-10 18-10 24 0s18 10 24 0s18-10 24 0'/%3E%3Cpath d='M-12 9c6 10 18 10 24 0s18-10 24 0s18 10 24 0'/%3E%3Cpath d='M0 9h48' opacity='.5'/%3E%3C/g%3E%3C/svg%3E")`;
const CSS = (W, H) => `*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#030604;color:#eefbf0;font:400 26px/1.5 'Instrument Sans',sans-serif;-webkit-font-smoothing:antialiased}
#cv{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.cap{font:400 17px 'DM Mono',monospace;letter-spacing:.3em;text-transform:uppercase;color:#00c805}.cap.d{color:#62806a}
.h{font:400 104px/1 'Fraunces',serif;letter-spacing:-.035em;color:#eefbf0}.h em,.it{font-style:italic;color:#9dffa8}
.ser{font-family:'Fraunces',serif}.mono{font-family:'DM Mono',monospace}.dim{color:#9fbfa6}.mut{color:#62806a}.lil{color:#9dffa8}.hot{color:#ccff00}
.wm{font:italic 400 300px/.86 'Fraunces',serif;letter-spacing:-.045em;background:linear-gradient(180deg,#fff 25%,#9dffa8 62%,#00c805);-webkit-background-clip:text;background-clip:text;color:transparent;padding:0 .06em .08em}
.lace{position:absolute;left:0;right:0;height:18px;background:${LACE} repeat-x center;border-top:1px solid #14261a;border-bottom:1px solid #14261a}
.fr{position:absolute;border:1px solid #1c3a24;background:linear-gradient(180deg,rgba(9,17,11,.92),rgba(4,8,5,.92))}
.fr:before,.fr:after{content:'';position:absolute;width:14px;height:14px;border:1px solid #00c805;pointer-events:none}.fr:before{left:-1px;top:-1px;border-right:0;border-bottom:0}.fr:after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.rw{display:flex;justify-content:space-between;align-items:baseline;gap:30px;padding:18px 0;border-bottom:1px solid #14261a}.rw:last-child{border:0}
.foot{position:absolute;left:70px;right:70px;bottom:44px;display:flex;justify-content:space-between;align-items:center}
.mk{display:flex;align-items:center;gap:14px;font:italic 500 36px 'Fraunces',serif;letter-spacing:-.02em;color:#eefbf0}`;
const HEAD = (W, H, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS(W, H)}${extra}</style></head><body><canvas id="cv"></canvas>`;
const FOOT = () => `<div class="foot"><span class="mk">${MARK(44)}GIZA</span><span class="cap d">${LINE} · <span style="color:#9dffa8">${TICK}</span></span></div>`;
// the pyramid is the site's own drawing code (client/src/pyramid.js): a pure function of time, so every frame is reproducible.
// rosette(g, {cx, cy, S, t, a, progress, text, reveal, well}) keeps the kit's call shape: S is the radius of the space the
// pyramid may fill, centred on (cx, cy).
const ROSETTE = `<script>${fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pyramid.js'), 'utf8')}
window.rosette=function(g,o){window.pyramidDraw(g,Object.assign({},o,{S:o.S*(o.fit||.78),cy:o.cy+o.S*.13}));};
window.RING_TEXT='GIZA · THE (3,3) RESERVE OF ROBINHOOD CHAIN · STAKE · BOND · COMPOUND · ';
window.cvInit=function(){const cv=document.getElementById('cv'),W=cv.clientWidth,H=cv.clientHeight,d=window.__dpr||1;cv.width=W*d;cv.height=H*d;const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);return{g,W,H};};
window.fontsReady=function(){return Promise.all([document.fonts.load('400 20px "DM Mono"'),document.fonts.load('italic 400 40px "Fraunces"'),document.fonts.load('400 40px "Fraunces"'),document.fonts.load('500 20px "Instrument Sans"'),document.fonts.load('italic 500 40px "Fraunces"')]).then(()=>document.fonts.ready);};
</script>`;
module.exports = { X, SITE, LINE, TICK, FONTS, MARK, LACE, CSS, HEAD, FOOT, ROSETTE };
