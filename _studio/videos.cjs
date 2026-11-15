// GIZA videos (frame-exact, 1920x1080, 30 fps).  node _studio/videos.cjs [name]   ·   node _studio/videos.cjs still <name> <t,t,…>
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), { open } = require('./cdp.cjs'), { LINE, HEAD, ROSETTE } = require('./lib.cjs');
const B = path.join(__dirname, '..', 'brand'), K = path.join(__dirname, 'kit'), FPS = 30, url = (f) => 'file:///' + f.split(path.sep).join('/');
const APY = 250000, EPY = 31557600 / 300, RATE = Math.pow(1 + APY / 100, 1 / EPY) - 1;
const VCSS = `body{font-size:36px}.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0}
.h{font-size:128px;line-height:1.02}.cap{font-size:22px}.big{font:italic 400 200px/1 Fraunces,serif;letter-spacing:-.04em}
.pl{border:1px solid #1c3a24;background:linear-gradient(180deg,rgba(9,17,11,.94),rgba(4,8,5,.94));padding:40px 42px;text-align:left;position:relative}
.pl .n{font:italic 300 96px/1 Fraunces;color:transparent;-webkit-text-stroke:1.5px #2c5a38}.pl .t{font:italic 500 46px/1.15 Fraunces;margin:22px 0 14px}.pl .b{color:#9fbfa6;font-size:31px;line-height:1.5}
#zw{position:absolute;left:0;right:0;top:340px;text-align:center;opacity:0}#zl{position:absolute;left:0;right:0;top:716px;text-align:center;opacity:0}#zf{position:absolute;left:0;right:0;bottom:52px;text-align:center;opacity:0}`;
const JS = `const $=(i)=>document.getElementById(i),cl=(x)=>Math.max(0,Math.min(1,x)),e=(x)=>1-Math.pow(1-cl(x),3),win=(t,a,b,f=.45)=>cl(Math.min((t-a)/f,(b-t)/f));
const show=(id,t,a,b,f)=>{const o=win(t,a,b,f),el=$(id);el.style.opacity=o;el.style.filter='blur('+((1-o)*10).toFixed(1)+'px)';el.style.transform='translateY('+((1-o)*18).toFixed(1)+'px)';};
const fmt=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});const RATE=${RATE};let G=null;
// end card: the rosette weaves itself in around the wordmark while the rebase arc closes
const end=(t,a)=>{const z=t-a;if(z<0)return;rosette(G,{cx:960,cy:452,S:450,t:t,reveal:e(z/1.8),well:1,progress:cl((z-.5)/3.2),text:'',a:cl(z/.5)});const o=cl((z-.3)/.7);['zw','zl','zf'].forEach((k,i)=>{const q=cl((z-.3-i*.25)/.7);$(k).style.opacity=q;$(k).style.filter='blur('+((1-q)*10).toFixed(1)+'px)';});};`;
const page = (body, line, seek, endAt) => HEAD(1920, 1080, VCSS) + body + `<div id="zw"><div class="cap">The (3,3) reserve of Robinhood Chain</div><div class="wm" style="font-size:300px;margin-top:8px">GIZA</div></div><div id="zl" class="ser it" style="font:italic 400 56px Fraunces;color:#9dffa8">${line}</div><div id="zf" class="cap d">${LINE} · <span style="color:#9dffa8">$GIZA</span></div>` + ROSETTE +
  `<script>${JS}window.__seek=(t)=>{G.clearRect(0,0,1920,1080);${seek}end(t,${endAt});};fontsReady().then(()=>{G=cvInit().g;window.__seek(0);window.__ready=true;});</script></body></html>`;

