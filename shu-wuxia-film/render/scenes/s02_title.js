/* 2. Title card. Wuxia event: a sword-light slash rips across the paper,
 * its wind throws the secret manual open and flips the pages; the title is
 * written in and the department emblem draws itself. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeInOut, inv, add, stroke, shape, halo, text, camOpen } = K;

  function timing(S) {
    const l = SC.first(S);
    return { slash: 0.45, open0: l.t0 - 1.05, flip0: l.t0 - 0.2, title0: l.t0 + 0.05, title1: l.t0 + 1.5, en: l.t0 + 1.6, seal: l.t0 + 2.2 };
  }

  const vcol = (str, x, y0, size, extra = {}) => Array.from(str).map((ch, i) => Object.assign({ t: ch, x, y: y0 + i * 0.19, size, weight: 700 }, extra));

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = { x: 960, y: 540 + 10 * smooth(ts / S.dur), z: lerp(1.0, 1.05, smooth(ts / S.dur)) };
    camOpen(d, cam, 0.3);
    N.cloud(d, 180 + ts * 16, 170, 0.8, { seed: 5, p: SC.dp(ts, 0.1, 1.2) });
    N.cloud(d, 1500 - ts * 10, 300, 0.7, { seed: 9, tailDir: 1, p: SC.dp(ts, 0.3, 1.4) });
    N.mountains(d, { peaks: [{ x: 120, h: 230, w: 420 }, { x: 640, h: 170, w: 380 }, { x: 1300, h: 210, w: 420 }, { x: 1850, h: 250, w: 400 }], base: 1080, seed: 31, p: SC.dp(ts, 0.0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 6, color: R.pal.soft });
    d.close();
    camOpen(d, cam, 1);
    // manual on the ground plane
    const flip = clamp((ts - tm.flip0) / 0.5, 0, 2.0);
    PR.book(d, [960, 738], 470, 262, {
      p: SC.dp(ts, 0.15, 0.9), open: SC.dp(ts, tm.open0, tm.open0 + 0.8, easeInOut), title: '武功秘笈', flip,
      pageText: (i, side) => {
        if (i >= 2 && !side) return vcol('手腦並用', 0.5, 0.2, 44);
        if (i >= 1 && side) return vcol('德智兼修', 0.5, 0.2, 44);
        return [{ t: '—', x: 0.5, y: 0.5, size: 20, op: 0.4 }];
      },
    });
    // title
    FX.washBlob(d, [960, 430], 770, 112, { p: SC.dp(ts, tm.title0 - 0.3, tm.title0 + 0.6), seed: 23, opacity: 0.55 });
    FX.revealText(d, '世新大學新聞系的武功秘笈', 960, 465, SC.dp(ts, tm.title0, tm.title1, (x) => x), { size: 100, glow: 0.55, spacing: 0.06 });
    const enOp = SC.dp(ts, tm.en, tm.en + 0.8);
    if (enOp > 0) text(d, 'The Secret Manual of Shih Hsin University’s Department of Journalism', 960, 540, { font: "'Cormorant Garamond', serif", italic: true, weight: 500, size: 36, opacity: enOp, spacing: 0.5 });
    PR.seal(d, [1690, 380], 78, '秘笈', { p: SC.dp(ts, tm.seal, tm.seal + 0.35), fill: R.pal.line, ink: R.pal.bg, seed: 824 });
    // emblem
    PR.emblem(d, [960, 190], 104, { p: SC.dp(ts, tm.open0 + 0.2, tm.title0 + 1.2, (x) => x), glow: 0.35 * SC.dp(ts, tm.title0, tm.title0 + 1) });
    // sword-light slash across the paper, with its wind
    FX.slashArc(d, [960, 1500], 1330, -152, -28, inv(tm.slash, tm.slash + 0.8, ts), { w: 64, seed: 5 });
    FX.burst(d, [1810, 640], 180, inv(tm.slash + 0.45, tm.slash + 1.1, ts), { seed: 7 });
    FX.speedLines(d, [0, 120, 1920, 520], 1, ts, { n: 10, opacity: 0.5 * (1 - smooth(inv(tm.slash + 0.4, tm.slash + 1.4, ts))) * SC.dp(ts, tm.slash, tm.slash + 0.2), seed: 3 });
    d.close();
    N.leaves(d, ts, { n: 9, seed: 17, area: [-100, 1900, -60, 1120], drift: 320 });
    N.motes(d, ts, { n: 14, seed: 4 });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0.0, sfx: 'windSoft', gain: 0.4, dur: S.dur },
      { t: tm.slash, sfx: 'swordSwing', gain: 1.0, pan: -0.4 },
      { t: tm.slash + 0.3, sfx: 'metalRing', gain: 0.55, pan: 0.5 },
      { t: tm.open0, sfx: 'bookOpen', gain: 0.7 },
      { t: tm.flip0 + 0.1, sfx: 'pageFlip', gain: 0.6 },
      { t: tm.flip0 + 0.5, sfx: 'pageFlip', gain: 0.6 },
      { t: tm.title0, sfx: 'titleHit', gain: 0.5 },
      { t: tm.seal, sfx: 'sealStamp', gain: 0.8, pan: 0.4 },
    ];
  }

  G.SCENES.title = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
