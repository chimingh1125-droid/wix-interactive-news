// 逐格渲染 index.html 並透過 ffmpeg 合成 MP4（1080x1920, 30fps + beat.wav）
// 用法：node render.mjs [ffmpeg 路徑]
// 以本機 HTTP 伺服器載入頁面，照片才不會讓 canvas 被標記為跨來源而無法匯出。
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.argv[2] || "ffmpeg";
const FPS = 30;
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav" };

const server = createServer(async (req, res) => {
  try {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(dir)) throw new Error("forbidden");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render`);
await page.evaluate(() => Promise.all([document.fonts.ready, window.ready]));
const duration = await page.evaluate(() => window.DURATION);
const total = Math.round(duration * FPS);

const ff = spawn(ffmpeg, [
  "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-i", path.join(dir, "beat.wav"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
  "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
  path.join(dir, "hsu-chih-ming.mp4"),
], { stdio: ["pipe", "inherit", "inherit"] });

for (let f = 0; f < total; f++) {
  const b64 = await page.evaluate((t) => {
    window.renderAt(t);
    return document.getElementById("stage").toDataURL("image/png").split(",")[1];
  }, f / FPS);
  if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) console.log(`frame ${f}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
server.close();
console.log("done: hsu-chih-ming.mp4");
