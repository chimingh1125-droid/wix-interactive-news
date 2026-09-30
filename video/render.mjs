// 逐格渲染 index.html 並透過 ffmpeg 合成 MP4（1080x1920, 30fps + beat.wav）
// 用法：node render.mjs [ffmpeg 路徑]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.argv[2] || "ffmpeg";
const FPS = 30;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + path.join(dir, "index.html") + "?render");
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const total = Math.round(duration * FPS);

const ff = spawn(ffmpeg, [
  "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
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
  if (f % 90 === 0) console.log(`frame ${f}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("done: hsu-chih-ming.mp4");
