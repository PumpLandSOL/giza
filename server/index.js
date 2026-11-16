// GIZA ($GIZA) — OHM-style (3,3) staking + bonding + treasury protocol on Robinhood Chain.
// Bonds are paid in real ETH or USDG on Robinhood Chain mainnet and verified on-chain before anything is credited.
// Fixed supply => rebases do not mint on-chain. The index, the sGIZA ledger and the bond vesting
// run in this server; deposits, bond payments and the treasury itself are real and read from the chain.
// Staked $GIZA and bond payments sit in the treasury wallet; payouts are sent from it.
// Dependency-free: Node http + crypto, plus a small keccak/secp256k1 file for wallet signatures.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { recoverPersonal } = require('./evmsig');

// ---------- PLACEHOLDERS: the only place the domain and the X handle are set (or use the env vars) ----------
const SITE_URL = (process.env.SITE_URL || 'https://gizarh.xyz').replace(/\/$/, '');
const X_URL = process.env.X_URL || 'https://x.com';

// private settings (TREASURY_WALLET, ADMIN_KEY…) can live in a git-ignored .env next to package.json; real env vars win
try { for (const l of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } } catch (e) {}

const lc = (s) => String(s || '').toLowerCase();
const BOOT_TS = Date.now();
const PORT = process.env.PORT || 8292;
const ROOT = path.join(__dirname, '..');
const TOKEN = process.env.TOKEN_TICKER || 'GIZA';
const STAKED = process.env.STAKED_TICKER || 'sGIZA';
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
// $GIZA ERC-20 contract. Staking opens the instant this is known: set GIZA_MINT, or call /api/admin/mint (no redeploy, persisted).
let GIZA_MINT = lc(process.env.GIZA_MINT), MINT_DEC = +(process.env.GIZA_DECIMALS || 18);
// PAUSE switch: no new stakes or bonds while paused (env DEPOSITS_PAUSED=1 or /api/admin/pause?key=…&on=1). Off by default.
let PAUSED = process.env.DEPOSITS_PAUSED === '1';
// treasury: the wallet that receives bond payments and staked $GIZA (key held offline by the operator — never on this server).
// The address is set by env only and is never printed on a page, in the docs or in the public config/metrics/tape:
// it is handed to a wallet only inside /api/intent, at the moment that wallet builds a payment.
const TREASURY_WALLET = lc(process.env.TREASURY_WALLET);
const USDG = lc(process.env.USDG_ADDR || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168');   // USDG on Robinhood Chain (6 dp)
const EXPLORER = process.env.EXPLORER || 'https://explorer.mainnet.chain.robinhood.com';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MIN_STAKE = +(process.env.MIN_STAKE || 300000);  // minimum $GIZA per stake deposit
const LOCK_SEC = +(process.env.LOCK_SEC || 3600);      // stake lock: must stay staked at least this long before unstaking
const CHAIN_ID = +(process.env.CHAIN_ID || 4663);      // Robinhood Chain mainnet
const RPCS = (process.env.RPC_URLS || process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com').split(',');
async function rpc(method, params) {
  let err; for (const u of RPCS) { try {
    const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) });
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; } catch (e) { err = e; } }
  throw err || new Error('rpc');
}
// ---------- addresses ----------
const isWallet = (s) => typeof s === 'string' && /^0x[0-9a-f]{40}$/.test(s);
const isSig = (s) => typeof s === 'string' && /^0x[0-9a-f]{64}$/.test(s);   // a transaction hash
const shortW = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const pad32 = (a) => a.slice(2).padStart(64, '0');
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const REBASE_SEC = +(process.env.REBASE_SEC || 300);           // epoch length (5 min)
// Dynamic APY (OHM-style reflexive emissions): rich when the pool is small, decaying as it fills.
// apy = APY_MIN + (APY_MAX - APY_MIN) * HALF / (HALF + totalStaked)
const APY_MAX = +(process.env.APY_MAX || 50000);
const APY_MIN = +(process.env.APY_MIN || 6000);
const APY_HALF = +(process.env.APY_HALF || 4e6);
// APY BOOST: while active, APY is floored at BOOST_APY. Armed for 24 h the moment the token goes live, or via /api/admin/boost.
const BOOST_APY = +(process.env.BOOST_APY || 500000);
const BOOST_UNTIL_ENV = +(process.env.BOOST_UNTIL || 0);
const BOOST_HOURS = +(process.env.BOOST_HOURS || 0);
const TOTAL_SUPPLY = +(process.env.TOTAL_SUPPLY || 1e9);       // fixed supply
// $ per GIZA. Live from the deepest Robinhood Chain pool once the contract is set. Before launch: TOKEN_PRICE env,
// otherwise the opening price (OPEN_MCAP spread over the fixed supply).
const OPEN_PRICE = +(process.env.OPEN_MCAP || 5000) / TOTAL_SUPPLY;
let LIVE_PRICE = 0;
const tokenPrice = () => LIVE_PRICE || +(process.env.TOKEN_PRICE || 0) || OPEN_PRICE;
async function pollPrice() {
  if (!GIZA_MINT) return;
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + GIZA_MINT, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const pairs = ((await r.json()).pairs || []).filter((p) => p.chainId === (process.env.DEX_CHAIN || 'robinhood') && +p.priceUsd > 0);
    pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    if (pairs[0]) LIVE_PRICE = +pairs[0].priceUsd;
  } catch (e) { /* keep last good */ }
}
// ETH price: Coinbase spot first (keyless), CoinGecko as the fallback
let ETH_USD = +(process.env.ETH_USD || 0);
async function pollEth() {
  try { const j = await (await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { signal: AbortSignal.timeout(10000) })).json(); const p = +j.data.amount; if (p > 0) { ETH_USD = p; return; } } catch (e) {}
  try { const j = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { signal: AbortSignal.timeout(10000) })).json(); if (j.ethereum && j.ethereum.usd > 0) ETH_USD = j.ethereum.usd; } catch (e) {}
}
// the treasury, read straight from Robinhood Chain: ETH, USDG and the $GIZA it holds for stakers
const CHAIN = { block: 0, blockAt: 0, eth: 0, usdg: 0, giza: 0, ok: false };
const ethBal = async (who) => Number(BigInt(await rpc('eth_getBalance', [who, 'latest']))) / 1e18;
const erc20Bal = async (token, who, dec) => Number(BigInt(await rpc('eth_call', [{ to: token, data: '0x70a08231' + pad32(who) }, 'latest']))) / 10 ** dec;
async function pollTreasury() {
  try { CHAIN.block = Number(BigInt(await rpc('eth_blockNumber', []))); CHAIN.blockAt = Date.now(); CHAIN.ok = true; } catch (e) { CHAIN.ok = false; }
  if (!TREASURY_WALLET) return;
  try { CHAIN.eth = await ethBal(TREASURY_WALLET); } catch (e) {}
  try { CHAIN.usdg = await erc20Bal(USDG, TREASURY_WALLET, 6); } catch (e) {}
  if (GIZA_MINT) try { CHAIN.giza = await erc20Bal(GIZA_MINT, TREASURY_WALLET, MINT_DEC); } catch (e) {}
}
const SEED_BALANCE = 0;   // every GIZA in the ledger comes from a real deposit or bond
const REBASES_YR = 31557600 / REBASE_SEC;
function poolStaked() { return db.totalAgons * db.index; }   // the sGIZA ledger: what stakers are owed
function boostUntil() { return Math.max(BOOST_UNTIL_ENV, db.boostUntil || 0, BOOST_HOURS > 0 ? BOOT_TS + BOOST_HOURS * 3600e3 : 0); }
function boostActive() { return Date.now() < boostUntil(); }
const FIXED_APY = +(process.env.FIXED_APY || 250000);  // pin the emission APY; set 0 to use the dynamic curve
function currentApy(ts) {
  if (FIXED_APY > 0) return boostActive() ? Math.max(FIXED_APY, BOOST_APY) : FIXED_APY;
  const s = ts == null ? poolStaked() : ts;
  const base = APY_MIN + (APY_MAX - APY_MIN) * (APY_HALF / (APY_HALF + Math.max(0, s)));
  return boostActive() ? Math.max(base, BOOST_APY) : base;
}
function currentRate(ts) { return Math.pow(1 + currentApy(ts) / 100, 1 / REBASES_YR) - 1; }
const BONDS = [
  { id: 'eth', name: 'ETH', discount: +(process.env.BOND_ETH_DISC || 0.07), vestDays: 5, asset: 'native', dec: 18, min: +(process.env.BOND_ETH_MIN || 0.002) },
  { id: 'usdg', name: 'USDG', discount: +(process.env.BOND_USDG_DISC || 0.05), vestDays: 5, asset: USDG, dec: 6, min: +(process.env.BOND_USDG_MIN || 5) },
];
const assetUsd = (m) => (m.asset === 'native' ? ETH_USD : 1);

