/* 3. Founding, 1956 (開山立派). Wuxia event: the elder master (the founder
 * as a sect master) strikes a boulder with his palm; it splits apart to
 * reveal the gateway of the new school; the first disciples march in. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, inv, add, sub, mul, rot, stroke, shape, halo, text, camOpen, noise1, rnd, DEG } = K;

  const GROUND = 900, CX = 1060;

  function timing(S) {
    const l4 = SC.line(S, 'L04');
    const strike = l4.t1 + 0.3;
    const l5 = SC.line(S, 'L05');
    return { walk0: 0.3, walk1: 2.3, wind0: strike - 0.95, strike, n63: l5 ? l5.t0 + 3.2 : null, year: l4.t0 + 0.1 };
  }

  // boulder as two halves split along a jagged crack
  function boulderHalves() {
    const left = [], right = [], crack = [];
    const hw = 340, hh = 480;
    for (let a = 180; a <= 270; a += 10) { const r = 1 + 0.06 * noise1(a * 0.1, 3); left.push([CX + Math.cos(a * DEG) * hw * r, GROUND + Math.sin(a * DEG) * hh * r]); }
    for (let a = 270; a <= 360; a += 10) { const r = 1 + 0.06 * noise1(a * 0.1, 5); right.push([CX + Math.cos(a * DEG) * hw * r, GROUND + Math.sin(a * DEG) * hh * r]); }
    for (let i = 0; i <= 8; i++) crack.push([CX + (i % 2 ? 22 : -18) * (i > 0 && i < 8 ? 1 : 0), GROUND - hh + hh * i / 8]);
    return { left: left.concat(crack.slice(1)), right: crack.slice().reverse().concat(right.slice(1)), crack };
  }
  const B = boulderHalves();

  function draw(d, ts, S) {
    const tm = timing(S);
    let cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [S.dur, { x: 1010, y: 560, z: 1.07 }]], ts);
    cam = SC.shake(cam, ts, tm.strike + 0.05, 16, 0.6);
    camOpen(d, cam, 0.2);
    N.cloud(d, 300 + ts * 12, 200, 0.9, { seed: 13, p: SC.dp(ts, 0.1, 1.2) });
    N.cloud(d, 1250 + ts * 8, 150, 0.8, { seed: 14, tailDir: 1, p: SC.dp(ts, 0.3, 1.4) });
    d.close();
    camOpen(d, cam, 0.4);
    N.mountains(d, { peaks: [{ x: 180, h: 560, w: 520 }, { x: 760, h: 300, w: 380 }, { x: 1350, h: 330, w: 380 }, { x: 1800, h: 580, w: 540 }], base: 860, seed: 41, p: SC.dp(ts, 0, 1.4), fill: R.pal.fillFar, w: 2.4 });
    N.mist(d, { y: 760, h: 110, amp: 8, seed: 6, opacity: SC.dp(ts, 0.5, 1.5), fill: R.pal.fillFar }, ts);
    d.close();
    camOpen(d, cam, 1);
    // ground
    shape(d, [[-200, GROUND], [2120, GROUND], [2120, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.8), fill: R.pal.fillNear, w: 3, seed: 51, start: 0 });
    for (let i = 0; i < 9; i++) stroke(d, [[i * 240 - 60, GROUND + 60 + (i % 3) * 50], [i * 240 + 40, GROUND + 58 + (i % 3) * 50]], { p: SC.dp(ts, 0.4, 1.0), w: 2, seed: 52 + i, color: R.pal.soft });
    // the gate (behind the boulder)
    const rev = SC.dp(ts, tm.strike + 0.3, tm.strike + 1.4);
    A.paifang(d, CX, GROUND, 560, 470, { plaque: '世新', p: SC.dp(ts, 0.3, 1.6) });
    // vertical board with the school's name
    const bp = rev;
    if (bp > 0) {
      shape(d, K.rectPts(1405, GROUND - 440, 74, 440), { p: bp, w: 2.8, seed: 61, fill: R.pal.fillNear });
      FX.revealText(d, '世界新聞職業學校', 1442, GROUND - 420, SC.dp(ts, tm.strike + 0.7, tm.strike + 2.2, (x) => x), { size: 46, vertical: true, anchor: 'start', spacing: 0.08, tip: false });
    }
    // boulder halves
    const sp = SC.dp(ts, tm.strike + 0.1, tm.strike + 1.2, easeOut);
    const crackP = SC.dp(ts, tm.strike, tm.strike + 0.15);
    const halves = [[B.left, -1], [B.right, 1]];
    for (const [poly, side] of halves) {
      const pivot = [CX + side * 330, GROUND];
      const ang = side * 16 * sp * DEG;
      const off = [side * 470 * sp, 40 * sp * sp];
      const pts = poly.map((q) => add(K.rotAbout(q, pivot, ang), off));
      shape(d, pts, { p: SC.dp(ts, 0.2, 1.4), w: 3.4, seed: side > 0 ? 71 : 72, fill: R.pal.fillMid });
      // rock texture
      for (let k = 0; k < 4; k++) {
        const a = [CX + side * (60 + k * 60), GROUND - 120 - k * 70], b = [a[0] + side * 50, a[1] + 40];
        stroke(d, [a, b].map((q) => add(K.rotAbout(q, pivot, ang), off)), { p: SC.dp(ts, 0.8, 1.6), w: 2, seed: 73 + k + side * 10, color: R.pal.soft });
      }
    }
    if (crackP > 0 && sp < 0.05) stroke(d, B.crack, { p: crackP, w: 4, seed: 79, color: R.pal.gold });
    FX.dust(d, [CX, GROUND - 20], tm.strike + 0.15, ts, { n: 9, dist: 380, size: 70, a0: 180, spread: 180, life: 1.8 });
    FX.sparks(d, [CX, GROUND - 260], tm.strike + 0.05, ts, { n: 22, speed: 900, color: R.pal.line, seed: 31 });
    FX.burst(d, [CX, GROUND - 260], 320, inv(tm.strike, tm.strike + 0.6, ts), { seed: 9 });
    // master
    const H = 390, baseY = GROUND - 0.49 * H;
    let pose;
    if (ts < tm.walk1) {
      const x = lerp(-200, 430, inv(tm.walk0, tm.walk1, ts));
      pose = Object.assign(F.walkPose(x / 240, 0.8), { root: [x, baseY], wind: 0.3 });
    } else {
      pose = Object.assign(F.poseAt([
        [tm.walk1, { sh1: 8, el1: 20, sh2: -8, el2: 14, wind: 0.3 }],
        [tm.wind0, { sh1: 8, el1: 20, sh2: -8, el2: 14, wind: 0.3 }],
        [tm.wind0 + 0.6, { lean: -6, sh1: -35, el1: 120, sh2: -20, el2: 30, hp1: 25, kn1: 30, hp2: -20, kn2: 10, wind: 0.6 }],
        [tm.strike, { lean: 16, sh1: 88, el1: 0, sh2: -45, el2: 20, hp1: 42, kn1: 42, hp2: -30, kn2: 4, wind: 1.0 }, easeIn],
        [tm.strike + 1.4, { lean: 8, sh1: 70, el1: 10, sh2: -30, el2: 20, hp1: 30, kn1: 30, hp2: -25, kn2: 6, wind: 0.6 }],
        [tm.strike + 3.0, { lean: 2, sh1: 10, el1: 30, sh2: -10, el2: 14, hp1: 8, kn1: 6, hp2: -8, kn2: 6, wind: 0.4 }],
      ], ts), { root: [430 + 30 * SC.dp(ts, tm.wind0 + 0.6, tm.strike), baseY + 18 * SC.dp(ts, tm.wind0, tm.strike) - 10 * SC.dp(ts, tm.strike + 1.4, tm.strike + 3)] });
    }
    const J = F.figure(d, Object.assign({ H, dir: 1, p: SC.dp(ts, 0.3, 1.2) }, pose), { hair: 'bun', hairColor: R.pal.line, beard: 'long', ribbon: false, long: true, hem: 0.4, seed: 21, hand1: ts > tm.wind0 ? 'palm' : 'fist' }, ts);
    FX.qiSwirl(d, J.A1.W, 70, ts, { p: SC.dp(ts, tm.wind0 + 0.2, tm.wind0 + 0.6) * (1 - SC.dp(ts, tm.strike, tm.strike + 0.2)) });
    FX.streak(d, J.A1.W, [CX - 40, GROUND - 260], inv(tm.strike - 0.06, tm.strike + 0.35, ts), { w: 26 });
    // disciples marching in
    const m0 = tm.strike + 1.0;
    if (ts > m0 - 0.2) {
      for (let r = 2; r >= 0; r--) {
        for (let c = 0; c < 7; c++) {
          const k = r * 7 + c;
          const h = 104 + r * 14;
          const tx = 1200 + c * 92 - r * 30 + (r % 2) * 40, ty = GROUND + 36 + r * 52;
          const t0 = m0 + k * 0.07, t1 = t0 + 1.8;
          const u = inv(t0, t1, ts);
          if (u <= 0) continue;
          const x = lerp(2080 + r * 40, tx, easeOut(u));
          const moving = u < 1;
          const pose = moving ? F.walkPose(x / 90, 1) : { hp1: 4, kn1: 2, hp2: -4, kn2: 2, sh1: 6, el1: 50, sh2: -4, el2: 50 };
          F.figure(d, Object.assign({ root: [x, ty - 0.49 * h], H: h, dir: -1, p: 1, wind: 0.2 }, pose), { detail: 'low', ribbon: false, sash: false, seed: 300 + k }, ts);
        }
      }
    }
    // year stamp and the count of the first class
    FX.revealText(d, '一九五六', 1800, 110, SC.dp(ts, tm.year, tm.year + 1.2, (x) => x), { size: 70, vertical: true, anchor: 'start', color: R.pal.gold, spacing: 0.05, glow: 0.4 });
    const yo = SC.dp(ts, tm.year + 1.0, tm.year + 1.4);
    if (yo > 0) text(d, '年', 1800, 440, { size: 44, color: R.pal.gold, opacity: yo });
    if (tm.n63 !== null) {
      const np = SC.dp(ts, tm.n63, tm.n63 + 0.5);
      if (np > 0) {
        halo(d, [720, 300], 160, 'gold', 0.45 * np);
        text(d, '首批弟子', 720, 190, { size: 42, weight: 700, opacity: np, spacing: 8 });
        text(d, '63', 690, 355, { font: "'Cormorant Garamond', serif", weight: 600, size: lerp(210, 170, easeOut(np)), color: R.pal.gold, opacity: np });
        text(d, '人', 815, 350, { size: 64, weight: 700, color: R.pal.gold, opacity: np });
      }
    }
    d.close();
    N.leaves(d, ts, { n: 6, seed: 23, drift: 240 });
  }

  function cues(S) {
    const tm = timing(S);
    const c = [{ t: 0, sfx: 'windSoft', gain: 0.35, dur: S.dur }];
    for (let t = tm.walk0 + 0.2; t < tm.walk1; t += 0.5) c.push({ t, sfx: 'step', gain: 0.3, pan: -0.6 });
    c.push({ t: tm.wind0 + 0.1, sfx: 'qiCharge', gain: 0.7, dur: tm.strike - tm.wind0 });
    c.push({ t: tm.strike, sfx: 'palmStrike', gain: 1.0 });
    c.push({ t: tm.strike + 0.08, sfx: 'rockCrack', gain: 0.9 });
    c.push({ t: tm.strike + 0.35, sfx: 'rockCrumble', gain: 0.8 });
    c.push({ t: tm.strike + 0.9, sfx: 'flag', gain: 0.4, pan: 0.3 });
    c.push({ t: tm.strike + 1.1, sfx: 'march', gain: 0.45, pan: 0.5, dur: 2.4 });
    if (tm.n63 !== null) c.push({ t: tm.n63, sfx: 'chime', gain: 0.6, pan: 0.5 });
    return c;
  }

  G.SCENES.founding = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
