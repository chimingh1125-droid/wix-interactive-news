// Production renderer: every frame is fully built and painted before it is
// captured, then streamed losslessly (RGB) into ffmpeg.
//
//   node render.mjs <timeline.json> <out_dir> [workers=4]
//
// Each worker is its own Chromium instance rendering a contiguous chunk of
// frames into chunk_NN.mkv; chunks are concatenated into master.mkv. A
// per-frame log (render time, active scenes, PNG size) is written for QA.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const [tlPath, outDir, workersArg] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const N = parseInt(workersArg || '4', 10);
fs.mkdirSync(outDir, { recursive: true });

function pngSize(buf) {
  // IHDR width/height (bytes 16..23)
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function worker(idx, f0, f1) {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(HERE, 'index.html'));
  await page.evaluate(() => window.fontsReady());
  await page.evaluate((x) => window.setupTimeline(x), tl);
  const ok = await page.evaluate((txt) => window.preloadText(txt), tl.texts || []);
  if (!ok) throw new Error('fonts not ready');
  const client = await page.context().newCDPSession(page);
  const out = path.join(outDir, `chunk_${String(idx).padStart(2, '0')}.mkv`);
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'veryfast', '-pix_fmt', 'rgb24', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const log = [];
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const s = Date.now();
    // build the frame, then wait two animation frames so layout + paint are
    // complete before capturing
    const ids = await page.evaluate((fr) => new Promise((res) => {
      const r = window.renderFrame(fr);
      requestAnimationFrame(() => requestAnimationFrame(() => res(r)));
    }), f);
    const shot = await client.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
    const buf = Buffer.from(shot.data, 'base64');
    const [w, h] = pngSize(buf);
    if (w !== 1920 || h !== 1080) throw new Error(`frame ${f}: bad size ${w}x${h}`);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    log.push({ f, ms: Date.now() - s, ids, bytes: buf.length });
    if ((f - f0) % 150 === 0) console.log(`[w${idx}] frame ${f}/${f1 - 1} ${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg exit ' + c)))));
  await browser.close();
  if (errors.length) console.log(`[w${idx}] page errors:`, errors.slice(0, 5));
  return { out, log, errors };
}

const total = tl.frames;
const per = Math.ceil(total / N);
const t0 = Date.now();
const jobs = [];
for (let i = 0; i < N; i++) {
  const a = i * per, b = Math.min(total, (i + 1) * per);
  if (a < b) jobs.push(worker(i, a, b));
}
const results = await Promise.all(jobs);
const list = path.join(outDir, 'chunks.txt');
fs.writeFileSync(list, results.map((r) => `file '${path.basename(r.out)}'`).join('\n') + '\n');
await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(outDir, 'master.mkv')], { stdio: 'inherit' });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed'))));
});
const log = results.flatMap((r) => r.log);
fs.writeFileSync(path.join(outDir, 'render_log.json'), JSON.stringify({ frames: total, fps: tl.fps, seconds: (Date.now() - t0) / 1000, errors: results.flatMap((r) => r.errors), log }));
console.log(`done: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.join(outDir, 'master.mkv')}`);
