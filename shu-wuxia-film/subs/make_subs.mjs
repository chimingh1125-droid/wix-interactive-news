// Bilingual subtitles: .srt + transparent PNG cards for burning in.
//   node make_subs.mjs <timeline.json> <out_dir>
// Card: Chinese on top (LXGW WenKai TC), English italic below (Cormorant
// Garamond), centred at the bottom on a soft translucent rounded box.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [tlPath, outRel] = process.argv.slice(2);
const outDir = path.resolve(outRel);
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// subtitle convention: no sentence-final full stop, commas become spaces
const zhSub = (s) => s.replace(/。$/, '').replace(/[，、]/g, '　');
const fmt = (t) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};

const lines = [];
for (const sc of tl.scenes) for (const ln of sc.lines) lines.push({ ...ln, sceneEnd: sc.start + sc.dur });
lines.sort((a, b) => a.abs0 - b.abs0);
const cues = lines.map((ln, i) => {
  const next = lines[i + 1];
  let end = ln.abs1 + 0.35;
  if (next) end = Math.min(end, next.abs0 - 0.08);
  end = Math.min(end, ln.sceneEnd - 0.05);
  return { i: i + 1, id: ln.id, start: ln.abs0 - 0.05, end, zh: zhSub(ln.zh), en: ln.en };
});
const srt = cues.map((c) => `${c.i}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.zh}\n<i>${c.en}</i>\n`).join('\n');
fs.writeFileSync(path.join(outDir, 'subtitles.srt'), srt);
fs.writeFileSync(path.join(outDir, 'cues.json'), JSON.stringify(cues, null, 1));

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${path.join(HERE, '..', 'assets', 'fonts.css')}">
<style>
html,body{margin:0;background:transparent}
#band{position:relative;width:1920px;height:300px;display:flex;align-items:flex-end;justify-content:center}
#card{margin-bottom:54px;max-width:1560px;padding:16px 46px 18px;border-radius:22px;text-align:center;
  background:radial-gradient(120% 140% at 50% 50%, rgba(22,6,6,0.50) 55%, rgba(22,6,6,0.30) 100%);
  box-shadow:0 0 34px 16px rgba(22,6,6,0.28)}
#zh{font-family:'LXGW WenKai TC','Noto Sans CJK TC',serif;font-weight:700;font-size:50px;line-height:1.25;color:#fff6ea;letter-spacing:2px;
  text-shadow:0 2px 6px rgba(0,0,0,0.55)}
#en{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;font-size:37px;line-height:1.2;color:#f6e6cc;margin-top:4px;letter-spacing:0.3px;
  text-shadow:0 2px 5px rgba(0,0,0,0.55)}
</style></head><body><div id="band"><div id="card"><div id="zh"></div><div id="en"></div></div></div></body></html>`;
const htmlPath = path.join(outDir, 'card.html');
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 300 }, deviceScaleFactor: 1 });
await page.goto('file://' + htmlPath);
const allZh = cues.map((c) => c.zh).join('');
await page.evaluate(async (txt) => {
  await document.fonts.load('700 50px "LXGW WenKai TC"', txt);
  await document.fonts.load('italic 600 37px "Cormorant Garamond"', 'The');
  await document.fonts.ready;
}, allZh);
for (const c of cues) {
  await page.evaluate(([zh, en]) => { document.getElementById('zh').textContent = zh; document.getElementById('en').textContent = en; }, [c.zh, c.en]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(outDir, `${c.id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 1920, height: 300 } });
}
const ok = await page.evaluate((txt) => document.fonts.check('700 50px "LXGW WenKai TC"', txt), allZh);
await browser.close();
console.log(`${cues.length} subtitle cards, fonts ok=${ok} -> ${outDir}`);