// ---------- state ----------
let db = { index: 1, epoch: 0, lastRebase: Date.now(), treasury: 0, totalAgons: 0, wallets: {} };
function readDb(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
try { db = Object.assign(db, readDb(DATA_PATH)); } catch (e) { try { db = Object.assign(db, readDb(DATA_PATH + '.bak')); } catch (e2) {} }
if (!db.wallets) db.wallets = {};
if (!db.tape) db.tape = [];
if (!db.withdrawals) db.withdrawals = [];
if (!db.bondTx) db.bondTx = [];
if (!db.stakeTx) db.stakeTx = [];
if (!GIZA_MINT && db.mint) { GIZA_MINT = db.mint; MINT_DEC = db.mintDec || 18; }
function armLaunchBoost() { if (GIZA_MINT && db.boostArmed !== 'launch-24h') { db.boostArmed = 'launch-24h'; db.boostUntil = Date.now() + 24 * 3600e3; save(); } }
const treasuryUsd = () => Math.max(db.treasury, CHAIN.eth * ETH_USD + CHAIN.usdg);
function tapePush(type, wallet, amount) {
  db.tape.unshift({ t: Date.now(), type, w: shortW(wallet), amount: +(+amount).toFixed(2) });
  if (db.tape.length > 60) db.tape.length = 60;
}
// atomic save: write a temp file, keep the previous one as .bak, rename into place
function saveNow() { try { fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true }); const tmp = DATA_PATH + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); try { fs.copyFileSync(DATA_PATH, DATA_PATH + '.bak'); } catch (e) {} fs.renameSync(tmp, DATA_PATH); } catch (e) {} }
let saveT = null; function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; saveNow(); }, 800); }

