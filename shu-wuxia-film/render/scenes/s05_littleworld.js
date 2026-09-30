/* 5. Little World (《小世界》, March 1957). Wuxia event: disciples use
 * lightness kung fu (輕功) to leap across the town's rooftops carrying the
 * paper, while the press prints and sheets fly off like birds. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, inv, add, sub, mul, mix, stroke, shape, halo, text, camOpen, rnd, rrange } = K;

  const BASE = 830;
  const HOUSES = [[40, 300, 200], [380, 320, 180], [735, 300, 215], [1080, 330, 190], [1440, 300, 205], [1790, 320, 185], [2150, 300, 200]];
  const ridge = (hs) => { const [x, w, h] = hs; return [x + w / 2, BASE - h + 6 - 0.55 * h + 2]; };

  function timing(S) {
    const l8 = SC.line(S, 'L08'), l9 = SC.line(S, 'L09');
    const big0 = l8.t0 + 0.45, big1 = l8.t1 + 0.25;
    const jump0 = l9 ? l9.t0 - 0.2 : l8.t1 + 0.35;
    return { big0, big1, jump0 };
  }

  function jumper(d, ts, k, t0, S) {
    const hop = 0.62, H = 170;
    const u = (ts - t0) / hop;
    if (u < -0.2) return;
    const pts = [[-160, ridge(HOUSES[0])[1] + 40]].concat(HOUSES.map(ridge));
    const i = clamp(Math.floor(u), 0, pts.length - 2), f = clamp(u - i);
    const a = pts[i], b = pts[i + 1];
    const feet = [lerp(a[0], b[0], f), lerp(a[1], b[1], f) - Math.sin(Math.PI * f) * 130];
    const air = Math.sin(Math.PI * f);
    const pose = {
      root: [feet[0], feet[1] - 0.49 * H + air * 10], H, dir: 1, p: 1, wind: 0.9,
      lean: 16 + air * 6, hp1: lerp(30, 80, air), kn1: lerp(40, 110, air), hp2: lerp(-30, -15, air), kn2: lerp(30, 80, air),
      sh1: lerp(40, 110, air), el1: 30, sh2: -60 - air * 20, el2: 20,
    };
    const J = F.figure(d, pose, { hair: 'bun', ribbon: true, seed: 500 + k * 13, detail: 'high' }, ts);
    PR.newspaper(d, add(J.A1.W, [22, -10]), 60, 44, { ang: -20 + air * 20, bend: 0.3 * Math.sin(ts * 12 + k), seed: 720 + k, title: '小世界', lw: 1.6 });
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const panEnd = Math.min(S.dur, tm.jump0 + 4.5);
    const cam = SC.cam([[0, { x: 940, y: 540, z: 1.03 }], [tm.jump0, { x: 980, y: 540, z: 1.03 }], [panEnd, { x: 1260, y: 540, z: 1.0 }]], ts);
    camOpen(d, cam, 0.25);
    N.cloud(d, 300 + ts * 12, 140, 0.8, { seed: 23, p: SC.dp(ts, 0.1, 1.2) });
    N.cloud(d, 1600 + ts * 8, 200, 0.7, { seed: 24, tailDir: 1, p: SC.dp(ts, 0.3, 1.3) });
    N.mountains(d, { peaks: [{ x: 300, h: 260, w: 460 }, { x: 1100, h: 310, w: 480 }, { x: 1900, h: 280, w: 460 }, { x: 2500, h: 300, w: 460 }], base: 760, seed: 71, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 8, x1: 2800 });
    d.close();
    camOpen(d, cam, 1);
    // houses along the street
    HOUSES.forEach((hs, i) => A.house(d, hs[0], BASE, hs[1], hs[2], { seed: 400 + i * 7, p: SC.dp(ts, 0.1 + i * 0.12, 1.1 + i * 0.12), lit: i % 3 === 1 }));
    // lantern strings between the houses
    for (let i = 0; i < HOUSES.length - 1; i++) {
      const a = [HOUSES[i][0] + HOUSES[i][1] - 20, BASE - HOUSES[i][2] + 30], b = [HOUSES[i + 1][0] + 20, BASE - HOUSES[i + 1][2] + 30];
      const mid = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 34];
      const rope = K.qbez(a, mid, b, 10);
      stroke(d, rope, { p: SC.dp(ts, 0.8, 1.6), w: 1.4, brush: false, seed: 610 + i, color: R.pal.soft });
      A.lantern(d, K.pointAt(rope, 0.5), 20, ts + i, { p: SC.dp(ts, 1.0, 1.8), seed: 620 + i });
    }
    // street
    shape(d, [[-200, BASE], [2600, BASE], [2600, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.8), fill: R.pal.fillNear, w: 3, seed: 91, start: 0 });
    for (let i = 0; i < 12; i++) stroke(d, [[i * 220 - 100, BASE + 70 + (i % 2) * 60], [i * 220 + 10, BASE + 68 + (i % 2) * 60]], { p: SC.dp(ts, 0.5, 1.1), w: 2, seed: 92 + i, color: R.pal.soft });
    // rooftop runners
    for (let k = 0; k < 3; k++) jumper(d, ts, k, tm.jump0 + k * 0.38, S);
    d.close();
    // foreground: the printing press and flying sheets
    camOpen(d, cam, 1.08);
    A.printingPress(d, [300, 930], 150, ts, { p: SC.dp(ts, 0.2, 1.4), label: '小世界' });
    for (let k = 0; k < 16; k++) {
      const t0 = 0.9 + k * 0.55;
      const age = ts - t0;
      if (age < 0 || age > 3.4) continue;
      const u = age / 3.4;
      const endX = 1000 + rnd(31, k) * 1300, endY = -120;
      const pos = K.pointAt(K.bez([520, 930], [760, 900], [endX - 400, 520], [endX, endY], 20), easeIn(u) * 0.3 + u * 0.7);
      PR.newspaper(d, pos, 92, 64, { ang: -25 + Math.sin(ts * 3 + k) * 20, bend: Math.sin(ts * 9 + k) * 0.7, seed: 740 + k, title: '小世界', lw: 1.8 });
    }
    d.close();
    // the first issue unfolds in the air
    const bp = SC.dp(ts, tm.big0, tm.big0 + 0.6, easeOut);
    const away = SC.dp(ts, tm.big1, tm.big1 + 0.9, easeIn);
    if (bp > 0 && away < 1) {
      const c = [lerp(900, 1120, bp) + away * 900, lerp(560, 400, bp) - away * 600];
      const s = lerp(0.25, 1, bp) * (1 - away * 0.7);
      halo(d, c, 380 * s, 'gold', 0.3 * bp * (1 - away));
      PR.newspaper(d, c, 560 * s, 400 * s, { ang: lerp(-25, -3, bp) + away * 25, bend: away * Math.sin(ts * 10) * 0.6, title: '小世界', date: '1957.3', photo: true, seed: 760, lw: 2.8, p: SC.dp(ts, tm.big0, tm.big0 + 1.0) });
    }
  }

  function cues(S) {
    const tm = timing(S);
    const c = [{ t: 0.4, sfx: 'pressLoop', gain: 0.5, pan: -0.6, dur: S.dur - 0.4 }, { t: 0, sfx: 'townAmb', gain: 0.3, dur: S.dur }];
    for (let k = 0; k < 16; k++) { const t = 0.9 + k * 0.55; if (t < S.dur) c.push({ t, sfx: 'paperFlutter', gain: 0.3, pan: -0.3 + (k % 3) * 0.3 }); }
    c.push({ t: tm.big0, sfx: 'bigPaper', gain: 0.8 });
    c.push({ t: tm.big1, sfx: 'whooshSoft', gain: 0.5, pan: 0.5 });
    for (let k = 0; k < 3; k++) for (let h = 0; h < 7; h++) {
      const t = tm.jump0 + k * 0.38 + h * 0.62;
      if (t < S.dur - 0.1) { c.push({ t, sfx: 'jump', gain: 0.32, pan: -0.6 + h * 0.2 }); c.push({ t: t + 0.6, sfx: 'tap', gain: 0.28, pan: -0.5 + h * 0.2 }); }
    }
    return c;
  }

  G.SCENES.littleworld = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
