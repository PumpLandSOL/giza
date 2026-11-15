// writes brand/X-KIT.md and checks every tweet is ≤245 characters.  node _studio/tweets.cjs
// Voice: the builder. Stone, courses, the capstone; plain sentences in the second person, one concrete picture per tweet.
// Nothing here is borrowed from the sOHM kit (banknote / bond-window lines) or the eOHM kit (fork roll-calls, numbered lists).
'use strict';
const fs = require('fs'), path = require('path'), len = (s) => [...s].length;
const L = require('./lib.cjs');
// set X and SITE in lib.cjs once the handle and the domain exist: tweets in LINK then carry the site link
const SITE = L.SITE ? 'https://' + L.SITE.replace(/^https?:\/\//, '') : '', HANDLE = L.X || '(handle not set yet)', NAME = 'GIZA | $GIZA';
const LINK = new Set(['Key art', 'Rebase (video)', 'Getting started (video)', 'Getting started', 'Treasury', 'Launch (fill CA)']);
const APY = 250000, RATE = Math.pow(1 + APY / 100, 1 / (31557600 / 300)) - 1, roi = (d) => Math.pow(1 + RATE, d * 288) - 1;
const n0 = (x) => Math.round(x).toLocaleString('en-US'), pc = (x) => (x * 100).toFixed(1) + '%';
const BIO = 'A reserve built like a pyramid, on Robinhood Chain. Stake and your balance rises every 5 minutes. Bond ETH or USDG below market. (3,3) $GIZA';
const DEX = 'GIZA is an OHM-style (3,3) reserve currency on Robinhood Chain. Stake GIZA to receive sGIZA, which grows at every rebase, 288 times a day. Bond ETH at 7% or USDG at 5% under the market price, vesting in a straight line over five days. Every stake and bond is a real Robinhood Chain transaction that is read back from the chain before anything is credited, and each transaction counts once. Bond payments fill a treasury whose ETH, USDG and staked GIZA balances are read from the chain every 20 seconds and shown live in the app. Fixed supply of 1,000,000,000. Connect with Rabby or MetaMask.';
const T = [
['Pinned · hype (video)', 'giza-hype-14s.mp4', `The Great Pyramid has stood for 4,500 years because every block rests on the one under it.

GIZA is a reserve built that way on Robinhood Chain. Each bond is a block in the treasury, and each one is checked on-chain before it counts.

$GIZA`],
['Key art', 'giza-g01-keyart.png', `There is a new pyramid going up on Robinhood Chain.

Stakers hold it together and get paid every five minutes for it. Bonders bring the stone and buy in under the market price.

It's called GIZA.

$GIZA`],
['The note', 'giza-g02-note.png', `Turn a dollar bill over and there's a pyramid with a capstone floating above it.

We took that engraving and built the protocol underneath: one billion GIZA, fixed, and a treasury that takes ETH and USDG.

$GIZA`],
['Rebase (video)', 'giza-rebase-12s.mp4', `A course of stone is added to GIZA every five minutes.

Put 1,000,000 sGIZA on the clock and the next rebase adds about ${n0(1e6 * RATE)}. The one after adds a little more, because it pays on those ${n0(1e6 * RATE)} too.

$GIZA`],
['Staking', 'giza-g03-stake.png', `Staking GIZA takes one transaction. After that the work is done for you.

Your sGIZA rises at every rebase, 288 times a day, about ${pc(roi(1))} daily at the current rate. The balance is simply larger each time you look.

$GIZA`],
['Bond (video)', 'giza-bond-13s.mp4', `What a GIZA bond looks like from your side:

You send ETH. It's mined on Robinhood Chain. The protocol reads the transaction back and credits you GIZA at 7% under market, unlocking steadily for five days.

$GIZA`],
['Bond markets', 'giza-g04-bonds.png', `Two doors into GIZA, and both are cheaper than the market.

Pay in ETH and your GIZA is priced 7% lower. Pay in USDG and it's 5% lower. Either way the full amount is yours after five days.

$GIZA`],
['Verification', 'giza-g05-verify.png', `Anyone can type a number into a website, so GIZA never asks you for one.

Your wallet sends the payment, the chain mines it, and the protocol reads the receipt itself. You're credited what arrived, once per transaction.

$GIZA`],
['(3,3) (video)', 'giza-33-12s.mp4', `Nobody moves a two-ton block alone.

(3,3) is that idea written as math. Two holders who both stake both come out ahead, and the only move that costs the other side is selling.

$GIZA`],
['Payoff grid', 'giza-g06-matrix.png', `Read the top-left square first.

That's two holders staking, and it's the best result on the board for both. Every other square has someone doing worse. GIZA pays the most for the move that also helps your neighbour.

$GIZA`],
['Compounding (video)', 'giza-compound-12s.mp4', `Stake 1,000,000 GIZA today and don't touch it.

In a week it's ${n0(1e6 * (1 + roi(7)))} sGIZA. In thirty days it's ${n0(1e6 * (1 + roi(30)))}. The rate never changes; each rebase just pays on everything the last one added.

$GIZA`],
['Compounding curve', 'giza-g07-compound.png', `Pyramids go up one course at a time, and so does this curve.

+${pc(roi(1))} after a day. +${pc(roi(7))} after a week. +${pc(roi(30))} after thirty days at the current rate, from 8,640 rebases that each look like nothing.

$GIZA`],
['Getting started (video)', 'giza-start-15s.mp4', `Your first visit to GIZA:

Connect a wallet and sign one free message. Bond some ETH. Come back as it vests and press claim and stake.

That's all of it. No account, no email, no form.

$GIZA`],
['Getting started', 'giza-g08-start.png', `A tip for Robinhood Chain: use Rabby.

It handles this chain's gas well, which is why GIZA lists it first. Connect, sign one free message, bond ETH, then stake what vests.

$GIZA`],
['Treasury', 'giza-g09-treasury.png', `A pyramid you can't inspect is only a rumour.

GIZA's treasury is read from Robinhood Chain every 20 seconds: its ETH, its USDG and the GIZA staked in it. The dashboard shows what the chain says.

$GIZA`],
['Market cap', 'giza-g11-compare.png', `Olympus peaked at $4.35B. Wonderland peaked at $2.08B.

We drew both to scale as pyramids. GIZA is on the same chart on day one, and at that scale you have to squint to find it.

$GIZA`],
['Launch (fill CA)', 'giza-g10-live.png', `$GIZA is live on Robinhood Chain and staking is open.

Stake for the five-minute rebase, or bond ETH or USDG to buy under market.

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
