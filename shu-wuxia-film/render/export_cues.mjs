// node export_cues.mjs <timeline.json> <out_cues.json>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [tlPath, out] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(HERE, 'index.html'));
await page.evaluate((x) => window.setupTimeline(x), tl);
const cues = await page.evaluate(() => window.exportCues());
fs.writeFileSync(out, JSON.stringify(cues, null, 1));
console.log(`${cues.length} cues -> ${out}`);
await browser.close();
