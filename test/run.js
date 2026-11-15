// GIZA tests: boots the server on a scratch data file, then checks the HTTP API, the signed-session check
// (secp256k1 personal_sign), the wallet-side transfer encoding and payment verification against real
// Robinhood Chain mainnet transactions.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { signPersonal, pubToAddress, mul, G } = require('../server/evmsig');
const TREASURY = '0x00000000000000000000000000000000c0ffee01'; // any address works for reads; nothing is ever sent
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const tmp = path.join(os.tmpdir(), 'giza-test-' + Date.now() + '.json');
Object.assign(process.env, { PORT: '8393', DATA_PATH: tmp, TREASURY_WALLET: TREASURY, ADMIN_KEY: 'k', ETH_USD: '3000', REBASE_SEC: '300', GIZA_MINT: '' });
const S = require('../server/index.js');
const B = 'http://127.0.0.1:8393';
let pass = 0, fail = 0, skip = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const skipT = (name, why) => { skip++; console.log('SKIP', name, '·', why); };
const get = (u) => fetch(B + u).then((r) => r.json());
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const rpc = async (method, params) => { const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; };
// pull the wallet-side helpers straight out of the shipped client so the test exercises the real code
const src = fs.readFileSync(path.join(__dirname, '../client/src/app.js'), 'utf8');
const line = (re) => { const m = src.match(re); if (!m) throw new Error('missing ' + re); return m[0]; };
const C = new Function([line(/const units = .*\n/), line(/const transferData = .*\n/), line(/const hexUtf8 = .*\n/), 'return { units, transferData, hexUtf8 };'].join(''))();
const newWallet = () => { const priv = BigInt('0x' + crypto.randomBytes(32).toString('hex')); return { priv, addr: pubToAddress(mul(G, priv)).toLowerCase() }; };
const SOL = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', H = (c) => '0x' + c.repeat(64);

