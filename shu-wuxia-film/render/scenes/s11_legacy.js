/* 11. Ending — seventy years; the last page is blank.
 * Wuxia event: at dawn, generations of disciples stream out of the tunnel;
 * the manual's pages flip through the years 1956…2026 and stop on a blank
 * page. The young swordsman lays down his sword, kneels, takes up the brush
 * and writes one golden stroke — which rises as sword-light into the sun. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG, rectPts, f1 } = K;

  const PATHY = 900, LEDGE = 1010;
  const HILL = { peaks: [{ x: 100, h: 320, w: 700 }, { x: 900, h: 260, w: 700 }, { x: 1700, h: 300, w: 760 }], base: 905, seed: 23, roughAmp: 8 };
  const BOOK = { c: [1170, 972], w: 380, h: 200 };
  const SUN = [1540, 0];

  function timing(S) {
    const l21 = SC.line(S, 'L21'), l22 = SC.line(S, 'L22');
    const flip0 = l21.t0 + 0.3, flip1 = l21.t1 + 0.1;
    const lay0 = l21.t1 + 0.35, lay1 = lay0 + 0.85;
    const write0 = l22.t0 + 1.9, write1 = write0 + 1.0;
    return { flip0, flip1, lay0, lay1, kneel1: lay1 + 0.6, brush: lay1 + 0.5, write0, write1, fly: write1 + 0.15, burst: write1 + 1.15 };
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = SC.cam([[0, { x: 960, y: 640, z: 1.02 }], [tm.write0 - 0.5, { x: 1060, y: 745, z: 1.1 }], [tm.fly + 0.2, { x: 1080, y: 730, z: 1.1 }], [S.dur, { x: 1180, y: 620, z: 1.04 }]], ts);
    // dawn sky: the sun rises behind the hills
    camOpen(d, cam, 0.2);
    const sy = lerp(640, 420, smooth(ts / S.dur));
    const glow = 0.5 + 0.5 * SC.dp(ts, tm.burst, tm.burst + 0.8);
    N.sun(d, [SUN[0], sy], 80, { p: SC.dp(ts, 0.2, 1.0), rays: true, glow }, ts);
    N.cloud(d, 380 + ts * 12, 200, 1.0, { seed: 71, p: SC.dp(ts, 0.2, 1.3) });
    N.cloud(d, 1000 + ts * 8, 130, 0.8, { seed: 72, tailDir: 1, p: SC.dp(ts, 0.4, 1.5) });
    for (let i = 0; i < 4; i++) N.bird(d, 1100 + ((ts * 60 + i * 120) % 900), 300 + (i % 2) * 40, 0.9, ts, { seed: 20 + i, p: SC.dp(ts, 1.4, 2.0) });
    d.close();
    camOpen(d, cam, 0.4);
    N.mountains(d, { peaks: [{ x: 200, h: 320, w: 420 }, { x: 800, h: 380, w: 440 }, { x: 1450, h: 280, w: 420 }, { x: 2000, h: 340, w: 420 }], base: 720, seed: 121, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 8 });
    d.close();
    camOpen(d, cam, 0.8);
    N.mountains(d, Object.assign({ p: SC.dp(ts, 0.1, 1.3), fill: R.pal.fillMid, w: 3, texture: 12 }, HILL));
    A.tunnel(d, 560, PATHY, 190, 230, { p: SC.dp(ts, 0.3, 1.6), plaque: '世新大學', plaqueW: 200 });
    shape(d, [[-300, PATHY - 4], [2400, PATHY - 4], [2400, PATHY + 24], [-300, PATHY + 24]], { p: SC.dp(ts, 0, 0.8), fill: R.pal.fillNear, w: 2.6, seed: 171, start: 0 });
    // generations of disciples walking out into the world
    for (let k = 0; k < 26; k++) {
      const t0 = 0.4 + k * 0.5;
      const age = ts - t0;
      if (age < 0) continue;
      const x = 560 + age * 105;
      if (x > 2300) continue;
      const h = 108 + rrange(181, k, -8, 12);
      const emerge = clamp(age / 0.6);
      d.open('opacity="' + emerge.toFixed(3) + '"');
      F.figure(d, Object.assign({ root: [x, PATHY + 8 - 0.49 * h], H: h, dir: 1, p: 1, wind: 0.25 }, F.walkPose(x / 88 + k * 0.3, 1)), { detail: 'low', ribbon: k % 3 === 0, sash: false, seed: 700 + k }, ts);
      if (k % 4 === 1) PR.newspaper(d, [x + 18, PATHY - 0.52 * h], 26, 20, { seed: 870 + k, lw: 1.2 });
      d.close();
    }
    N.river(d, { x0: -300, x1: 2400, y0: PATHY + 24, y1: 1200, seed: 3, speed: 36, p: SC.dp(ts, 0, 1.0) }, ts);
    d.close();
    // foreground ledge with the manual, the sword and the swordsman
    camOpen(d, cam, 1.0);
    shape(d, K.spline([[820, 1300], [860, LEDGE + 10], [1000, LEDGE - 6], [1500, LEDGE - 12], [1900, LEDGE - 4], [2300, LEDGE + 10], [2300, 1300]], 5), { p: SC.dp(ts, 0.2, 1.0), fill: R.pal.fillNear, w: 3, seed: 191 });
    N.grass(d, 900, LEDGE + 4, 60, { seed: 13, p: SC.dp(ts, 0.8, 1.4) }, ts);
    N.grass(d, 1860, LEDGE - 2, 70, { seed: 14, p: SC.dp(ts, 0.9, 1.5) }, ts);
    // flat stone and the book
    shape(d, [[BOOK.c[0] - 230, LEDGE - 4], [BOOK.c[0] - 210, BOOK.c[1] + 22], [BOOK.c[0] + 220, BOOK.c[1] + 18], [BOOK.c[0] + 240, LEDGE - 6]], { p: SC.dp(ts, 0.3, 1.1), w: 2.8, seed: 193, fill: R.pal.fillMid });
    const flip = lerp(0, 8, SC.dp(ts, tm.flip0, tm.flip1, (x) => x));
    const yearOf = (i) => (i >= 0 && i < 8 ? String(1956 + i * 10) : null);
    PR.book(d, [BOOK.c[0], BOOK.c[1] - BOOK.h / 2 + 18], BOOK.w, BOOK.h, {
      p: SC.dp(ts, 0.4, 1.2), open: 1, flip,
      pageText: (i, side) => {
        const y = yearOf(side ? i : i);
        if (side) return y ? [{ t: y, x: 0.5, y: 0.55, size: 40, font: "'Cormorant Garamond', serif", weight: 600, color: R.pal.gold }] : [];
        return y ? [{ t: y, x: 0.5, y: 0.55, size: 40, font: "'Cormorant Garamond', serif", weight: 600, color: R.pal.gold }] : [];
      },
    });
    // the golden stroke written on the last (blank) page
    const pageL = BOOK.c[0] + 40, pageR = BOOK.c[0] + 160, pageY = BOOK.c[1] - 70;
    const wp = SC.dp(ts, tm.write0, tm.write1, easeInOut);
    const lifted = ts >= tm.fly;
    if (wp > 0 && !lifted) {
      stroke(d, [[pageL, pageY + 4], [lerp(pageL, pageR, 0.5), pageY - 3], [pageR, pageY + 2]], { p: wp, w: 12, color: R.pal.gold, seed: 211, taperIn: 12, taperOut: 20 });
      halo(d, [lerp(pageL, pageR, wp), pageY], 50, 'gold', 0.7);
    }
    // the sword: carried, then laid down in front of the book
    const H = 400, dir = -1;
    const standRoot = [1480, LEDGE - 12 - 0.49 * H];
    const kneelP = SC.dp(ts, tm.lay1, tm.kneel1, easeInOut);
    const layP = SC.dp(ts, tm.lay0, tm.lay1, easeInOut);
    const root = [standRoot[0] - 20 * kneelP - 30 * layP * (1 - kneelP), standRoot[1] + lerp(0, 0.22 * H, Math.max(kneelP, 0.6 * layP * (1 - kneelP)))];
    const swordRest = { hilt: [1390, LEDGE - 18], ang: 186 };
    const pose = F.lerpPose(
      { lean: 2, head: 6, hp1: 6, kn1: 4, hp2: -8, kn2: 6, sh1: 30, el1: 80, sh2: -10, el2: 16, wind: 0.5 },
      { lean: 26, head: 18, hp1: 84, kn1: 88, hp2: 8, kn2: 112, sh1: 60, el1: 40, sh2: 10, el2: 50, wind: 0.5 }, kneelP);
    Object.assign(pose, { root, H, dir, p: SC.dp(ts, 0.3, 1.2) });
    let swordHilt, swordAng;
    if (ts < tm.lay0) {
      pose.hand1 = [standRoot[0] - 80, standRoot[1] - 20]; pose.bend1 = -1;
    } else if (ts < tm.lay1) {
      pose.hand1 = mix([standRoot[0] - 80, standRoot[1] - 20], swordRest.hilt, layP); pose.bend1 = -1;
      pose.lean = lerp(2, 30, Math.sin(Math.PI * layP));
    }
    if (ts > tm.write0 - 0.6) {
      // writing: hand follows the stroke on the page
      const u = SC.dp(ts, tm.write0, tm.write1, easeInOut);
      pose.hand1 = [lerp(pageL, pageR, u) + 18, pageY - 30 - Math.sin(u * Math.PI) * 4 - 14 * (1 - SC.dp(ts, tm.write0 - 0.6, tm.write0))];
      pose.bend1 = -1;
    } else if (ts > tm.kneel1) {
      pose.hand1 = [pageL + 10, pageY - 60]; pose.bend1 = -1;
    }
    const J = F.figure(d, pose, { hair: 'bun', ribbon: true, seed: 11 }, ts);
    if (ts < tm.lay0) { swordHilt = J.A1.W; swordAng = -78; }
    else if (ts < tm.lay1) { swordHilt = J.A1.W; swordAng = lerp(-78, swordRest.ang - 360, layP); }
    else { swordHilt = swordRest.hilt; swordAng = swordRest.ang; }
    PR.sword(d, swordHilt, swordAng, H * 0.5, { p: pose.p, seed: 870, tassel: ts < tm.lay1 }, ts);
    if (ts > tm.brush) {
      const bp = SC.dp(ts, tm.brush, tm.brush + 0.4);
      d.open('opacity="' + bp.toFixed(3) + '"');
      PR.writingBrush(d, add(J.A1.W, [-22, 34]), -60, 110, { seed: 845 });
      d.close();
    }
    FX.dust(d, swordRest.hilt, tm.lay1 - 0.05, ts, { n: 5, dist: 90, size: 26, life: 1.0, a0: 180, spread: 150 });
    d.close();
    // the stroke rises as sword-light into the sun
    const fl = inv(tm.fly, tm.burst, ts);
    if (fl > 0 && fl < 1) {
      const a = K.transformPts([[lerp(pageL, pageR, 0.5), pageY]], 0, 0)[0];
      const scr = (q, depth) => { const s = 1 + (cam.z - 1) * depth, ex = 960 + (cam.x - 960) * depth, ey = 540 + (cam.y - 540) * depth; return [(q[0] - ex) * s + 960, (q[1] - ey) * s + 540]; };
      const from = scr(a, 1.0), to = scr([SUN[0], sy], 0.2);
      FX.streak(d, from, to, fl, { w: 26 });
      halo(d, mix(from, to, easeOut(clamp(fl / 0.5))), 90, 'gold', 0.8 * (1 - fl));
    }
    const scrSun = (() => { const s = 1 + (cam.z - 1) * 0.2, ex = 960 + (cam.x - 960) * 0.2, ey = 540 + (cam.y - 540) * 0.2; return [(SUN[0] - ex) * s + 960, (sy - ey) * s + 540]; })();
    FX.burst(d, scrSun, 260, inv(tm.burst, tm.burst + 0.9, ts), { seed: 31, n: 20 });
    if (ts > tm.burst) N.motes(d, ts, { n: 24, seed: 131, area: [scrSun[0] - 500, scrSun[0] + 500, scrSun[1] - 250, scrSun[1] + 450] });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'dawnAmb', gain: 0.5, dur: S.dur },
      { t: 0.5, sfx: 'crowdSteps', gain: 0.3, dur: S.dur - 0.5, pan: -0.2 },
      { t: tm.flip0, sfx: 'pageFlipFast', gain: 0.65, dur: tm.flip1 - tm.flip0 },
      { t: tm.lay1 - 0.1, sfx: 'swordPlace', gain: 0.7, pan: 0.3 },
      { t: tm.write0, sfx: 'brushStroke', gain: 0.8, pan: 0.2 },
      { t: tm.fly, sfx: 'rise', gain: 0.8, pan: 0.3 },
      { t: tm.burst, sfx: 'burstBell', gain: 0.7, pan: 0.4 },
    ];
  }

  G.SCENES.legacy = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
