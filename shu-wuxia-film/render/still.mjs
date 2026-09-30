// Render preview stills.
//   node still.mjs test <name> <t> <out.png> [palette]
//   node still.mjs frames <timeline.json> <outdir> <t1,t2,...>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));

async function openPage() {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(HERE, 'index.html'));
  await page.evaluate(() => window.fontsReady());
  return { browser, page };
}

async function shoot(page, out) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const client = await page.context().newCDPSession(page);
  const r = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
  await client.detach();
}

const [mode, ...args] = process.argv.slice(2);
const { browser, page } = await openPage();
try {
  if (mode === 'test') {
    const [name, t, out, pal] = args;
    await page.evaluate(([n, tt, p]) => window.renderTest(n, tt, p), [name, parseFloat(t), pal || 'day']);
    await shoot(page, out);
    console.log('wrote', out);
  } else if (mode === 'frames') {
    const [tlPath, outdir, times] = args;
    const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
    await page.evaluate((x) => window.setupTimeline(x), tl);
    await page.evaluate((txt) => window.preloadText(txt), tl.texts || []);
    fs.mkdirSync(outdir, { recursive: true });
    for (const ts of times.split(',')) {
      const t = parseFloat(ts);
      const ids = await page.evaluate((tt) => window.renderAt(tt), t);
      const out = path.join(outdir, `t${t.toFixed(2).padStart(7, '0')}.png`);
      await shoot(page, out);
      console.log('wrote', out, ids);
    }
  }
} finally {
  await browser.close();
}