function rebase() { db.index *= (1 + currentRate()); db.epoch++; db.lastRebase = Date.now(); save(); }
(function catchup() { const missed = Math.floor((Date.now() - db.lastRebase) / 1000 / REBASE_SEC); for (let i = 0; i < Math.min(missed, 10000); i++) rebase(); })();
armLaunchBoost();

function liveIndex() { const frac = (Date.now() - db.lastRebase) / 1000 / REBASE_SEC; return db.index * (1 + currentRate() * Math.max(0, Math.min(1, frac))); }
function W(addr) { return db.wallets[addr] || (db.wallets[addr] = { balance: SEED_BALANCE, agons: 0, bonds: [] }); }
function stakedOf(w, idx) { return w.agons * (idx || liveIndex()); }
const circulating = () => TOTAL_SUPPLY;

function metrics() {
  const idx = liveIndex(), price = tokenPrice();
  const ts = poolStaked();
  const leaderboard = Object.entries(db.wallets).map(([a, w]) => ({ a, staked: w.agons * idx }))
    .filter((x) => x.staked > 0.001).sort((x, y) => y.staked - x.staked);
  const backing = treasuryUsd() / circulating();
  const rate = currentRate(ts); const rewardsPerDay = ts * (Math.pow(1 + rate, 86400 / REBASE_SEC) - 1) * price;
  // nothing staked => nothing emitting => runway is undefined, not zero. null so the UI can say so.
  const runway = rewardsPerDay > 0 ? treasuryUsd() / rewardsPerDay : null;
  return {
    token: TOKEN, staked: STAKED, apy: currentApy(ts), rate, index: +idx.toFixed(6), epoch: db.epoch,
    totalStaked: ts, circulating: circulating(), stakingRatio: ts / circulating(),
    treasury: treasuryUsd(), treasuryOnchain: { eth: CHAIN.eth, usdg: CHAIN.usdg, giza: CHAIN.giza, ethUsd: ETH_USD, live: !!TREASURY_WALLET },
    bondedUsd: db.treasury, backingPerToken: backing, price, marketCap: price * circulating(),
    runwayDays: runway, rebaseSec: REBASE_SEC, nextRebaseIn: Math.max(0, REBASE_SEC - (Date.now() - db.lastRebase) / 1000),
    bonds: BONDS.map((b) => ({ id: b.id, name: b.name, discount: b.discount, vestDays: b.vestDays, price: price * (1 - b.discount), asset: b.asset, dec: b.dec, min: b.min, assetUsd: assetUsd(b) })),
    leaderboard: leaderboard.slice(0, 8).map((x) => ({ wallet: shortW(x.a), staked: x.staked, share: ts > 0 ? x.staked / ts : 0 })),
    stakers: leaderboard.length, paused: PAUSED, bondsOpen: !!TREASURY_WALLET, mint: GIZA_MINT, block: CHAIN.block, blockAt: CHAIN.blockAt, tape: db.tape.slice(0, 12).map((e) => ({ t: e.t, type: e.type, w: e.w, amount: e.amount })),
    boost: boostActive() ? { apy: BOOST_APY, until: boostUntil(), secondsLeft: Math.ceil((boostUntil() - Date.now()) / 1000) } : null,
  };
}
function account(addr) {
  const w = W(addr); const idx = liveIndex();
  const now = Date.now();
  const bonds = w.bonds.filter((b) => !b.done).map((b) => {
    const pct = Math.max(0, Math.min(1, (now - b.start) / (b.end - b.start)));
    const claimable = b.payout * pct - b.claimed;
    return { market: b.market, payout: b.payout, claimable: Math.max(0, claimable), pct, endsIn: Math.max(0, (b.end - now) / 1000), tx: b.tx };
  });
  const pendingOut = db.withdrawals.filter((x) => x.wallet === addr && x.status === 'pending').reduce((s, x) => s + x.amount, 0);
  return { wallet: addr, staked: stakedOf(w, idx), index: +idx.toFixed(6),
    nextReward: stakedOf(w, idx) * currentRate(), bonds, pendingOut,
    lockRemaining: Math.max(0, Math.ceil(((w.lockUntil || 0) - Date.now()) / 1000)) };
}