const MX = [['(3, 3)', '(1, 1)', '(−1, 1)'], ['(1, 1)', '(1, 1)', '(−1, 1)'], ['(1, −1)', '(1, −1)', '(−3, −3)']], ML = ['stake', 'bond', 'sell'];
const V = {
  // 1. engraving was how money earned trust; here the chain does that job
  'giza-hype-14s': [14, page(`<div class="s" id="a"><div class="cap">4,500 years ago</div><div class="h" style="margin-top:30px">The pyramids were built<br><em>to outlast everyone who saw them.</em></div></div>
    <div class="s" id="b"><div class="cap">on Robinhood Chain</div><div class="h" style="margin-top:30px">This one is built<br><em>one verified stone at a time.</em></div></div>
    <div class="s" id="c" style="flex-direction:row;gap:90px"><div class="big" id="c0">Stake.</div><div class="big" id="c1">Bond.</div><div class="big lil" id="c2">Compound.</div></div>`,
    'Stake to compound. Bond to buy below market.',
    `rosette(G,{cx:960,cy:540,S:620,t:t,a:.3*(1-cl((t-9.2)/.6)),reveal:e(t/8),text:''});show('a',t,0,3.3);show('b',t,3.3,6.8);$('c').style.opacity=win(t,6.8,9.6,.35);[0,1,2].forEach((i)=>{const q=cl((t-7-i*.55)/.4);$('c'+i).style.opacity=q;$('c'+i).style.transform='translateY('+((1-q)*26).toFixed(1)+'px)';});`, 9.6)],

  // 2. the rebase clock, with real per-epoch numbers on a 1,000,000 sGIZA position
  'giza-rebase-12s': [12, page(`<div class="s" id="a"><div class="cap">staking</div><div class="h" style="margin-top:30px">Every five minutes,<br><em>the index steps up.</em></div></div>
    <div class="s" id="b"><div style="position:absolute;left:330px;top:440px;width:460px;text-align:center"><div class="cap d">next rebase</div><div class="mono" id="cd" style="font-size:120px;line-height:1.1">5:00</div></div>
      <div style="position:absolute;left:1010px;top:300px;width:720px;text-align:left"><div class="cap">epoch <span id="ep">0</span></div><div class="cap d" style="margin-top:44px">index</div><div class="mono" id="ix" style="font-size:76px;line-height:1.15">1.000000</div><div class="cap d" style="margin-top:36px">your sGIZA</div><div class="ser it" id="bal" style="font:italic 400 104px/1.1 Fraunces;color:#fff">1,000,000.00</div><div class="mono hot" id="dl" style="font-size:38px;margin-top:10px;opacity:0">+74.38</div></div></div>`,
    '288 rebases a day. Each one grows every sGIZA balance.',
    `show('a',t,0,2.8);show('b',t,2.8,8.9);const u=Math.max(0,t-3.2)/1.4,k=Math.floor(u),f=u-k,o=win(t,2.8,8.9);rosette(G,{cx:560,cy:540,S:330,t:t,a:o,well:1,progress:t>3.2?f:0,text:RING_TEXT});
    const left=Math.round(300*(1-f));$('cd').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');$('ep').textContent=k;const idx=Math.pow(1+RATE,k),bal=1e6*idx;$('ix').textContent=idx.toFixed(6);$('bal').textContent=fmt(bal,2);
    const fl=k>0?cl(1-f/.6):0;$('bal').style.color='rgb('+Math.round(255-fl*98)+',255,'+Math.round(255-fl*87)+')';$('dl').style.opacity=fl;$('dl').textContent='+'+fmt(1e6*Math.pow(1+RATE,k-1)*RATE,2)+' sGIZA';`, 8.9)],

  // 3. the life of one bond
  'giza-bond-13s': [13, page(`<div class="s" id="a"><div class="cap">bonds</div><div class="h" style="margin-top:30px">Buy GIZA<br><em>below the market price.</em></div></div>
    <div class="s" id="b"><div style="display:grid;grid-template-columns:repeat(4,390px);gap:26px">${[['I', 'You pay 1 ETH', 'Your wallet shows the transfer. You approve it.'], ['II', 'It lands in the treasury', 'Mined on Robinhood Chain.'], ['III', 'The chain is read', 'The mined transaction is checked.'], ['IV', 'GIZA at 7% off', 'Credited for the amount that arrived.']].map(([n, a, b], i) => `<div class="pl" id="p${i}" style="height:450px;opacity:0"><div class="n">${n}</div><div class="t" style="font-size:42px">${a}</div><div class="b" style="font-size:28px">${b}</div></div>`).join('')}</div>
      <div id="vs" style="width:1638px;margin-top:54px;opacity:0;text-align:left"><div style="display:flex;justify-content:space-between" class="cap d"><span>vesting</span><span id="vd">day 0 of 5</span></div><div style="height:6px;background:#112014;margin-top:16px"><div id="vb" style="height:100%;width:0;background:linear-gradient(90deg,#00c805,#ccff00)"></div></div></div></div>`,
    'Bond ETH or USDG. Vested in five days.',
    `rosette(G,{cx:960,cy:540,S:640,t:t,a:.16*(1-cl((t-9.2)/.5)),text:''});show('a',t,0,2.8);show('b',t,2.8,9.6);[0,1,2,3].forEach((i)=>{const q=cl((t-3.1-i*.85)/.45),on=t>3.1+i*.85&&t<3.1+(i+1)*.85+.2;$('p'+i).style.opacity=q;$('p'+i).style.borderColor=on||(i===3&&t>5.65)?'#00c805':'#1c3a24';$('p'+i).style.boxShadow=on?'0 0 70px rgba(0,200,5,.35)':'none';});
    const v=cl((t-6.7)/2.3);$('vs').style.opacity=cl((t-6.5)/.4);$('vb').style.width=(v*100).toFixed(2)+'%';$('vd').textContent='day '+Math.min(5,Math.floor(v*5+.0001))+' of 5';`, 9.6)],

  // 4. the payoff grid resolves to its top-left cell
  'giza-33-12s': [12, page(`<div class="s" id="a"><div class="cap">game theory</div><div class="h" style="margin-top:30px">Two holders.<br><em>Three choices each.</em></div></div>
    <div class="s" id="b"><div style="display:grid;grid-template-columns:230px repeat(3,300px);grid-auto-rows:190px"><div></div>${ML.map((l) => `<div class="cap d" style="display:grid;place-items:end center;padding-bottom:22px">they ${l}</div>`).join('')}
      ${MX.map((r, i) => `<div class="cap d" style="display:grid;place-items:center end;padding-right:30px">you ${ML[i]}</div>` + r.map((c, j) => `<div id="m${i}${j}" style="border:1px solid #1c3a24;margin:-0.5px;display:grid;place-items:center;font:400 46px 'DM Mono';color:#9fbfa6;background:rgba(6,11,7,.92);opacity:0">${c}</div>`).join('')).join('')}</div>
      <div id="ml" class="ser it" style="font:italic 400 50px Fraunces;color:#9dffa8;margin-top:44px;height:60px"></div></div>`,
    'The best move is the same for everyone.',
    `rosette(G,{cx:960,cy:540,S:640,t:t,a:.14*(1-cl((t-8.4)/.5)),text:''});show('a',t,0,2.6);show('b',t,2.6,8.8);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){const el=$('m'+i+j),s=3+((2-i)+(2-j))*.42,q=cl((t-s)/.35),hot=i+j===0&&t>6.4;el.style.opacity=q;el.style.borderColor=hot?'#9dffa8':'#1c3a24';el.style.color=hot?'#fff':(i===2&&j===2?'#ff6b6b':'#9fbfa6');el.style.background=hot?'radial-gradient(circle,rgba(0,200,5,.5),rgba(0,200,5,.1))':'rgba(6,11,7,.92)';el.style.font=hot?'italic 500 84px Fraunces':"400 46px 'DM Mono'";el.style.boxShadow=hot?'0 0 90px rgba(0,200,5,.5)':'none';}
    $('ml').textContent=t>6.4?'Both stake. Both compound.':t>4.4?'One sells. The other pays for it.':t>3?'Both sell. Both lose.':'';`, 8.8)],

  // 5. thirty days of rebases on one position
  'giza-compound-12s': [12, page(`<div class="s" id="a"><div class="cap">compounding</div><div class="h" style="margin-top:30px">What does <em>288 rebases a day</em><br>add up to?</div></div>
    <div class="s" id="b"><div style="position:absolute;left:150px;top:150px;text-align:left"><div class="cap d">day <span id="dy">0</span> of 30</div><div class="ser" id="bl" style="font:italic 400 150px/1.05 Fraunces;color:#fff;margin-top:10px">1,000,000</div><div class="cap" style="margin-top:8px">sGIZA · from 1,000,000 staked</div></div>
      <div id="pc" class="mono hot" style="position:absolute;right:150px;top:210px;font-size:84px">+0.0%</div></div>`,
    'Course by course. That is how it rises.',
    `rosette(G,{cx:1560,cy:820,S:420,t:t,a:.2*(1-cl((t-8.6)/.5)),text:''});show('a',t,0,2.6);show('b',t,2.6,9);const o=win(t,2.6,9),p=e((t-3)/5.2),D=30*p,X0=150,Y0=940,CW=1620,CH=430,top=Math.pow(1+RATE,30*288)-1,roi=(d)=>Math.pow(1+RATE,d*288)-1;
    if(o>0){G.globalAlpha=o;G.strokeStyle='#14261a';G.lineWidth=1;for(let k=0;k<4;k++){G.beginPath();G.moveTo(X0,Y0-k*CH/3);G.lineTo(X0+CW,Y0-k*CH/3);G.stroke();}
      G.beginPath();G.moveTo(X0,Y0);const N=200;let lx=X0,ly=Y0;for(let i=0;i<=N;i++){const d=D*i/N;lx=X0+d/30*CW;ly=Y0-roi(d)/top*CH;G.lineTo(lx,ly);}const gr=G.createLinearGradient(0,Y0-CH,0,Y0);gr.addColorStop(0,'rgba(0,200,5,.38)');gr.addColorStop(1,'rgba(0,200,5,0)');G.lineTo(lx,Y0);G.closePath();G.fillStyle=gr;G.fill();
      G.beginPath();for(let i=0;i<=N;i++){const d=D*i/N,x=X0+d/30*CW,y=Y0-roi(d)/top*CH;i?G.lineTo(x,y):G.moveTo(x,y);}G.strokeStyle='#9dffa8';G.lineWidth=4;G.stroke();G.beginPath();G.arc(lx,ly,10,0,7);G.fillStyle='#030604';G.fill();G.strokeStyle='#fff';G.lineWidth=3;G.stroke();G.globalAlpha=1;}
    $('dy').textContent=Math.floor(D+.0001);$('bl').textContent=fmt(1e6*(1+roi(D)));$('pc').textContent='+'+(roi(D)*100).toFixed(1)+'%';`, 9)],

  // 6. the whole onboarding
  'giza-start-15s': [15, page(`<div class="s" id="a"><div class="cap">getting started</div><div class="h" style="margin-top:30px">Three steps.<br><em>That is the whole setup.</em></div></div>
    <div class="s" id="b"><div style="display:grid;grid-template-columns:repeat(3,540px);gap:30px">${[['I', 'Connect a wallet', 'One free message signature proves the wallet is yours. It moves nothing.'], ['II', 'Bond ETH', 'Send ETH to the treasury and lock in GIZA at 7% under the market price.'], ['III', 'Claim and stake', 'As your bond vests, move it straight into sGIZA and start compounding.']].map(([n, a, b], i) => `<div class="pl" id="p${i}" style="height:500px;opacity:0"><div class="n">${n}</div><div class="t">${a}</div><div class="b">${b}</div></div>`).join('')}</div></div>`,
    'Open the app. Connect. Bond.',
    `rosette(G,{cx:960,cy:540,S:640,t:t,a:.16*(1-cl((t-11)/.5)),text:''});show('a',t,0,2.8);show('b',t,2.8,11.4);[0,1,2].forEach((i)=>{const s=3.1+i*2.6,q=cl((t-s)/.5),on=t>s&&t<s+2.6;$('p'+i).style.opacity=q*(on||t>10.9?1:.5+.5*cl(1-(t-s-2.6)/.4));$('p'+i).style.borderColor=on?'#00c805':'#1c3a24';$('p'+i).style.boxShadow=on?'0 0 80px rgba(0,200,5,.35)':'none';$('p'+i).style.transform='translateY('+((1-q)*30).toFixed(1)+'px)';});`, 11.4)],
};

