// GIZA (3,3) app on Robinhood Chain — metrics, live rebase, stake, bond (real ETH / USDG payments), claim.
(function () {
  const $ = (id) => document.getElementById(id);
  let M = null, A = null, CFG = null, chainBal = null, wallet = (localStorage.getItem('giza_w') || '').toLowerCase();
  let anchor = null, stakeMode = 'stake';
  const isW = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || '');
  const isSig = (s) => /^0x[0-9a-fA-F]{64}$/.test(s || '');
  const commas = (n, d) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const money = (n) => '$' + (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(2));
  const tok = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? commas(n, 0) : commas(n, 2);
  const pct = (n) => (n * 100).toLocaleString('en-US', { maximumFractionDigits: n < 0.01 ? 3 : 2 }) + '%';
  const apyFmt = (n) => commas(n, 0) + '%';
  const px = (p) => '$' + (p >= 0.01 ? p.toFixed(4) : p >= 0.0001 ? p.toFixed(6) : p.toFixed(9));
  const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
  function toast(t, err) { const e = $('toast'); e.textContent = t; e.className = 'toast show' + (err ? ' err' : ''); clearTimeout(e._t); e._t = setTimeout(() => (e.className = 'toast'), 3600); }
  const errText = (e) => { const m = (e && (e.message || (e.error && e.error.message))) || String(e || ''); if ((e && e.code === 4001) || /reject|denied|cancel/i.test(m)) return 'request rejected in your wallet'; return m.slice(0, 140) || 'wallet error'; };

  // ---- views ----
  const VIEWS = ['dash', 'stake', 'bond', 'calc'];
  function show(v) { document.querySelectorAll('.tab[data-view]').forEach((x) => x.classList.toggle('on', x.dataset.view === v)); VIEWS.forEach((s) => $(s).classList.toggle('hide', s !== v)); if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v); }
  document.querySelectorAll('[data-view]').forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); show(t.dataset.view); }));
  if (VIEWS.includes(location.hash.slice(1))) show(location.hash.slice(1));
  addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v)) show(v); });

  // ---- wallet: EVM wallets on Robinhood Chain (EIP-6963 discovery). Rabby is listed first: it prices Robinhood Chain gas correctly. ----
  const WALLETS = new Map(); let chosen = null;
  const isPhantom = (p, info) => !!(p && (p.isPhantom || (info && /phantom/i.test(info.name + ' ' + info.rdns))));
  window.addEventListener('eip6963:announceProvider', (e) => { const { info, provider } = e.detail || {}; if (info && provider && !isPhantom(provider, info)) WALLETS.set(info.uuid, { info, provider }); });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function legacy() { const w = window.ethereum; if (!w) return []; const list = (w.providers && w.providers.length ? w.providers : [w]).filter((p) => !isPhantom(p));
    return list.map((p) => ({ info: { name: p.isRabby ? 'Rabby' : p.isMetaMask ? 'MetaMask' : 'Browser wallet', rdns: p.isRabby ? 'io.rabby' : p.isMetaMask ? 'io.metamask' : 'legacy', icon: '' }, provider: p })); }
  const rank = (w) => (/rabby/i.test(w.info.rdns + w.info.name) ? 0 : /metamask/i.test(w.info.rdns + w.info.name) ? 1 : 2);
  function wallets() { const all = WALLETS.size ? [...WALLETS.values()] : legacy(); return all.sort((a, b) => rank(a) - rank(b)); }
  const RABBY_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7084ff"/><path d="M8 19c0-5 4-9 10-9 4 0 6 2 6 4 0 3-4 3-8 3h-2c2 2 5 3 8 2-1 3-4 5-8 5-4 0-6-2-6-5z" fill="#fff"/></svg>');
  const MM_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#f6851b"/><path d="M7 8l8 6-1.5-3.6zM25 8l-8 6 1.5-3.6zM9 20l2 4 4-1zM23 20l-2 4-4-1zM11 15l5 2 5-2-1 4h-8z" fill="#fff"/></svg>');
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  function menu() { const ws = wallets(), out = [];
    const has = (re) => ws.find((w) => re.test(w.info.rdns + ' ' + w.info.name));
    const r = has(/rabby/i), m = has(/metamask/i);
    out.push(r ? { ...r, info: { ...r.info, icon: r.info.icon || RABBY_ICON } } : { info: { name: 'Rabby', icon: RABBY_ICON }, install: 'https://rabby.io' });
    out.push(m ? { ...m, info: { ...m.info, icon: m.info.icon || MM_ICON } } : { info: { name: 'MetaMask', icon: MM_ICON }, install: mobile ? 'https://metamask.app.link/dapp/' + location.host + location.pathname : 'https://metamask.io/download/' });
    for (const w of ws) if (w !== r && w !== m) out.push(w); return out; }
  function pick() { return new Promise((res) => { const ws = menu();
    const m = document.createElement('div'); m.className = 'wpick';
    m.innerHTML = '<div class="wbox2"><div class="pt">Connect a wallet</div><div class="psub">GIZA runs on Robinhood Chain. Your wallet signs you in and sends your stake and bond payments. Rabby works best on this chain.</div>' +
      ws.map((w, i) => '<button class="wopt" data-i="' + i + '"><img class="wi" src="' + w.info.icon + '" alt="">' + w.info.name + (w.install ? '<span class="inst">' + (mobile && /MetaMask/.test(w.info.name) ? 'open app' : 'install') + ' ↗</span>' : '<span class="inst ok">detected</span>') + '</button>').join('') + '<button class="cx">Close</button></div>';
    document.body.appendChild(m); m.onclick = (e) => { const bt = e.target.closest('button'); if (!bt && e.target !== m) return; m.remove(); const w = bt && bt.dataset.i != null ? ws[+bt.dataset.i] : null;
      if (w && w.install) { window.open(w.install, '_blank', 'noopener'); return res(null); } res(w); }; }); }
  function renderWallet() { const b = $('connectBtn'); if (wallet) { b.textContent = short(wallet); b.classList.add('connected'); b.title = 'Disconnect'; } else { b.textContent = 'Connect'; b.classList.remove('connected'); b.title = ''; } }
  function setWallet(a) {
    a = String(a || '').toLowerCase();
    if (a && isW(a)) { wallet = a; localStorage.setItem('giza_w', a); renderWallet(); loadAccount(); loadChainBalance(); }
    else { wallet = ''; A = null; chainBal = null; localStorage.removeItem('giza_w'); renderWallet(); ['yStaked', 'yBalance', 'yNext'].forEach((id) => ($(id).textContent = '—')); renderYourBonds(); }
  }
  // signed session: one free message signature proves the wallet is yours. Unstake and claim need it.
  const AKEY = () => 'giza_auth_' + wallet;
  function getAuth() { try { const x = JSON.parse(localStorage.getItem(AKEY()) || 'null'); return x && x.exp > Date.now() + 6e4 ? x : null; } catch (e) { return null; } }
  const hexUtf8 = (s) => '0x' + Array.from(new TextEncoder().encode(s)).map((b) => b.toString(16).padStart(2, '0')).join('');
  async function signIn() {
    if (!wallet) return null; const have = getAuth(); if (have) return have;
    if (!chosen) { toast('reconnect your wallet to sign in', true); return null; }
    try { const m = await (await fetch('/api/session?wallet=' + wallet)).json(); if (m.error) throw new Error(m.error);
      toast('Sign the message in your wallet — free, moves no funds');
      const sig = await chosen.request({ method: 'personal_sign', params: [hexUtf8(m.message), wallet] });
      const auth = { exp: m.exp, sig }; localStorage.setItem(AKEY(), JSON.stringify(auth)); return auth;
    } catch (e) { toast(errText(e), true); return null; }
  }
  async function connect() {
    await new Promise((r) => setTimeout(r, 60)); const w = await pick(); if (!w) return false; chosen = w.provider;
    try { const acc = await chosen.request({ method: 'eth_requestAccounts' }); if (!acc || !isW(acc[0])) throw new Error('wallet returned no address');
      setWallet(acc[0]); toast('Connected ' + w.info.name + ' · ' + short(wallet)); if (chosen.on) chosen.on('accountsChanged', (a) => setWallet(a && a[0]));
      ensureChain().catch(() => {}); await signIn(); return true;
    } catch (e) { chosen = null; toast(errText(e), true); return false; }
  }
  $('connectBtn').onclick = async () => {
    if (wallet) { localStorage.removeItem(AKEY()); setWallet(''); chosen = null; toast('Wallet disconnected'); return; }
    await connect();
  };
  // restore a remembered wallet silently (eth_accounts never prompts) and follow account switches
  setTimeout(async () => { if (!wallet) return; for (const w of wallets()) { try { const a = await w.provider.request({ method: 'eth_accounts' });
    if (a && a.map((x) => x.toLowerCase()).includes(wallet)) { chosen = w.provider; if (chosen.on) chosen.on('accountsChanged', (acc) => setWallet(acc && acc[0])); return; } } catch (e) {} } }, 400);
  renderWallet();

  // ---- payments: a plain ETH transfer or an ERC-20 transfer to the treasury, signed and sent by the wallet ----
  const units = (amt, dec) => { const [i, f = ''] = String(amt).trim().split('.'); return BigInt(i || '0') * 10n ** BigInt(dec) + BigInt((f + '0'.repeat(dec)).slice(0, dec) || '0'); };
  const transferData = (to, amount) => '0xa9059cbb' + to.slice(2).toLowerCase().padStart(64, '0') + amount.toString(16).padStart(64, '0');
  // every payment goes out on Robinhood Chain: switch (or add) the network first
  async function ensureChain() {
    if (!chosen) throw new Error('reconnect your wallet to continue');
    if (!CFG) await loadConfig(); const idHex = '0x' + (+CFG.chainId).toString(16);
    const cur = await chosen.request({ method: 'eth_chainId' }); if (String(cur).toLowerCase() === idHex) return;
    try { await chosen.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: idHex }] }); }
    catch (e) { try { await chosen.request({ method: 'wallet_addEthereumChain', params: [{ chainId: idHex, chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [CFG.rpc], blockExplorerUrls: [CFG.explorer] }] }); }
      catch (e2) { throw new Error('switch your wallet to Robinhood Chain (chain ' + CFG.chainId + ') to continue'); } }
  }
  async function pay(kind, market, raw) {
    if (!chosen) throw new Error('reconnect your wallet to send this payment');
    const I = await post('/api/intent', { wallet, kind, market }); if (I.error) throw new Error(I.error);
    if (parseFloat(raw) > I.balance) throw new Error('this wallet holds ' + tok(I.balance) + ' — not enough for that amount');
    await ensureChain();
    const tx = I.native ? { from: wallet, to: I.treasury, value: '0x' + units(raw, 18).toString(16) } : { from: wallet, to: I.token, data: transferData(I.treasury, units(raw, I.decimals)) };
    return await chosen.request({ method: 'eth_sendTransaction', params: [tx] });
  }
  // the server reads the mined transaction from Robinhood Chain; keep asking until it is there
  async function credit(url, payload, what) {
    toast(what + ' sent — waiting for Robinhood Chain to confirm…');
    for (let i = 0; i < 30; i++) { await new Promise((z) => setTimeout(z, 2500)); const r = await post(url, payload); if (!r.error) return r; if (!/not found|try again/.test(r.error)) throw new Error(r.error); }
    throw new Error(what + ' still confirming — paste its transaction hash under “Credit by transaction” in a minute');
  }

  // ---- fetch ----
  async function post(url, b) { try { return await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json(); } catch (e) { return { error: 'request failed' }; } }
  async function loadConfig() { try { CFG = await (await fetch('/api/config')).json(); renderStatic(); } catch (e) {} }
  async function loadMetrics() { try { M = await (await fetch('/api/metrics')).json(); reanchor(); renderMetrics(); renderBonds(); } catch (e) {} }
  async function loadChainBalance() { if (!isW(wallet)) { chainBal = null; return; } try { const r = await post('/api/balance', { wallet }); chainBal = r.error ? null : r.balance; } catch (e) { chainBal = null; } renderAccount(); }
  async function loadAccount() { if (!isW(wallet)) return; try { const r = await post('/api/account', { wallet }); if (r.error) return; A = r; reanchor(); renderAccount(); renderYourBonds(); } catch (e) {} }
  function reanchor() { if (!M) return; anchor = { index: M.index, nextIn: M.nextRebaseIn, rate: M.rate, rebaseSec: M.rebaseSec, t: Date.now(), agons: A && A.staked ? A.staked / A.index : 0, totalStaked: M.totalStaked, price: M.price }; }
  function liveIndex() { if (!anchor) return { index: 1, nextIn: 0 }; let idx = anchor.index, nextIn = anchor.nextIn - (Date.now() - anchor.t) / 1000, g = 0;
    while (nextIn < 0 && g++ < 50) { idx *= 1 + anchor.rate; nextIn += anchor.rebaseSec; } return { index: idx * (1 + anchor.rate * (1 - nextIn / anchor.rebaseSec)), nextIn }; }

  // ---- render ----
  let boostLeft = 0, boostEnd = 0, lockUntil = 0;
  function renderStatic() { if (!CFG) return;
    document.querySelectorAll('[data-x]').forEach((el) => (el.href = CFG.xUrl)); }
  function renderMetrics() {
    if (!M) return;
    $('mApy').textContent = apyFmt(M.apy);
    const note = $('mApyNote'), card = $('mApy').closest('.stat');
    if (M.boost) { boostEnd = Date.now() + M.boost.secondsLeft * 1000; boostLeft = M.boost.secondsLeft; card && card.classList.add('boosting'); note.innerHTML = 'APY boost · <span id="boostCd" class="cd"></span> left'; }
    else { boostLeft = 0; card && card.classList.remove('boosting'); note.textContent = 'compounding every ' + Math.round(M.rebaseSec / 60) + ' min'; }
    $('mTreasury').textContent = money(M.treasury);
    const T = M.treasuryOnchain || {}; $('mBacking').textContent = T.live ? (T.eth || 0).toFixed(3) + ' ETH · ' + commas(T.usdg || 0, 0) + ' USDG on-chain' : 'fills with the first bond';
    $('mPrice').textContent = px(M.price); $('mMc').textContent = (M.mint ? 'mcap ' : 'opening price · mcap ') + money(M.marketCap);
    $('mRatio').textContent = pct(M.stakingRatio) + ' of supply';
    $('mRunway').textContent = M.runwayDays == null ? '—' : M.runwayDays >= 365 ? (M.runwayDays / 365).toFixed(1) + ' yr' : M.runwayDays >= 1 ? Math.round(M.runwayDays) + ' days' : (M.runwayDays * 24).toFixed(1) + ' h';
    $('mEpoch').textContent = M.epoch; $('mEth').textContent = T.ethUsd ? '$' + commas(T.ethUsd, 2) : '—';
    $('yApy').textContent = apyFmt(M.apy);
    const roi = (d) => Math.pow(1 + M.rate, (d * 86400) / M.rebaseSec) - 1;
    $('yRoi5').textContent = pct(roi(5)); $('yRoi7').textContent = pct(roi(7)); $('yRoi30').textContent = pct(roi(30)); $('yRoi1y').textContent = apyFmt(M.apy);
    if (M.leaderboard && M.leaderboard.length) { $('lbPanel').style.display = 'block'; $('lbRows').innerHTML = M.leaderboard.map((b, i) => `<div class="row"><span><span class="rk">${i + 1}</span> <b class="mono">${b.wallet}</b></span><span><b class="tl">${tok(b.staked)} sGIZA</b> <span class="mut">· ${pct(b.share)}</span></span></div>`).join(''); }
    $('stBar').style.width = Math.min(100, M.stakingRatio * 100).toFixed(2) + '%'; $('stRatioLbl').textContent = pct(M.stakingRatio) + ' staked';
    if (M.tape && M.tape.length) { const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000); return s < 60 ? Math.floor(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
      const lab = { stake: ['STAKE', 'up'], unstake: ['UNSTAKE', 'dn'], bond: ['BOND', 'ac'] };
      $('stRows').innerHTML = M.tape.map((e) => { const [l, c] = lab[e.type] || [e.type, '']; const who = `<span class="mono">${e.w}</span>`; return `<div class="trow"><span class="side ${c}">${l}</span>${who}<span class="mono r">${tok(e.amount)} GIZA</span><span class="mut r">${ago(e.t)}</span></div>`; }).join(''); }
    calc();
    if (M.mint && (!CFG || CFG.mint !== M.mint)) loadConfig().then(() => { if (wallet) loadChainBalance(); });   // launch went live: pick up the mint without a reload
    const bar = $('ca'); if (M.mint) { bar.classList.remove('pre'); $('caV').textContent = M.mint; $('caCopy').style.display = ''; bar.href = ((CFG && CFG.explorer) || '') + '/token/' + M.mint; bar.target = '_blank'; bar.rel = 'noopener'; }
    else { bar.classList.add('pre'); $('caV').textContent = 'launching on Robinhood Chain · contract address appears here'; $('caCopy').style.display = 'none'; bar.href = '#bond'; bar.removeAttribute('target'); }
    const pre = $('preStake'); pre.style.display = M.mint ? 'none' : '';
    if (M.paused) { pre.style.display = ''; pre.innerHTML = '<b>Deposits are paused.</b> Do not send GIZA, ETH or USDG to the treasury until this notice clears.'; }
    $('stakeBtn').disabled = !!M.paused && stakeMode === 'stake'; document.querySelectorAll('[data-bond]').forEach((b) => (b.disabled = !!M.paused || !M.bondsOpen));
    $('bondClosed').style.display = M.bondsOpen ? 'none' : '';
  }
  $('caCopy').onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (!M || !M.mint) return; navigator.clipboard && navigator.clipboard.writeText(M.mint); $('caCopy').textContent = 'Copied'; setTimeout(() => ($('caCopy').textContent = 'Copy'), 1200); };
  $('ca').addEventListener('click', (e) => { if (!M || !M.mint) { e.preventDefault(); show('bond'); } });
  function renderAccount() { if (!A || !M) return; $('yBalance').textContent = M.mint ? (chainBal == null ? '—' : tok(chainBal) + ' GIZA') : 'opens at launch'; $('yNext').textContent = '+' + (A.staked * M.rate).toFixed(4) + ' sGIZA'; updateLockUI();
    if (A.pendingOut > 0) toastOnce('Payout of ' + tok(A.pendingOut) + ' GIZA queued from the treasury'); }
  let _t = ''; const toastOnce = (m) => { if (_t !== m) { _t = m; toast(m); } };
  const fmtDur = (s) => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), ss = s % 60; return m > 0 ? m + 'm ' + String(ss).padStart(2, '0') + 's' : ss + 's'; };
  function updateLockUI() { if (A && A.lockRemaining != null) lockUntil = A.lockRemaining > 0 ? Date.now() + A.lockRemaining * 1000 : 0; const left = lockUntil ? (lockUntil - Date.now()) / 1000 : 0;
    $('yLockRow').style.display = left > 0 ? 'flex' : 'none'; if (left > 0) $('yLock').textContent = fmtDur(left);
    if (stakeMode === 'unstake') { const b = $('stakeBtn'); b.disabled = left > 0; b.textContent = left > 0 ? 'Locked · ' + fmtDur(left) : 'Unstake'; } }
  let bondDrawn = '';
  const GLYPH = { eth: 'Ξ', usdg: '$' };
  function renderBonds() {
    if (!M) return; const key = M.bonds.map((b) => b.id + b.price + b.assetUsd).join('|') + M.bondsOpen + M.paused; if (key === bondDrawn) return; bondDrawn = key;
    const typed = {}; M.bonds.forEach((b) => { const el = $('bondAmt_' + b.id); if (el) typed[b.id] = el.value; });
    $('bondCards').innerHTML = M.bonds.map((b) => `
      <div class="bond"><div class="bh"><span class="asset ${b.id}">${GLYPH[b.id] || b.name[0]}</span><div><h3>${b.name}</h3><div class="dl">${b.vestDays}-day linear vest · min ${b.min} ${b.name}</div></div><div class="disc">−${(b.discount * 100).toFixed(1)}%</div></div>
        <div class="br"><span>Bond price</span><b class="mono">${px(b.price)}</b></div>
        <div class="br"><span>Market price</span><b class="mono">${px(M.price)}</b></div>
        <div class="br"><span>${b.name} price</span><b class="mono">$${b.assetUsd ? b.assetUsd.toFixed(2) : '—'}</b></div>
        <div class="br"><span>You receive</span><b class="mono tl" id="bondOut_${b.id}">—</b></div>
        <div class="bf"><input id="bondAmt_${b.id}" type="text" inputmode="decimal" placeholder="${b.name} amount" value="${typed[b.id] || ''}"><button data-bond="${b.id}"${M.paused || !M.bondsOpen ? ' disabled' : ''}>Bond</button></div>
      </div>`).join('');
    M.bonds.forEach((b) => { const el = $('bondAmt_' + b.id), out = () => { const v = parseFloat(el.value) || 0; $('bondOut_' + b.id).textContent = v > 0 && b.price > 0 ? tok((v * b.assetUsd) / b.price) + ' GIZA' : '—'; }; el.addEventListener('input', out); out(); });
    $('bondCards').querySelectorAll('[data-bond]').forEach((btn) => btn.addEventListener('click', () => doBond(btn.dataset.bond)));
  }
  function renderYourBonds() {
    if (!A) { $('yourBonds').innerHTML = '<div class="psub">Connect your wallet to see your bonds.</div>'; return; }
    if (!A.bonds || !A.bonds.length) { $('yourBonds').innerHTML = '<div class="psub">No active bonds yet. Every bond is a real ETH or USDG payment to the treasury, verified on Robinhood Chain.</div>'; return; }
    $('yourBonds').innerHTML = A.bonds.map((b) => `<div class="yb"><span>${b.market} · <b class="mono">${tok(b.payout)}</b> GIZA</span><div class="prog"><i style="width:${(b.pct * 100).toFixed(0)}%"></i></div><span class="tl mono"><b>${tok(b.claimable)}</b> claimable</span></div>`).join('') +
      '<div class="brow"><button class="btn ghost" id="claimBtn">Claim to wallet</button><button class="btn primary" id="claimStakeBtn">Claim &amp; stake</button></div>';
    $('claimBtn').onclick = () => doClaim(false); $('claimStakeBtn').onclick = () => doClaim(true);
  }

  // ---- actions ----
  $('segStake').onclick = () => { stakeMode = 'stake'; $('segStake').classList.add('on'); $('segUnstake').classList.remove('on'); $('stakeBtn').disabled = !!(M && M.paused); $('stakeBtn').textContent = 'Stake'; };
  $('segUnstake').onclick = () => { stakeMode = 'unstake'; $('segUnstake').classList.add('on'); $('segStake').classList.remove('on'); $('stakeBtn').disabled = false; $('stakeBtn').textContent = 'Unstake'; updateLockUI(); };
  $('stakeMax').onclick = () => { $('stakeAmt').value = (stakeMode === 'stake' ? chainBal || 0 : A ? A.staked : 0).toFixed(2); };
  async function needWallet() { if (isW(wallet) && chosen) return true; return await connect(); }
  $('stakeBtn').onclick = async () => {
    if (!(await needWallet())) return;
    const raw = $('stakeAmt').value, amt = parseFloat(raw); if (!(amt > 0)) return toast('enter an amount', true);
    try {
      if (stakeMode === 'stake') {
        if (M && M.paused) return toast('deposits are paused', true);
        if (!CFG || !CFG.mint) return toast('staking opens the moment $GIZA launches — bond now to get GIZA at a discount', true);
        if (CFG.minStake && amt < CFG.minStake) return toast('minimum stake is ' + tok(CFG.minStake) + ' GIZA', true);
        const tx = await pay('stake', null, raw); const r = await credit('/api/stake', { wallet, tx }, 'Deposit');
        A = r; reanchor(); renderAccount(); loadChainBalance(); loadMetrics(); $('stakeAmt').value = ''; toast('Staked ' + tok(r.credited) + ' GIZA · (3,3)');
      } else { const auth = await signIn(); if (!auth) return; const r = await post('/api/unstake', { wallet, amount: amt, auth }); if (r.error) { if (r.auth) localStorage.removeItem(AKEY()); return toast(r.error, true); } A = r; reanchor(); renderAccount(); loadMetrics(); $('stakeAmt').value = ''; toast('Unstaked — ' + tok(r.queued) + ' GIZA queued for payout'); }
    } catch (e) { toast(errText(e), true); }
  };
  async function doBond(id) {
    if (M && M.paused) return toast('bonds are paused', true);
    if (!(await needWallet())) return;
    const m = M.bonds.find((b) => b.id === id), raw = ($('bondAmt_' + id) || {}).value || '', amt = parseFloat(raw);
    if (!(amt > 0)) return toast('enter an amount', true); if (amt < m.min) return toast('minimum bond is ' + m.min + ' ' + m.name, true);
    try {
      const tx = await pay('bond', id, raw); const r = await credit('/api/bond', { wallet, market: id, tx }, 'Payment');
      A = r; renderYourBonds(); loadMetrics(); $('bondAmt_' + id).value = ''; toast('Bonded ' + r.paid + ' ' + m.name + ' → ' + tok(r.payout) + ' GIZA vesting');
    } catch (e) { toast(errText(e), true); }
  }
  async function doClaim(autostake) { const auth = await signIn(); if (!auth) return; const r = await post('/api/claim', { wallet, autostake, auth }); if (r.error) { if (r.auth) localStorage.removeItem(AKEY()); return toast(r.error, true); } A = r; reanchor(); renderAccount(); renderYourBonds(); loadMetrics(); toast(autostake ? 'Claimed & staked ' + tok(r.claimed) + ' sGIZA' : 'Claimed ' + tok(r.claimed) + ' GIZA — queued to your wallet'); }
  // a payment that confirmed after the tab was closed can still be credited: the transaction hash is all the server needs
  $('sigBtn').onclick = async () => {
    if (!(await needWallet())) return; const tx = $('sigIn').value.trim(), kind = $('sigKind').value; if (!isSig(tx)) return toast('paste a transaction hash (0x…)', true);
    const r = kind === 'stake' ? await post('/api/stake', { wallet, tx }) : await post('/api/bond', { wallet, market: kind, tx }); if (r.error) return toast(r.error, true);
    A = r; reanchor(); renderAccount(); renderYourBonds(); loadMetrics(); $('sigIn').value = ''; toast(kind === 'stake' ? 'Staked ' + tok(r.credited) + ' GIZA' : 'Bond credited → ' + tok(r.payout) + ' GIZA vesting');
  };

  // ---- live tick ----
  function tick() {
    if (!anchor || !M) return; const li = liveIndex(), cd = Math.max(0, li.nextIn), cds = Math.floor(cd / 60) + ':' + String(Math.floor(cd % 60)).padStart(2, '0');
    $('mRebase').textContent = cds; $('yRebase').textContent = cds; $('mIndex').textContent = li.index.toFixed(5);
    $('mStaked').textContent = tok(anchor.totalStaked * (li.index / anchor.index)) + ' sGIZA';
    if (A) $('yStaked').textContent = commas(anchor.agons * li.index, 4) + ' sGIZA';
    const ring = $('ring'); if (ring) ring.style.setProperty('--p', (1 - cd / M.rebaseSec) * 360 + 'deg');
    if (lockUntil) updateLockUI();
    if (boostLeft > 0) { boostLeft = (boostEnd - Date.now()) / 1000; const b = $('boostCd'); if (b) { const s = Math.max(0, boostLeft); b.textContent = Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0'); } }
  }
  function calc() { if (!M) return; const amt = parseFloat($('calcAmt').value) || 0, days = +$('calcDays').value; $('calcDaysL').textContent = days; $('calcPrice').textContent = px(M.price).slice(1);
    const out = amt * Math.pow(1 + M.rate, (days * 86400) / M.rebaseSec); $('calcOut').textContent = tok(out) + ' GIZA'; $('calcMult').textContent = (out / (amt || 1)).toFixed(1) + '× your stake'; $('calcUsd').textContent = money(out * M.price); $('calcProfit').textContent = '+' + money((out - amt) * M.price); }
  $('calcAmt').addEventListener('input', calc); $('calcDays').addEventListener('input', calc);
  loadConfig().then(() => { if (wallet) loadChainBalance(); }); loadMetrics(); if (wallet) loadAccount();
  setInterval(loadMetrics, 6000); setInterval(() => { if (wallet) loadAccount(); }, 8000); renderYourBonds(); setInterval(tick, 100); tick();
})();
