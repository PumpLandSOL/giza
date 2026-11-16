// writes brand/X-KIT.md and checks every tweet is ≤245 characters.  node _studio/tweets.cjs
// Voice (v2, 2026-11-15, user: "more bullish, compare to previous OHM forks"): the next pyramid. Sourced 2021 fork peaks set
// the scale, GIZA is day one of the same build on Robinhood Chain. Sentences, not roll-call lists.
// Figures: eohm/_studio/forks.json (peak caps OHM $4.35B per The Block citing CoinGecko, TIME $2.08B per DefiLlama; ATH prices CoinGecko).
// No line here repeats the sOHM v2 kit, which uses the same figures with different hooks.
'use strict';
const fs = require('fs'), path = require('path'), len = (s) => [...s].length;
const L = require('./lib.cjs');
// set X and SITE in lib.cjs once the handle and the domain exist: tweets in LINK then carry the site link
const SITE = L.SITE ? 'https://' + L.SITE.replace(/^https?:\/\//, '') : '', HANDLE = L.X || '(handle not set yet)', NAME = 'GIZA | $GIZA';
const LINK = new Set(['Key art', 'Rebase (video)', 'Getting started (video)', 'Getting started', 'Treasury', 'Launch (fill CA)']);
const APY = 250000, RATE = Math.pow(1 + APY / 100, 1 / (31557600 / 300)) - 1, roi = (d) => Math.pow(1 + RATE, d * 288) - 1;
const n0 = (x) => Math.round(x).toLocaleString('en-US'), pc = (x) => (x * 100).toFixed(1) + '%';
const BIO = '(3,3) on Robinhood Chain. OHM built $4.35B, TIME built $2.08B. GIZA is the next pyramid: 288 rebases a day, ETH bonds 7% under market. $GIZA';
const DEX = 'GIZA is an OHM-style (3,3) reserve currency on Robinhood Chain. Stake GIZA to receive sGIZA, which grows at every rebase, 288 times a day. Bond ETH at 7% or USDG at 5% under the market price, vesting in a straight line over five days. Every stake and bond is a real Robinhood Chain transaction that is read back from the chain before anything is credited, and each transaction counts once. Bond payments fill a treasury whose ETH, USDG and staked GIZA balances are read from the chain every 20 seconds and shown live in the app. Fixed supply of 1,000,000,000. Connect with Rabby or MetaMask.';
const T = [
['Pinned · hype (video)', 'giza-hype-14s.mp4', `The Great Pyramid was the tallest thing humans had built for 3,800 years.

Olympus was the tallest thing DeFi had built: $4.35B on one idea, (3,3).

GIZA brings that idea to Robinhood Chain, and the first stones are going in now.

$GIZA`],
['Key art', 'giza-g01-keyart.png', `OHM did $4.35B on Ethereum. TIME did $2.08B on Avalanche.

Robinhood Chain is brand new and its (3,3) reserve is already built: stake GIZA to compound every five minutes, bond ETH 7% under market.

$GIZA`],
['The note', 'giza-g02-note.png', `There's a pyramid on the back of every dollar.

Now there's one on Robinhood Chain: one billion GIZA, fixed supply, backed by a treasury that takes in ETH and USDG every time someone bonds.

$GIZA`],
['Rebase (video)', 'giza-rebase-12s.mp4', `In 2021 an OHM staker waited eight hours for each rebase and still watched the protocol reach $4.35B.

A GIZA staker waits five minutes. That's 96 rebases in the time Olympus did one.

$GIZA`],
['Staking', 'giza-g03-stake.png', `GIZA pays stakers 250,000% APY. It's the design that made OHM forks the trade of late 2021.

In practice that's about ${pc(roi(1))} a day, compounding every five minutes, while you do nothing at all.

$GIZA`],
['Bond (video)', 'giza-bond-13s.mp4', `Buying at market is for people who never read how OHM worked.

Bond ETH on GIZA and your tokens are priced 7% under market, released over five days, while your ETH goes into the treasury behind every holder.

$GIZA`],
['Bond markets', 'giza-g04-bonds.png', `Two discounts on Robinhood Chain.

ETH bonds get GIZA at 7% under market. USDG bonds get it at 5% under.

Bonds are how every OHM fork filled its treasury, and the ones with the fullest treasuries ran the furthest.

$GIZA`],
['Verification', 'giza-g05-verify.png', `The 2021 forks ran on trust, and some of them shouldn't have.

GIZA checks every bond against Robinhood Chain before crediting it and shows its treasury straight from the chain. Built to be inspected, like anything meant to last.

$GIZA`],
['(3,3) (video)', 'giza-33-12s.mp4', `(3,3) took Olympus to a $4.35B market cap and Wonderland to $2.08B.

The rule never changed: when holders stake instead of sell, everyone compounds. GIZA runs that rule on Robinhood Chain.

$GIZA`],
['Payoff grid', 'giza-g06-matrix.png', `Every OHM fork that ran had one thing in common: holders who understood this grid.

Stake and both sides win. Sell and you take a little while everyone else pays. The top-left square is where the money was made.

$GIZA`],
['Compounding (video)', 'giza-compound-12s.mp4', `1,000,000 GIZA staked today is ${n0(1e6 * (1 + roi(7)))} in a week and ${n0(1e6 * (1 + roi(30)))} in a month at the current rate.

No trades and no claims. Pyramids get built by the people who keep stacking.

$GIZA`],
['Compounding curve', 'giza-g07-compound.png', `+${pc(roi(1))} a day. +${pc(roi(7))} a week. +${pc(roi(30))} a month.

That's staked GIZA at the current rate, 288 rebases a day. The stakers who are in for the first courses end up holding the most stone.

$GIZA`],
['Getting started (video)', 'giza-start-15s.mp4', `In November 2021 the (3,3) sector was worth $8.03B.

Every protocol in it started exactly where GIZA is now: day one. Connect a wallet, bond ETH, claim and stake.

$GIZA`],
['Getting started', 'giza-g08-start.png', `Early on a new chain is the only kind of early that counts.

GIZA is on Robinhood Chain from the start. Open Rabby, bond ETH at 7% under market, and stake what vests.

$GIZA`],
['Treasury', 'giza-g09-treasury.png', `A pyramid is only as good as its base.

GIZA's base is a treasury on Robinhood Chain that holds every bond and is read from the chain every 20 seconds. Each ETH that goes in raises what stands behind GIZA.

$GIZA`],
['Market cap', 'giza-g11-compare.png', `Olympus: $4.35B at the top. Wonderland: $2.08B.

We drew both as pyramids, to scale. GIZA is the smallest one on the page today, and every pyramid on that chart started as a single course of stone.

$GIZA`],
['Launch (fill CA)', 'giza-g10-live.png', `$GIZA is live on Robinhood Chain.

OHM reached $4.35B. TIME reached $2.08B. This is day one of the next one.

Stake for 288 rebases a day, or bond ETH or USDG under market.

CA:

$GIZA`],
];
let md = `# GIZA X kit\n\n## Handle\n\`\`\`\n${HANDLE}\n\`\`\`\n\n## Display name\n\`\`\`\n${NAME}\n\`\`\`\n\n## Bio (${len(BIO)}/160)\n\`\`\`\n${BIO}\n\`\`\`\n\n## DexScreener description\n\`\`\`\n${DEX}\n\`\`\`\n\n` + (SITE ? `## Website\n\`\`\`\n${SITE}\n\`\`\`\n\n` : '') + `## Profile images\n- Avatar: \`giza-pfp.png\`\n- Header: \`giza-banner.png\`\n- Share image: \`giza-og.png\`\n\n## Tweets (all ≤245)\n`;
let bad = 0; T.forEach(([title, media, text0], i) => { const tail = '\n\n$GIZA', text = SITE && LINK.has(title) && text0.endsWith(tail) ? text0.slice(0, -tail.length) + '\n\n' + SITE + tail : text0, n = len(text);
  if (n > 245) { bad++; console.log('TOO LONG', title, n); } if (!fs.existsSync(path.join(__dirname, '..', 'brand', media))) console.log('MISSING MEDIA', media);
  md += `\n### ${i + 1}. ${title} · ${n} chars · media: \`${media}\`\n\`\`\`\n${text}\n\`\`\`\n`; console.log(String(n).padStart(4), title); });
if (len(BIO) > 160) { bad++; console.log('BIO TOO LONG', len(BIO)); }
if (/sohm|solana|phantom/i.test(md)) { bad++; console.log('TEXT FROM ANOTHER PROJECT IN KIT'); }
fs.writeFileSync(path.join(__dirname, '..', 'brand', 'X-KIT.md'), md); console.log(T.length, 'tweets', bad ? 'FAILED' : 'ok', 'bio', len(BIO)); process.exit(bad ? 1 : 0);