(async () => {
  S.start(); await new Promise((r) => setTimeout(r, 400));
  // ---- pages ----
  for (const p of ['/', '/app', '/docs']) { const t = await (await fetch(B + p)).text(); ok('page ' + p + ' serves with no template tokens left', t.includes('GIZA') && !/\{\{[A-Z_]+\}\}/.test(t));
    ok('page ' + p + ' has no text from another chain', !/sohm|stohm|solana|phantom|pump\.fun|usdc|usdt|elysium|hyperliquid/i.test(t), (t.match(/sohm|stohm|solana|phantom|pump\.fun|usdc|usdt|elysium|hyperliquid/i) || [])[0]); }
  ok('path traversal blocked', (await fetch(B + '/client/..%2fserver/index.js')).status !== 200);
  // ---- config + metrics ----
  const cfg = await get('/api/config'); ok('config: Robinhood Chain 4663, tickers, bonds open', cfg.network === 'robinhood-chain' && cfg.chainId === 4663 && cfg.token === 'GIZA' && cfg.staked === 'sGIZA' && cfg.bondsOpen === true && cfg.usdg === USDG, cfg);
  // the treasury address must not appear on any page or public endpoint; only /api/intent hands it to a paying wallet
  for (const u of ['/', '/app', '/docs', '/api/config', '/api/metrics', '/api/health', '/client/src/app.js', '/client/giza.css']) ok('treasury address absent from ' + u, !(await (await fetch(B + u)).text()).toLowerCase().includes(TREASURY));
  ok('payout export stays behind the admin key', (await fetch(B + '/api/withdrawals')).status === 403);
  const m = await get('/api/metrics'); ok('metrics: two bond markets ETH/USDG', m.bonds.map((b) => b.id).join() === 'eth,usdg', m.bonds);
  ok('metrics: price > 0 before launch (opening price)', m.price > 0 && !m.mint, m.price);
  ok('metrics: bond price = price x (1 - discount)', m.bonds.every((b) => Math.abs(b.price - m.price * (1 - b.discount)) < 1e-15));
  ok('metrics: nothing staked means runway null', m.totalStaked === 0 && m.runwayDays === null);
  // ---- validation ----
  const W = newWallet(), wallet = W.addr;
  ok('address check: 0x addresses only', S.isWallet(wallet) && !S.isWallet(SOL) && !S.isWallet('0x123'));
  ok('account rejects a non-EVM address', !!(await post('/api/account', { wallet: SOL })).error);
  const a0 = await post('/api/account', { wallet }); ok('fresh account is empty', a0.staked === 0 && a0.bonds.length === 0, a0);
  const aUp = await post('/api/account', { wallet: '0x' + wallet.slice(2).toUpperCase() }); ok('checksummed and lower-case addresses are the same account', aUp.wallet === wallet, aUp.wallet);
  ok('stake refused before launch', /launches/.test((await post('/api/stake', { wallet, tx: H('1') })).error || ''));
  ok('bond refuses a missing transaction hash', /transaction/.test((await post('/api/bond', { wallet, market: 'eth', tx: 'nope' })).error || ''));
  ok('bond refuses an unknown market', /market/.test((await post('/api/bond', { wallet, market: 'sol', tx: H('2') })).error || ''));
  // ---- signed sessions ----
  ok('unstake without a session is refused', (await post('/api/unstake', { wallet, amount: 1 })).auth === true);
  const sm = await get('/api/session?wallet=' + wallet); const sig = signPersonal(sm.message, W.priv);
  const good = await post('/api/unstake', { wallet, amount: 1, auth: { exp: sm.exp, sig } }); ok('valid wallet signature is accepted (reaches the balance check)', good.error === 'nothing staked', good);
  const w2 = newWallet().addr;
  const bad = await post('/api/unstake', { wallet: w2, amount: 1, auth: { exp: sm.exp, sig } }); ok('signature from another wallet is rejected', bad.auth === true && /signature/.test(bad.error), bad);
  const stale = await post('/api/claim', { wallet, auth: { exp: Date.now() - 1000, sig } }); ok('expired session is rejected', stale.auth === true, stale);
  // ---- admin ----
  ok('admin needs the key', (await fetch(B + '/api/admin/pause?on=1')).status === 403);
  await get('/api/admin/pause?key=k&on=1'); ok('pause blocks bonds', /paused/.test((await post('/api/bond', { wallet, market: 'eth', tx: H('3') })).error || '')); await get('/api/admin/pause?key=k&on=0');
  // ---- wallet-side encoding ----
  ok('units: decimal strings to base units', C.units('1.5', 18) === 1500000000000000000n && C.units('0.000001', 6) === 1n && C.units('12', 6) === 12000000n);
  const td = C.transferData(TREASURY, C.units('5', 6)); ok('ERC-20 transfer calldata: selector, padded address, amount', td.length === 138 && td.startsWith('0xa9059cbb') && td.slice(34, 74) === TREASURY.slice(2) && BigInt('0x' + td.slice(74)) === 5000000n, td);
  ok('session message is hex-encoded for personal_sign', C.hexUtf8('GIZA') === '0x47495a41');
  // ---- live Robinhood Chain: verify real payments ----
  let head = 0; try { head = Number(BigInt(await rpc('eth_blockNumber', []))); ok('Robinhood Chain RPC answers with chain 4663', Number(BigInt(await rpc('eth_chainId', []))) === 4663); } catch (e) { skipT('live Robinhood Chain checks', 'mainnet RPC unreachable: ' + e.message); }
  if (head) {
    ok('mint switch rejects an address that is not a token', !!(await get('/api/admin/mint?key=k&mint=' + wallet)).error);
    try { // USDG is a real ERC-20 on this chain: 6 decimals
      ok('USDG contract reports 6 decimals', Number(BigInt(await rpc('eth_call', [{ to: USDG, data: '0x313ce567' }, 'latest']))) === 6);
    } catch (e) { skipT('USDG decimals', e.message); }
    try { // a real, recent, plain ETH transfer: readPayment must report exactly the value that moved
      let done = false;
      for (let b = head; b > head - 400 && !done; b--) { const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), true]); if (!blk) continue;
        const tx = (blk.transactions || []).find((t) => t.to && t.input === '0x' && BigInt(t.value) > 0n && t.from.toLowerCase() !== t.to.toLowerCase()); if (!tx) continue;
        const want = Number(BigInt(tx.value)) / 1e18, p = await S.readPayment(tx.hash, tx.from, 'native', tx.to).catch((e) => ({ err: String(e) }));
        if (p.err && /failed/.test(p.err)) continue;
        ok('readPayment: real ETH transfer credited at its on-chain value', Math.abs(p.amount - want) < 1e-9, { got: p, want });
        let threw = ''; try { await S.readPayment(tx.hash, wallet, 'native', tx.to); } catch (e) { threw = String(e); } ok('readPayment: a transaction from another wallet is refused', /not sent by your wallet/.test(threw), threw);
        threw = ''; try { await S.readPayment(tx.hash, tx.from, 'native', wallet); } catch (e) { threw = String(e); } ok('readPayment: a payment to another address is refused', /did not go to the treasury/.test(threw), threw);
        done = true; }
      if (!done) skipT('readPayment on a real ETH transfer', 'no plain ETH transfer in the last 400 blocks');
    } catch (e) { skipT('readPayment on a real ETH transfer', e.message); }
    try { // a real USDG Transfer event: credited for exactly the logged amount, to the logged receiver only
      const T = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; let lg = null;
      for (let span = 2000, to = head; to > head - 60000 && !lg; to -= span) { const logs = await rpc('eth_getLogs', [{ address: USDG, topics: [T], fromBlock: '0x' + Math.max(0, to - span).toString(16), toBlock: '0x' + to.toString(16) }]);
        lg = logs.find((l) => l.topics.length === 3 && BigInt(l.data) > 0n && l.topics[1] !== l.topics[2]) || null; }
      if (!lg) skipT('readPayment on a real USDG transfer', 'no USDG transfer in the last 60,000 blocks');
      else { const from = '0x' + lg.topics[1].slice(26), to = '0x' + lg.topics[2].slice(26), rc = await rpc('eth_getTransactionReceipt', [lg.transactionHash]);
        const want = rc.logs.filter((l) => l.address.toLowerCase() === USDG && l.topics[0] === T && l.topics[1] === lg.topics[1] && l.topics[2] === lg.topics[2]).reduce((s, l) => s + BigInt(l.data), 0n);
        const p = await S.readPayment(lg.transactionHash, from, USDG, to); ok('readPayment: real USDG transfer credited at its logged amount', Math.abs(p.amount - Number(want) / 1e6) < 1e-6, { got: p.amount, want: Number(want) / 1e6 });
        const wrong = await S.readPayment(lg.transactionHash, from, USDG, wallet); ok('readPayment: wrong treasury credits nothing', wrong.amount === 0, wrong);
        const I = await post('/api/intent', { wallet: to, kind: 'bond', market: 'usdg' }); if (I.error) skipT('intent for a USDG holder', I.error); else ok('intent: token contract, chain and decimals for a USDG holder', I.token === USDG && I.chainId === 4663 && I.decimals === 6 && I.treasury === TREASURY, I); }
    } catch (e) { skipT('readPayment on a real USDG transfer', e.message); }
    const In = await post('/api/intent', { wallet, kind: 'bond', market: 'eth' }); ok('intent: native ETH payment on chain 4663', In.native === true && In.chainId === 4663 && In.treasury === TREASURY && In.balance === 0, In);
  }
  S.saveNow(); try { fs.unlinkSync(tmp); } catch (e) {} try { fs.unlinkSync(tmp + '.bak'); } catch (e) {}
  console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
