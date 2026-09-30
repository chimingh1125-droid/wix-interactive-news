/* 12. End card: the department emblem draws itself, the 70th-anniversary
 * line 風華七十・傳世新章, a crane flies across, the seal is stamped. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeInOut, inv, add, stroke, shape, halo, text, camOpen } = K;

  function timing(S) {
    const l = SC.line(S, 'L23');
    return { emb0: 0.5, emb1: 2.3, word: 1.6, line0: l.t0 + 0.05, line1: l.t1 - 0.1, years: l.t1 + 0.1, seal: l.t1 + 0.55, src: l.t1 + 0.9 };
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = { x: 960, y: 540, z: lerp(1.0, 1.04, smooth(ts / S.dur)) };
    camOpen(d, cam, 0.3);
    N.cloud(d, 180 + ts * 14, 180, 0.8, { seed: 81, p: SC.dp(ts, 0.1, 1.2) });
    N.cloud(d, 1520 + ts * 10, 250, 0.7, { seed: 82, tailDir: 1, p: SC.dp(ts, 0.3, 1.4) });
    N.mountains(d, { peaks: [{ x: 150, h: 200, w: 420 }, { x: 750, h: 150, w: 380 }, { x: 1350, h: 190, w: 420 }, { x: 1900, h: 230, w: 400 }], base: 1090, seed: 141, p: SC.dp(ts, 0, 1.4), fill: R.pal.fillFar, w: 2.2, texture: 5, color: R.pal.soft });
    d.close();
    // a crane crossing the sky
    N.crane(d, lerp(-260, 2200, ts / S.dur), 150 + Math.sin(ts * 0.8) * 20, 1.25, ts, { rate: 2.6 });
    camOpen(d, cam, 1);
    PR.emblem(d, [960, 318], 158, { p: SC.dp(ts, tm.emb0, tm.emb1, (x) => x), glow: 0.35 * SC.dp(ts, tm.emb1 - 0.4, tm.emb1 + 0.6) });
    PR.wordmark(d, 960, 578, { size: 56, opacity: SC.dp(ts, tm.word, tm.word + 0.8) });
    FX.washBlob(d, [960, 728], 420, 70, { p: SC.dp(ts, tm.line0 - 0.3, tm.line0 + 0.4), seed: 27, opacity: 0.5 });
    FX.revealText(d, '風華七十・傳世新章', 960, 752, SC.dp(ts, tm.line0, tm.line1, (x) => x), { size: 72, color: R.pal.gold, glow: 0.5, spacing: 0.1 });
    const yo = SC.dp(ts, tm.years, tm.years + 0.7);
    if (yo > 0) text(d, '1956 — 2026', 960, 830, { font: "'Cormorant Garamond', serif", weight: 600, size: 40, color: R.pal.gold, opacity: yo, spacing: 6 });
    PR.seal(d, [1370, 728], 70, '世新', { p: SC.dp(ts, tm.seal, tm.seal + 0.35), fill: R.pal.line, ink: R.pal.bg, seed: 828 });
    const so = SC.dp(ts, tm.src, tm.src + 0.8);
    if (so > 0) {
      text(d, '資料來源：世新大學校史與沿革、世新大學新聞學系、舍我紀念館、國家文化記憶庫、世新大學小世界', 960, 985, { size: 22, color: R.pal.line, opacity: 0.75 * so, spacing: 1 });
      text(d, 'Hand-drawn line animation · original score · narration by Kokoro TTS', 960, 1020, { font: "'Cormorant Garamond', serif", italic: true, size: 22, opacity: 0.65 * so });
    }
    d.close();
    N.motes(d, ts, { n: 18, seed: 151 });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'windSoft', gain: 0.35, dur: S.dur },
      { t: 1.2, sfx: 'craneCall', gain: 0.5, pan: -0.5 },
      { t: tm.emb0, sfx: 'shimmer', gain: 0.4, dur: tm.emb1 - tm.emb0 },
      { t: tm.seal, sfx: 'sealStamp', gain: 0.8, pan: 0.35 },
    ];
  }

  G.SCENES.endcard = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
