/* 10. The greatest heroes serve the people — night palette.
 * Wuxia event: Guo Jing guards the walls of Xiangyang at night and looses an
 * arrow that streaks across the sky like a meteor. The camera descends to a
 * lamplit window where an old journalist writes; the Taiwan Lihpao (1988)
 * flies out of the window. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG, TAU, rectPts, f1 } = K;

  const WTOP = 430, WBASE = 800;
  const HOUSE = { x: 1080, base: 1290, w: 580, h: 360 };
  const WIN = { x: 1190, y: 1000, w: 360, h: 230 };

  function timing(S) {
    const l18 = SC.line(S, 'L18'), l19 = SC.line(S, 'L19'), l20 = SC.line(S, 'L20');
    const draw0 = l18.t0 + 0.2, rel = l18.t1 + 0.35;
    const pan0 = rel + 0.5, pan1 = pan0 + (l19 ? 2.6 : 1.7);
    const news = l20.t0 + 0.25;
    return { draw0, rel, pan0, pan1, news, back0: news - 0.3, back1: news + 1.4 };
  }

  function stars(d, ts) {
    for (let i = 0; i < 46; i++) {
      const x = rnd(301, i) * 2400 - 240, y = rnd(302, i) * 380 - 40;
      const tw = 0.45 + 0.55 * Math.sin(ts * (1.5 + rnd(303, i) * 2) + i);
      d.add('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(1.2 + rnd(304, i) * 1.6) + '" fill="' + R.pal.gold + '" opacity="' + (0.35 + 0.6 * tw).toFixed(2) + '"/>');
    }
  }

  function scholar(d, ts, tm) {
    // interior of the lit window: back wall, lamp, desk, the old journalist
    const id = d.id('win');
    d.add('<defs><clipPath id="' + id + '"><rect x="' + WIN.x + '" y="' + WIN.y + '" width="' + WIN.w + '" height="' + WIN.h + '"/></clipPath></defs>');
    d.open('clip-path="url(#' + id + ')"');
    d.add('<rect x="' + WIN.x + '" y="' + WIN.y + '" width="' + WIN.w + '" height="' + WIN.h + '" fill="' + R.pal.fillFar + '"/>');
    const lamp = [WIN.x + 290, WIN.y + 150];
    const fl = 0.9 + 0.1 * Math.sin(ts * 9) + 0.05 * Math.sin(ts * 23);
    halo(d, lamp, 260 * fl, 'warm', 0.85);
    // shelves of paper behind
    for (let k = 0; k < 3; k++) stroke(d, [[WIN.x + 12, WIN.y + 40 + k * 34], [WIN.x + 120, WIN.y + 40 + k * 34]], { w: 1.6, brush: false, seed: 401 + k, color: R.pal.soft });
    // the journalist, seated, writing
    const H = 300, root = [WIN.x + 110, WIN.y + 205];
    const wr = Math.sin(ts * 7) * 10, wy = Math.sin(ts * 13) * 3;
    const pose = { lean: 24, head: 14, hp1: 80, kn1: 80, hp2: 76, kn2: 80, sh1: 50, el1: 60, sh2: 40, el2: 90, wind: 0.05,
      hand1: [WIN.x + 205 + wr, WIN.y + 172 + wy], bend1: 1, hand2: [WIN.x + 170, WIN.y + 186], bend2: 1 };
    const J = F.figure(d, Object.assign({ root, H, dir: 1, p: 1 }, pose), { hair: 'bun', hairColor: R.pal.line, glasses: true, beard: 'none', ribbon: false, sash: false, long: true, seed: 131, hand1: 'fist', hand2: 'fist' }, ts);
    PR.writingBrush(d, add(J.A1.W, [14, 16]), -70, 70, { seed: 841 });
    // desk (hides the legs) with papers and the lamp
    shape(d, rectPts(WIN.x + 60, WIN.y + 190, 300, 60), { w: 2.6, seed: 405, fill: R.pal.shade });
    shape(d, [[WIN.x + 150, WIN.y + 186], [WIN.x + 250, WIN.y + 180], [WIN.x + 258, WIN.y + 192], [WIN.x + 156, WIN.y + 196]], { w: 1.6, seed: 406, fill: R.pal.fill });
    shape(d, K.ellipse([lamp[0], lamp[1] + 30], 18, 8, 0, 12), { w: 2, seed: 407, fill: R.pal.fillMid });
    shape(d, K.spline([[lamp[0] - 7, lamp[1] + 26], [lamp[0] - 4, lamp[1] + 4], [lamp[0], lamp[1] - 14 * fl], [lamp[0] + 4, lamp[1] + 4], [lamp[0] + 7, lamp[1] + 26]], 3), { w: 1.6, seed: 408, fill: R.pal.glow, color: R.pal.gold, amp: 0.8 });
    d.close();
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = SC.cam([[0, { x: 960, y: 520, z: 1.0 }], [tm.pan0, { x: 980, y: 520, z: 1.02 }], [tm.pan1, { x: 1370, y: 1080, z: 1.42 }],
      [tm.back0, { x: 1370, y: 1070, z: 1.44 }], [tm.back1, { x: 1250, y: 800, z: 1.06 }], [S.dur, { x: 1240, y: 790, z: 1.05 }]], ts);
    camOpen(d, cam, 0.15);
    stars(d, ts);
    N.sun(d, [1650, 150], 54, { p: SC.dp(ts, 0.2, 1.0), haloColor: 'gold', glow: 0.35, color: R.pal.line }, ts);
    N.cloud(d, 300 + ts * 10, 230, 0.8, { seed: 61, p: SC.dp(ts, 0.3, 1.3) });
    d.close();
    camOpen(d, cam, 0.4);
    N.mountains(d, { peaks: [{ x: 200, h: 300, w: 400 }, { x: 900, h: 220, w: 420 }, { x: 1700, h: 320, w: 440 }, { x: 2300, h: 260, w: 400 }], base: 760, seed: 111, p: SC.dp(ts, 0.1, 1.4), fill: R.pal.fillFar, w: 2.2, texture: 6, x1: 2600 });
    d.close();
    camOpen(d, cam, 1);
    // the wall of Xiangyang
    A.cityWall(d, -240, 2400, WTOP, WBASE, { p: SC.dp(ts, 0.2, 1.8), gateX: 640, gateW: 170, towerW: 380, sign: '襄陽', litTower: true, seed: 300 }, ts);
    [150, 400, 900, 1480, 1760, 2050].forEach((x, i) => A.torch(d, [x, WTOP - 28], 70, ts, { seed: 500 + i, p: SC.dp(ts, 0.8 + i * 0.1, 1.5 + i * 0.1) }));
    A.lantern(d, [560, 520], 26, ts, { seed: 11, p: SC.dp(ts, 1.2, 1.8) });
    A.lantern(d, [720, 520], 26, ts + 1, { seed: 12, p: SC.dp(ts, 1.3, 1.9) });
    // Guo Jing drawing the bow on the wall
    const H = 300, root = [1230, WTOP - 30 - 0.49 * H];
    const aim = -32;
    const dr = SC.dp(ts, tm.draw0, tm.draw0 + 1.6, easeInOut) * (ts < tm.rel ? 1 : Math.max(0, 1 - (ts - tm.rel) / 0.07));
    const up = K.polar(aim * DEG, 1);
    const shoulderApprox = [root[0] + 6, root[1] - 0.25 * H];
    const grip = add(shoulderApprox, mul(up, 0.3 * H));
    const anchor = add(shoulderApprox, add(mul(up, lerp(0.22, 0.02, dr) * H), [0, -0.02 * H]));
    const pose = { lean: 4, head: -12, hp1: 18, kn1: 14, hp2: -20, kn2: 10, wind: 0.5, sh1: 110, el1: 0, sh2: 60, el2: 90,
      hand1: grip, bend1: -1, hand2: anchor, bend2: 1 };
    const J = F.figure(d, Object.assign({ root, H, dir: 1, p: SC.dp(ts, 0.6, 1.5) }, pose), { hair: 'bun', ribbon: true, quiver: true, seed: 121, hand1: 'fist', hand2: 'fist' }, ts);
    const b = PR.bow(d, J.A1.W, aim, H * 0.62, dr, { p: SC.dp(ts, 0.9, 1.6), seed: 890 });
    if (ts < tm.rel) PR.arrowShape(d, b.nock, aim, H * 0.5, { p: SC.dp(ts, tm.draw0, tm.draw0 + 0.3), color: R.pal.gold, seed: 895 });
    else {
      const fly = ts - tm.rel;
      const tail = add(b.nock, mul(up, fly * 2600));
      if (fly < 1.2) {
        FX.streak(d, b.nock, add(b.nock, mul(up, 2200)), inv(tm.rel, tm.rel + 1.0, ts), { w: 12 });
        if (fly < 0.9) PR.arrowShape(d, tail, aim, H * 0.5, { color: R.pal.gold, seed: 896 });
      }
    }
    // the town below: the old journalist's lit window
    const hp = SC.dp(ts, 0.6, 2.2);
    shape(d, rectPts(HOUSE.x, HOUSE.base - HOUSE.h, HOUSE.w, HOUSE.h), { p: hp, w: 3, seed: 311, fill: R.pal.fillMid });
    A.roof(d, HOUSE.x + HOUSE.w / 2, HOUSE.base - HOUSE.h + 8, HOUSE.w * 1.08, 120, { p: hp, seed: 312 });
    A.house(d, 560, 1300, 420, 300, { p: hp, seed: 313, lit: true });
    A.house(d, 1780, 1300, 380, 280, { p: hp, seed: 314, lit: false });
    scholar(d, ts, tm);
    shape(d, rectPts(WIN.x, WIN.y, WIN.w, WIN.h), { p: hp, w: 4, seed: 315, fill: 'none' });
    for (let k = 1; k < 3; k++) stroke(d, [[WIN.x + k * WIN.w / 3, WIN.y], [WIN.x + k * WIN.w / 3, WIN.y + 18]], { p: hp, w: 2.2, seed: 316 + k, brush: false });
    halo(d, [WIN.x + WIN.w / 2, WIN.y + WIN.h / 2], 360, 'warm', 0.35 * hp);
    // the newspaper flies out of the window
    const np = SC.dp(ts, tm.news, tm.news + 1.2, easeOut);
    if (np > 0) {
      const c = [lerp(WIN.x + WIN.w / 2, 1180, np), lerp(WIN.y + 90, 690, np) + Math.sin(ts * 2) * 8 * np];
      const s = lerp(0.2, 1, np);
      halo(d, c, 330 * s, 'gold', 0.55 * np);
      PR.newspaper(d, c, 440 * s, 310 * s, { ang: lerp(20, -4, np), bend: (1 - np) * 0.8 * Math.sin(ts * 12), title: '台灣立報', date: '1988', photo: true, seed: 850, lw: 2.6, titleColor: R.pal.gold });
    }
    d.close();
    N.motes(d, ts, { n: 14, seed: 101, color: R.pal.gold });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'nightAmb', gain: 0.55, dur: S.dur },
      { t: 0.6, sfx: 'torchLoop', gain: 0.4, dur: S.dur - 0.6, pan: -0.2 },
      { t: tm.draw0 + 0.1, sfx: 'bowCreak', gain: 0.6, pan: 0.3 },
      { t: tm.rel, sfx: 'bowRelease', gain: 0.9, pan: 0.3 },
      { t: tm.rel + 0.02, sfx: 'arrowWhoosh', gain: 0.8, pan: 0.6 },
      { t: tm.pan0 + 0.6, sfx: 'writing', gain: 0.5, dur: tm.news - tm.pan0 - 0.6, pan: 0.3 },
      { t: tm.news, sfx: 'bigPaper', gain: 0.7, pan: 0.2 },
      { t: tm.news + 0.4, sfx: 'chimeBig', gain: 0.5, pan: 0.2 },
    ];
  }

  G.SCENES.mission = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