// ---------- sessions: unstake and claim are signed by the wallet (personal_sign, secp256k1) ----------
const SESSIONS = new Map();
const sessionMsg = (w, exp) => ['GIZA session', 'Wallet: ' + w, 'Expires: ' + exp, 'Signing is free and moves no funds.'].join('\n');
function requireSess(w, auth) {
  if (!auth || !auth.sig || !auth.exp) throw 'sign in with your wallet first';
  const exp = +auth.exp; if (!(exp > Date.now())) throw 'session expired, sign in again'; if (exp > Date.now() + 8 * 864e5) throw 'bad session';
  const key = w + ':' + exp + ':' + auth.sig; if (SESSIONS.get(key)) return true;
  let who; try { who = lc(recoverPersonal(sessionMsg(w, exp), String(auth.sig))); } catch (e) { throw 'bad signature'; }
  if (who !== w) throw 'signature is not from this wallet';
  if (SESSIONS.size > 5000) SESSIONS.clear(); SESSIONS.set(key, 1); return true;
}

// ---------- on-chain verification ----------
// Reads a mined Robinhood Chain transaction and returns how much of `asset` ('native' ETH or an ERC-20 contract)
// moved from `wallet` into the treasury. ETH: the transaction itself is sent by the wallet to the treasury.
// Tokens: every Transfer(from = wallet, to = treasury) log of that contract in the receipt, so plain transfers,
// routers and smart wallets are all credited for exactly what arrived.
async function readPayment(hash, wallet, asset, treasury) {
  treasury = lc(treasury || TREASURY_WALLET); wallet = lc(wallet);
  const [tx, rc] = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]);
  if (!tx || !rc) throw 'transaction not found on Robinhood Chain yet — try again in a few seconds';
  if (rc.status !== '0x1') throw 'transaction failed on-chain';
  let amt = 0;
  if (asset === 'native') {
    if (lc(tx.from) !== wallet) throw 'transaction was not sent by your wallet';
    if (lc(tx.to) !== treasury) throw 'payment did not go to the treasury';
    amt = Number(BigInt(tx.value)) / 1e18;
  } else {
    asset = lc(asset); let raw = 0n, dec = asset === USDG ? 6 : MINT_DEC;
    for (const lg of rc.logs || []) { if (lc(lg.address) !== asset || !lg.topics || lg.topics[0] !== TRANSFER || lg.topics.length < 3) continue;
      if ('0x' + lg.topics[1].slice(26) === wallet && '0x' + lg.topics[2].slice(26) === treasury) raw += BigInt(lg.data === '0x' ? 0 : lg.data); }
    amt = Number(raw) / 10 ** dec;
  }
  return { amount: amt > 0 ? +amt.toFixed(9) : 0, block: Number(BigInt(rc.blockNumber)) };
}
// handed to a wallet at the moment it builds its transfer: where to pay, on which chain, and what it holds
async function intent(wallet, asset) {
  if (!TREASURY_WALLET) throw 'bonds are not open yet';
  if (asset === 'native') return { native: true, treasury: TREASURY_WALLET, chainId: CHAIN_ID, balance: await ethBal(wallet), decimals: 18 };
  const dec = asset === USDG ? 6 : MINT_DEC, bal = await erc20Bal(asset, wallet, dec);
  if (!bal) throw 'this wallet holds none of this token on Robinhood Chain';
  return { native: false, treasury: TREASURY_WALLET, chainId: CHAIN_ID, token: asset, decimals: dec, balance: bal };
}

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const PAGES = { '/': '/client/landing.html', '/app': '/client/index.html', '/app/': '/client/index.html', '/docs': '/client/docs.html', '/docs/': '/client/docs.html' };
// HTML pages carry {{SITE_URL}} / {{X_URL}} tokens so the placeholders live in one place (top of this file)
function fill(html) { return html.replace(/\{\{SITE_URL\}\}/g, SITE_URL).replace(/\{\{X_URL\}\}/g, X_URL); }
function serve(req, res) {
  let u; try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (PAGES[u]) u = PAGES[u];
  if (!u.startsWith('/client/')) { res.writeHead(404); return res.end('not found'); }
  const f = path.normalize(path.join(ROOT, u)); if (!f.startsWith(path.join(ROOT, 'client'))) { res.writeHead(403); return res.end('no'); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('not found'); } const ext = path.extname(f);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' }); res.end(ext === '.html' ? fill(b.toString('utf8')) : b); });
}
function json(res, c, o) { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }
// addresses and transaction hashes are compared in lower case everywhere, so normalise them once on the way in
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { let d = {}; try { d = JSON.parse(b || '{}') || {}; } catch (e) {} if (typeof d.wallet === 'string') d.wallet = d.wallet.toLowerCase(); if (typeof d.tx === 'string') d.tx = d.tx.toLowerCase(); r(d); }); }); }
const admin = (req) => { const q = new URL(req.url, 'http://x').searchParams; return ADMIN_KEY && q.get('key') === ADMIN_KEY ? q : null; };
const errMsg = (e, fallback) => (typeof e === 'string' ? e : fallback);

