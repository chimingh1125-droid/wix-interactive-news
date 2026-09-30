// Assets for the 9:16 (1080x1920) version of the subtitled cut:
//   page.png     the static page: red paper, the department logo and the
//                title above the picture band, brush rules framing the band
//   L##.png      one bilingual subtitle card per narration line, set larger
//                for a phone screen, shown below the picture band
//   layout.json  band positions shared with vertical.py
//
//   node vertical_assets.mjs <subs_dir> <out_dir>
// subs_dir is build/subs_<cut>; its cues.json holds the text and timing.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [subsRel, outRel] = process.argv.slice(2);
const subsDir = path.resolve(subsRel), outDir = path.resolve(outRel);
fs.mkdirSync(outDir, { recursive: true });

// The whole 16:9 picture is kept: scaled to the page width it is 1080x608.
const LAYOUT = { w: 1080, h: 1920, video_y: 656, video_h: 608, sub_y: 1300, sub_h: 440 };
fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(LAYOUT, null, 1));
const url = (p) => 'file://' + path.join(HERE, p);

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });

// ---------------------------------------------------------------- page
const { w: W, h: H, video_y: VY, video_h: VH } = LAYOUT;
const pageHtml = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('../assets/fonts.css')}">
<style>html,body{margin:0;background:#000}</style>
<script src="${url('lib/core.js')}"></script><script src="${url('lib/nature.js')}"></script>
<script src="${url('lib/logo_data.js')}"></script><script src="${url('lib/props.js')}"></script>
</head><body>
<svg id="page" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="halo-gold"><stop offset="0" stop-color="#ffe3a0" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffd07a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffc060" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#a3171e"/>
  <g id="content"></g>
  <image href="${url('paper_v.png')}" x="0" y="0" width="${W}" height="${H}" style="mix-blend-mode: overlay" opacity="0.85"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg></body></html>`;
const pagePath = path.join(outDir, 'page.html');
fs.writeFileSync(pagePath, pageHtml);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + pagePath);
const title = '世新大學新聞系的武功秘笈';
const titleEn = 'The Secret Manual of Shih Hsin University’s Department of Journalism';
const fontsOk = await page.evaluate(async ([title, titleEn, VY, VH]) => {
  await document.fonts.load('400 64px "Iansui"', title);
  await document.fonts.load('italic 500 28px "Cormorant Garamond"', titleEn);
  await document.fonts.ready;
  const K = window.K, PR = window.PROPS, N = window.N;
  K.R.pal = K.PALETTES.day;
  const d = new K.Builder();
  N.cloud(d, 160, 150, 0.5, { seed: 19 });
  N.cloud(d, 950, 378, 0.44, { seed: 27 });
  PR.emblem(d, [540, 282], 116, { seed: 540 });
  K.text(d, title, 540, 522, { size: 64, weight: 700, spacing: 4 });
  K.text(d, titleEn, 540, 574, { font: "'Cormorant Garamond', serif", italic: true, weight: 500, size: 28, opacity: 0.9 });
  // brush rules above and below the picture band
  K.stroke(d, [[34, VY - 22], [1046, VY - 22]], { w: 3.4, seed: 901, taperIn: 40, taperOut: 40 });
  K.stroke(d, [[34, VY + VH + 22], [1046, VY + VH + 22]], { w: 3.4, seed: 902, taperIn: 40, taperOut: 40 });
  document.getElementById('content').innerHTML = d.str();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return document.fonts.check('400 64px "Iansui"', title) && document.fonts.check('italic 500 28px "Cormorant Garamond"', titleEn);
}, [title, titleEn, VY, VH]);
await page.locator('#page').screenshot({ path: path.join(outDir, 'page.png') });
if (errors.length || !fontsOk) throw new Error('page: ' + (errors.join('; ') || 'fonts not ready'));

// --------------------------------------------------------------- cards
// Chinese lines longer than 14 full-width characters break at their natural
// pause (the full-width space, or after a colon), choosing the most balanced
// split; the English line wraps on words, balanced by the browser.
const cues = JSON.parse(fs.readFileSync(path.join(subsDir, 'cues.json'), 'utf8'));
const unit = (c) => (/[\x00-\x7f]/.test(c) ? 0.55 : 1);
const width = (s) => Array.from(s).reduce((a, c) => a + unit(c), 0);
function breakZh(s, max = 14) {
  if (width(s) <= max) return [s];
  const ch = Array.from(s);
  let best = null;
  ch.forEach((c, i) => {
    if (c !== '　' && c !== '：') return;
    const a = ch.slice(0, c === '　' ? i : i + 1).join(''), b = ch.slice(i + 1).join('');
    const score = Math.max(width(a), width(b));
    if (b && (!best || score < best.score)) best = { score, lines: [a, b] };
  });
  return best ? best.lines : [s];
}
const cardHtml = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('../assets/fonts.css')}">
<style>
html,body{margin:0;background:transparent}
#band{width:${W}px;height:${LAYOUT.sub_h}px;display:flex;align-items:flex-start;justify-content:center}
#card{margin-top:20px;max-width:1000px;box-sizing:border-box;padding:18px 36px 22px;border-radius:26px;text-align:center;
  background:radial-gradient(120% 140% at 50% 50%, rgba(22,6,6,0.50) 55%, rgba(22,6,6,0.30) 100%);
  box-shadow:0 0 34px 16px rgba(22,6,6,0.28)}
#zh{font-family:'Iansui','Noto Sans CJK TC',serif;font-weight:400;-webkit-text-stroke:0.7px #fff6ea;font-size:58px;line-height:1.3;white-space:nowrap;color:#fff6ea;letter-spacing:2px;
  text-shadow:0 2px 6px rgba(0,0,0,0.55)}
#en{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;font-size:38px;line-height:1.22;color:#f6e6cc;margin-top:8px;letter-spacing:0.3px;
  text-wrap:balance;text-shadow:0 2px 5px rgba(0,0,0,0.55)}
</style></head><body><div id="band"><div id="card"><div id="zh"></div><div id="en"></div></div></div></body></html>`;
const cardPath = path.join(outDir, 'card.html');
fs.writeFileSync(cardPath, cardHtml);
const cp = await browser.newPage({ viewport: { width: W, height: LAYOUT.sub_h }, deviceScaleFactor: 1 });
await cp.goto('file://' + cardPath);
const allZh = cues.map((c) => c.zh).join('');
await cp.evaluate(async (txt) => {
  await document.fonts.load('400 58px "Iansui"', txt);
  await document.fonts.load('italic 600 38px "Cormorant Garamond"', 'The Secret Manual');
  await document.fonts.ready;
}, allZh);
const report = [];
for (const c of cues) {
  const lines = breakZh(c.zh);
  const h = await cp.evaluate(([lines, en]) => {
    const zh = document.getElementById('zh');
    zh.textContent = '';
    lines.forEach((l, i) => { if (i) zh.appendChild(document.createElement('br')); zh.appendChild(document.createTextNode(l)); });
    document.getElementById('en').textContent = en;
    const r = document.getElementById('card').getBoundingClientRect();
    return [Math.round(r.height), Math.round(zh.getBoundingClientRect().height / (58 * 1.3)), zh.scrollWidth <= zh.clientWidth + 1];
  }, [lines, c.en]);
  if (h[0] + 20 > LAYOUT.sub_h) throw new Error(`card ${c.id} too tall (${h[0]} px)`);
  if (!h[2] || h[1] !== lines.length) throw new Error(`card ${c.id}: Chinese line does not fit`);
  await cp.locator('#band').screenshot({ path: path.join(outDir, c.id + '.png'), omitBackground: true });
  report.push({ id: c.id, zh: lines, zhRows: h[1], cardHeight: h[0] });
}
const ok = await cp.evaluate((txt) => document.fonts.check('400 58px "Iansui"', txt), allZh);
await browser.close();
fs.writeFileSync(path.join(outDir, 'cards.json'), JSON.stringify(report, null, 1));
console.log(`page + ${cues.length} cards, fonts ok=${ok && fontsOk} -> ${outDir}`);
if (!ok) process.exit(1);
