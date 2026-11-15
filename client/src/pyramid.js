// The GIZA hero: an engraved pyramid, drawn live on canvas in banknote line-work.
// Each face is a stack of fine woven courses; two sets with slightly different pitch beat into a moving moiré.
// The capstone floats above the body and glows, the bright line tracing the outline is the rebase clock,
// and the microprint along the base carries the live epoch.
// window.pyramidDraw(g, o) is a pure function of its inputs (the brand kit renders frames with it);
// window.gizaPyramid(canvas) -> { set(state) } runs it live on the site.
window.pyramidDraw = function (g, o) {
  const cx = o.cx, cy = o.cy, S = o.S, t = o.t || 0, A = o.a == null ? 1 : o.a, rev = o.reveal == null ? 1 : o.reveal, K = o.k || 1, mx = o.mx || 0;
  if (A <= 0 || rev <= 0) return;
  const G = (al) => 'rgba(0,200,5,' + (al * A).toFixed(3) + ')', L2 = (al) => 'rgba(157,255,168,' + (al * A).toFixed(3) + ')';
  const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  // corner view of a square pyramid: apex, left corner, front corner, right corner
  const P = [cx, cy - 1.06 * S], Lc = [cx - 1.30 * S, cy + 0.50 * S], F = [cx + (0.20 + mx * 0.45) * S, cy + 0.80 * S], R = [cx + 1.16 * S, cy + 0.40 * S];
  const CAP = 0.17, GAP = 0.205, lift = S * (0.055 + 0.012 * Math.sin(t * 0.8));
  // glow behind the capstone, and a faint engraved sun: two lace rings that beat against each other
  const sun = [P[0], P[1] + S * 0.1 - lift];
  const rg = g.createRadialGradient(sun[0], sun[1], S * 0.04, sun[0], sun[1], S * 1.5); rg.addColorStop(0, G(0.26)); rg.addColorStop(0.45, 'rgba(0,120,20,' + (0.08 * A).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(3,6,4,0)');
  g.fillStyle = rg; g.fillRect(cx - S * 2.6, cy - S * 2.8, S * 5.2, S * 4.6);
  g.globalCompositeOperation = 'lighter';
  const ring = (Rr, amp, n, Kc, rot, al) => { const steps = Math.max(360, n * 24); g.lineWidth = 0.6; g.strokeStyle = G(al * Math.min(1, rev * 1.5));
    for (let k = 0; k < Kc; k++) { const ph = (k / Kc) * Math.PI * 2; g.beginPath(); for (let i = 0; i <= steps; i++) { const th = (i / steps) * Math.PI * 2, r = Rr + amp * Math.sin(n * th + ph), a = th + rot, x = sun[0] + r * Math.cos(a), y = sun[1] + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } };
  ring(S * 0.92, S * 0.10, 12, Math.round(14 * K), t * 0.03, 0.10); ring(S * 0.92, S * 0.10, 13, Math.round(14 * K), -t * 0.03, 0.085);
  // rays engraved around the capstone
  g.lineWidth = 0.7; const NR = Math.round(72 * K);
  for (let i = 0; i < NR; i++) { const a = (i / NR) * Math.PI * 2 + t * 0.01, r0 = S * (0.36 + 0.03 * Math.sin(i * 1.7)), r1 = S * (0.58 + 0.16 * Math.sin(i * 2.3 + t * 0.5) + 0.06 * (i % 2));
    g.strokeStyle = G(0.16 * Math.min(1, rev * 1.5)); g.beginPath(); g.moveTo(sun[0] + r0 * Math.cos(a), sun[1] + r0 * Math.sin(a)); g.lineTo(sun[0] + r1 * Math.cos(a), sun[1] + r1 * Math.sin(a)); g.stroke(); }
  // one face: N courses from edge P→a to edge P→b, each a fine wave; drawn twice with different pitch for the moiré
  const face = (a, b, f0, f1, N, al, dy, pitch, drift) => {
    for (let k = 0; k <= N; k++) { const f = f0 + (f1 - f0) * (k / N); if ((f - f0) / (f1 - f0) > rev * 1.25) break;
      const p = lerp(P, a, f), q = lerp(P, b, f), len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
      const seg = Math.max(8, Math.round(len / 5)), amp = S * 0.0052 * (0.6 + 0.4 * Math.sin(k * 0.9 + t * 0.6));
      g.beginPath(); for (let i = 0; i <= seg; i++) { const u = i / seg, w = amp * Math.sin(u * len / (S * pitch) * Math.PI * 2 + k * 1.3 + t * drift), x = p[0] + (q[0] - p[0]) * u + nx * w, y = p[1] + (q[1] - p[1]) * u + ny * w - dy; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = G(al * (0.55 + 0.45 * Math.sin(k * 0.5 + t * 0.4) ** 2)); g.stroke(); } };
  // optional solid tint under the line-work (the avatar uses it so the shape still reads at 48 px)
  if (o.fill) { const poly = (pts, al, dy) => { g.fillStyle = G(al * o.fill); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] - dy) : g.moveTo(p[0], p[1] - dy))); g.closePath(); g.fill(); };
    poly([lerp(P, Lc, GAP), Lc, F, lerp(P, F, GAP)], 0.30, 0); poly([lerp(P, F, GAP), F, R, lerp(P, R, GAP)], 0.11, 0); poly([P, lerp(P, Lc, CAP), lerp(P, F, CAP)], 0.75, lift); poly([P, lerp(P, F, CAP), lerp(P, R, CAP)], 0.42, lift); }
  g.lineWidth = 0.75; const N = Math.round(58 * K);
  face(Lc, F, GAP, 1, N, 0.50, 0, 0.060, 1.1); face(Lc, F, GAP, 1, N, 0.30, 0, 0.066, -0.9);   // lit face
  face(F, R, GAP, 1, N, 0.22, 0, 0.060, 0.8); face(F, R, GAP, 1, Math.round(N * 0.75), 0.13, 0, 0.066, -0.7);   // shaded face
  // capstone: denser, brighter, lifted
  g.lineWidth = 0.9; const NC = Math.round(16 * K);
  face(Lc, F, 0.004, CAP, NC, 0.95, lift, 0.05, 1.4); face(F, R, 0.004, CAP, NC, 0.55, lift, 0.05, -1.2);
  g.globalCompositeOperation = 'source-over';
  // edges
  const line = (pts, style, lw) => { g.lineWidth = lw; g.strokeStyle = style; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
  const up = (p) => [p[0], p[1] - lift], e = Math.min(1, rev * 1.4);
  const bL = lerp(P, Lc, GAP), bF = lerp(P, F, GAP), bR = lerp(P, R, GAP), cL = up(lerp(P, Lc, CAP)), cF = up(lerp(P, F, CAP)), cR = up(lerp(P, R, CAP));
  line([bL, Lc, F, R, bR], G(0.55 * e), 1); line([bF, F], G(0.6 * e), 1); line([bL, bF, bR], G(0.5 * e), 1);
  line([cL, up(P), cR, cF, cL], L2(0.9 * e), 1.2); line([up(P), cF], L2(0.9 * e), 1.2);
  // the rebase clock: a bright line that climbs the left edge, crosses the capstone and comes down the right
  if (o.progress > 0) { const path = [Lc, bL, cL, up(P), cR, bR, R, F, Lc]; let tot = 0; const d = []; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); d.push(l); tot += l; }
    let left = tot * Math.min(1, o.progress); g.lineWidth = Math.max(2, S * 0.008); g.strokeStyle = 'rgba(230,255,233,' + A + ')'; g.shadowColor = '#00c805'; g.shadowBlur = 18; g.lineJoin = 'round'; g.beginPath(); g.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length && left > 0; i++) { const f = Math.min(1, left / d[i - 1]), q = lerp(path[i - 1], path[i], f); g.lineTo(q[0], q[1]); left -= d[i - 1]; } g.stroke(); g.shadowBlur = 0; }
  // microprint along the two base edges
  if (o.text) { const s = o.text, size = Math.max(8, S * 0.03); g.font = '400 ' + size + 'px "DM Mono",monospace'; g.fillStyle = L2(0.6 * e); g.textAlign = 'center'; g.textBaseline = 'middle';
    const adv = size * 0.95, off = Math.floor(t * 1.2), run = (p, q, start) => { const len = Math.hypot(q[0] - p[0], q[1] - p[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]), n = Math.floor(len / adv);
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; g.save(); g.translate(p[0] + (q[0] - p[0]) * u - Math.sin(ang) * size * 1.5, p[1] + (q[1] - p[1]) * u + Math.cos(ang) * size * 1.5); g.rotate(ang); g.fillText(s[(start + i + off) % s.length], 0, 0); g.restore(); } return n; };
    const n1 = run(Lc, F, 0); run(F, R, n1); }
  // dark well so the wordmark reads
  if (o.well) { const wy = cy + S * 0.22, wr = S * 0.74, w = g.createRadialGradient(cx, wy, 0, cx, wy, wr); w.addColorStop(0, 'rgba(3,6,4,' + (0.86 * o.well) + ')'); w.addColorStop(0.6, 'rgba(3,6,4,' + (0.5 * o.well) + ')'); w.addColorStop(1, 'rgba(3,6,4,0)'); g.fillStyle = w; g.beginPath(); g.arc(cx, wy, wr, 0, Math.PI * 2); g.fill(); }
};
window.gizaPyramid = function (cv) {
  const g = cv.getContext('2d'); let W = 0, H = 0, S = 0, cx = 0, cy = 0;
  const small = () => Math.min(innerWidth, innerHeight) < 700;
  const dpr = () => Math.min(small() ? 1.5 : 2, devicePixelRatio || 1);
  const state = { progress: 0, text: 'GIZA · THE (3,3) RESERVE OF ROBINHOOD CHAIN · STAKE · BOND · COMPOUND · ' };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx = 0, tx = 0, visible = true;
  function fit() { const d = dpr(); W = cv.offsetWidth; H = cv.offsetHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    S = Math.min(H * 0.41, W * 0.31); if (W < 700) S = Math.min(H * 0.40, W * 0.36); cx = W / 2; cy = H * 0.50; }
  fit(); addEventListener('resize', fit);
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - 0.5; });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);
  const t0 = performance.now();
  function draw(now) {
    if (!still) requestAnimationFrame(draw); if (!visible && !still) return;
    const t = (now - t0) / 1000; mx += (tx - mx) * 0.04;
    g.clearRect(0, 0, W, H);
    window.pyramidDraw(g, { cx, cy, S, t, mx, k: small() ? 0.6 : 1, progress: state.progress, text: state.text, well: 1 });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => still && draw(performance.now()));
  draw(performance.now());
  return { set(o) { Object.assign(state, o); } };
};