const server = http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/api/health') return json(res, 200, { ok: true, epoch: db.epoch, chain: CHAIN.ok, block: CHAIN.block });
  if (u === '/api/admin/pause') { const q = admin(req); if (!q) return json(res, 403, { error: 'nope' }); PAUSED = q.get('on') !== '0'; return json(res, 200, { ok: true, paused: PAUSED }); }
  // operator: switch staking on the moment $GIZA is live. Verifies it is an ERC-20 on Robinhood Chain and reads its decimals.
  if (u === '/api/admin/mint') {
    const q = admin(req); if (!q) return json(res, 403, { error: 'nope' });
    const m = lc(q.get('mint')); if (!isWallet(m)) return json(res, 200, { error: 'mint must be a 0x contract address' });
    try { const dec = Number(BigInt(await rpc('eth_call', [{ to: m, data: '0x313ce567' }, 'latest']))), sup = BigInt(await rpc('eth_call', [{ to: m, data: '0x18160ddd' }, 'latest']));
      if (!(dec >= 0 && dec <= 36)) throw new Error('no decimals()');
      GIZA_MINT = m; MINT_DEC = dec; db.mint = m; db.mintDec = dec; armLaunchBoost(); save(); pollTreasury(); pollPrice();
      return json(res, 200, { ok: true, mint: m, decimals: dec, supply: String(Number(sup) / 10 ** dec), staking: 'open' });
    } catch (e) { return json(res, 200, { error: 'not an ERC-20 contract on Robinhood Chain — ' + e.message }); } }
  if (u === '/api/config') return json(res, 200, { token: TOKEN, staked: STAKED, rebaseSec: REBASE_SEC, mint: GIZA_MINT, decimals: MINT_DEC, paused: PAUSED, bondsOpen: !!TREASURY_WALLET, minStake: MIN_STAKE, lockSec: LOCK_SEC, network: 'robinhood-chain', chainId: CHAIN_ID, rpc: RPCS[0], explorer: EXPLORER, usdg: USDG, ethUsd: ETH_USD, siteUrl: SITE_URL, xUrl: X_URL });
  if (u === '/api/metrics') return json(res, 200, metrics());
  if (u === '/api/session') { const w = lc(new URL(req.url, 'http://x').searchParams.get('wallet')); if (!isWallet(w)) return json(res, 200, { error: 'bad wallet' }); const exp = Date.now() + 7 * 864e5; return json(res, 200, { exp, message: sessionMsg(w, exp) }); }
  if (req.method === 'POST' && u === '/api/balance') { const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' }); if (!GIZA_MINT) return json(res, 200, { balance: 0, prelaunch: true }); try { return json(res, 200, { balance: await erc20Bal(GIZA_MINT, d.wallet, MINT_DEC) }); } catch (e) { return json(res, 200, { error: 'rpc unavailable' }); } }
  if (req.method === 'POST' && u === '/api/account') { const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'connect a wallet' }); return json(res, 200, account(d.wallet)); }
  // what the wallet needs to build its own transfer (stake = $GIZA, bond = the market's asset)
  if (req.method === 'POST' && u === '/api/intent') {
    const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' });
    if (PAUSED) return json(res, 200, { error: 'deposits are paused — do not send funds to the treasury' });
    let asset; if (d.kind === 'stake') { if (!GIZA_MINT) return json(res, 200, { error: 'staking opens the moment $GIZA launches' }); asset = GIZA_MINT; }
    else { const m = BONDS.find((x) => x.id === d.market); if (!m) return json(res, 200, { error: 'bad market' }); asset = m.asset; }
    try { return json(res, 200, await intent(d.wallet, asset)); } catch (e) { return json(res, 200, { error: errMsg(e, 'the Robinhood Chain RPC is busy — try again in a moment') }); }
  }
  // stake = a real $GIZA transfer to the treasury. The server reads the mined transaction from the chain and
  // credits sGIZA for the amount that actually arrived — never the client's claim, never the same transaction twice.
  if (req.method === 'POST' && u === '/api/stake') {
    const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' });
    if (PAUSED) return json(res, 200, { error: 'deposits are paused — do not send GIZA to the treasury' });
    if (!GIZA_MINT) return json(res, 200, { error: 'staking opens the moment $GIZA launches — bond ETH or USDG now to get GIZA at a discount' });
    if (!TREASURY_WALLET) return json(res, 200, { error: 'staking is not open yet' });
    if (!isSig(d.tx)) return json(res, 200, { error: 'missing deposit transaction — stake sends $GIZA to the treasury first' });
    if (db.stakeTx.includes(d.tx) || db.bondTx.includes(d.tx)) return json(res, 200, { error: 'deposit already credited' });
    let p; try { p = await readPayment(d.tx, d.wallet, GIZA_MINT); } catch (e) { return json(res, 200, { error: errMsg(e, 'could not verify deposit — try again in a moment') }); }
    const amt = p.amount;
    if (!(amt > 0)) return json(res, 200, { error: 'no $GIZA moved from your wallet to the treasury in this transaction' });
    if (amt < MIN_STAKE) return json(res, 200, { error: 'below minimum — deposit was ' + amt.toLocaleString() + ', minimum is ' + MIN_STAKE.toLocaleString() + ' $GIZA' });
    if (db.stakeTx.includes(d.tx)) return json(res, 200, { error: 'deposit already credited' });
    const w = W(d.wallet); const idx = liveIndex(); const ag = amt / idx; w.agons += ag; db.totalAgons += ag;
    w.lockUntil = Date.now() + LOCK_SEC * 1000;
    db.stakeTx.push(d.tx); tapePush('stake', d.wallet, amt); Object.assign(db.tape[0], { tx: d.tx, ag, addr: d.wallet }); save();
    return json(res, 200, { ok: true, credited: amt, ...account(d.wallet) });
  }
  // operator: re-verify every credited stake against the chain and reverse any that don't check out.
  if (u === '/api/admin/reverify') {
    if (!admin(req)) return json(res, 403, { error: 'nope' });
    const reversed = [];
    for (const e of db.tape) {
      if (e.type !== 'stake' || !e.tx || !e.addr || e.bad) continue;
      let ok = false;
      try { ok = (await readPayment(e.tx, e.addr, GIZA_MINT)).amount > 0; } catch (x) { if (typeof x !== 'string' || /not found/.test(x)) continue; /* leave untouched if RPC is flaky */ }
      if (!ok) {
        const ag = e.ag != null ? e.ag : e.amount / liveIndex();
        if (db.wallets[e.addr]) db.wallets[e.addr].agons = Math.max(0, db.wallets[e.addr].agons - ag);
        db.totalAgons = Math.max(0, db.totalAgons - ag);
        e.bad = true; reversed.push({ wallet: e.w, amount: e.amount, tx: e.tx });
      }
    }
    save(); return json(res, 200, { reversed, count: reversed.length });
  }
  // unstake = join the payout queue; payouts are sent from the treasury wallet. Signed session required.
  if (req.method === 'POST' && u === '/api/unstake') {
    const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' });
    try { requireSess(d.wallet, d.auth); } catch (e) { return json(res, 200, { error: errMsg(e, 'sign in again'), auth: true }); }
    const w = W(d.wallet); const lockLeft = Math.ceil(((w.lockUntil || 0) - Date.now()) / 1000);
    if (lockLeft > 0) return json(res, 200, { error: 'staked positions are locked for ' + Math.round(LOCK_SEC / 60) + ' min — ' + Math.ceil(lockLeft / 60) + ' min left' });
    const idx = liveIndex(); const have = stakedOf(w, idx); const amt = Math.max(0, Math.min(+d.amount || 0, have)); if (amt <= 0) return json(res, 200, { error: 'nothing staked' });
    const ag = amt / idx; w.agons = Math.max(0, w.agons - ag); db.totalAgons = Math.max(0, db.totalAgons - ag);
    db.withdrawals.push({ wallet: d.wallet, amount: +amt.toFixed(4), kind: 'unstake', t: Date.now(), status: 'pending' }); tapePush('unstake', d.wallet, amt); save();
    return json(res, 200, { ok: true, queued: +amt.toFixed(4), ...account(d.wallet) });
  }
  if (u === '/api/admin/boost') {
    const q = admin(req); if (!q) return json(res, 403, { error: 'nope' });
    if (q.get('off')) { db.boostUntil = 0; save(); return json(res, 200, { ok: true, boost: null }); }
    const hours = Math.max(0, +q.get('hours') || 24);
    db.boostUntil = Date.now() + hours * 3600e3; save();
    return json(res, 200, { ok: true, boostApy: BOOST_APY, until: db.boostUntil, hours });
  }
  // operator export: who is owed what. ?paid=<index>&tx=<hash> marks a payout as sent.
  if (u === '/api/withdrawals') { const q = admin(req); if (!q) return json(res, 403, { error: 'nope' });
    if (q.get('paid') != null) { const x = db.withdrawals[+q.get('paid')]; if (x) { x.status = 'paid'; x.tx = q.get('tx') || ''; save(); } }
    return json(res, 200, { treasury: TREASURY_WALLET, pending: db.withdrawals.map((x, i) => ({ i, ...x })).filter((x) => x.status === 'pending'), all: db.withdrawals }); }
  // bond = a REAL payment to the treasury on Robinhood Chain: native ETH, or USDG as an ERC-20 transfer.
  // The server reads the mined transaction, credits the on-chain amount and never credits a transaction twice.
  if (req.method === 'POST' && u === '/api/bond') {
    const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' });
    if (PAUSED) return json(res, 200, { error: 'bonds are paused — do not send funds to the treasury' });
    if (!TREASURY_WALLET) return json(res, 200, { error: 'bonds are not open yet' });
    const m = BONDS.find((x) => x.id === d.market); if (!m) return json(res, 200, { error: 'bad market' });
    if (!isSig(d.tx)) return json(res, 200, { error: 'missing payment transaction — a bond pays the treasury first' });
    if (db.bondTx.includes(d.tx) || db.stakeTx.includes(d.tx)) return json(res, 200, { error: 'this payment was already credited' });
    let p; try { p = await readPayment(d.tx, d.wallet, m.asset); } catch (e) { return json(res, 200, { error: errMsg(e, 'could not verify payment — try again in a moment') }); }
    const amt = p.amount;
    if (!(amt > 0)) return json(res, 200, { error: 'no ' + m.name + ' moved from your wallet to the treasury in this transaction' });
    if (amt < m.min) return json(res, 200, { error: 'below the ' + m.min + ' ' + m.name + ' minimum — this payment was ' + amt + ' ' + m.name + ' and was not credited' });
    const usd = amt * assetUsd(m), price = tokenPrice(); if (!(usd > 0) || !(price > 0)) return json(res, 200, { error: 'price feed unavailable — try again in a minute' });
    if (db.bondTx.includes(d.tx)) return json(res, 200, { error: 'this payment was already credited' });
    const payout = usd / (price * (1 - m.discount)); const w = W(d.wallet); const now = Date.now();
    w.bonds.push({ market: m.name, paid: amt, usd, tx: d.tx, payout, start: now, end: now + m.vestDays * 86400000, claimed: 0, done: false });
    db.bondTx.push(d.tx); tapePush('bond', d.wallet, payout); db.tape[0].tx = d.tx; db.treasury += usd; save(); pollTreasury();
    return json(res, 200, { ok: true, paid: amt, usd, payout, ...account(d.wallet) });
  }
  if (req.method === 'POST' && u === '/api/claim') {
    const d = await body(req); if (!isWallet(d.wallet)) return json(res, 200, { error: 'bad wallet' });
    try { requireSess(d.wallet, d.auth); } catch (e) { return json(res, 200, { error: errMsg(e, 'sign in again'), auth: true }); }
    const w = W(d.wallet); const now = Date.now(); let claimed = 0; const autostake = !!d.autostake;
    for (const b of w.bonds) { if (b.done) continue; const pct = Math.max(0, Math.min(1, (now - b.start) / (b.end - b.start))); const c = b.payout * pct - b.claimed; if (c > 0) { b.claimed += c; claimed += c; } if (pct >= 1) b.done = true; }
    if (claimed > 0) { if (autostake) { const idx = liveIndex(); const ag = claimed / idx; w.agons += ag; db.totalAgons += ag; tapePush('stake', d.wallet, claimed); } else db.withdrawals.push({ wallet: d.wallet, amount: +claimed.toFixed(4), kind: 'bond-claim', status: 'pending', t: Date.now() }); save(); }
    return json(res, 200, { ok: true, claimed, autostake, ...account(d.wallet) });
  }
  serve(req, res);
});

function start() {
  pollEth(); setInterval(pollEth, 30000).unref();
  pollPrice(); setInterval(pollPrice, 60000).unref();
  pollTreasury(); setInterval(pollTreasury, 20000).unref();
  setInterval(() => { if (Date.now() - db.lastRebase >= REBASE_SEC * 1000) rebase(); }, 1000).unref();
  process.on('SIGTERM', () => { saveNow(); process.exit(0); });
  return server.listen(PORT, () => console.log('GIZA on Robinhood Chain · :' + PORT + ' · rebase ' + REBASE_SEC + 's' + (TREASURY_WALLET ? '' : ' · TREASURY_WALLET not set (bonds closed)')));
}
if (require.main === module) start();
module.exports = { start, server, readPayment, sessionMsg, isWallet, isSig, saveNow };