async function render(c, name, dur, html) { const FR = path.join(__dirname, 'frames-' + name); fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const f = path.join(K, name + '.html'); fs.writeFileSync(f, html); await c.load(url(f), 1920, 1080); if (!(await c.ev('window.__ready===true'))) throw new Error('page did not load: ' + name);
  const N = Math.round(dur * FPS); for (let i = 0; i < N; i++) { await c.ev('__seek(' + (i / FPS).toFixed(4) + ')'); await c.shot(path.join(FR, 'f_' + String(i).padStart(4, '0') + '.jpg'), 'jpeg'); }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(FR, 'f_%04d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(B, name + '.mp4')]);
  fs.rmSync(FR, { recursive: true, force: true }); console.log('OK', name + '.mp4'); }

(async () => {
  fs.mkdirSync(K, { recursive: true }); fs.mkdirSync(B, { recursive: true }); const c = await open('about:blank', 1920, 1080, 9362);
  try {
    if (process.argv[2] === 'still') { const name = Object.keys(V).find((n) => n.includes(process.argv[3])); const f = path.join(K, name + '.html'); fs.writeFileSync(f, V[name][1]); await c.load(url(f), 1920, 1080);
      for (const t of process.argv[4].split(',')) { await c.ev('__seek(' + t + ')'); await c.shot(path.join(K, 'still-' + name + '-' + t + '.jpg'), 'jpeg'); } console.log('stills', name); }
    else for (const n of Object.keys(V).filter((x) => !process.argv[2] || x.includes(process.argv[2]))) await render(c, n, V[n][0], V[n][1]);
  } finally { c.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
