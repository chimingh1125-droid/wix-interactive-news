/* 1. Opening — Muzha: the Jingmei River, the tunnel (山洞口) and the valley
 * campus. Wuxia event: a young swordsman walks along the river, then leaps
 * (輕功) up onto the ridge while the camera cranes up to reveal the sect. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, inv, add, stroke, shape, halo, text, camOpen } = K;

  const HILL = { peaks: [{ x: 150, h: 300, w: 820 }, { x: 1020, h: 250, w: 900 }, { x: 1850, h: 300, w: 820 }], base: 1010, seed: 21, roughAmp: 8 };
  const FAR = { peaks: [{ x: -80, h: 380, w: 380 }, { x: 380, h: 450, w: 420 }, { x: 900, h: 360, w: 430 }, { x: 1380, h: 490, w: 440 }, { x: 1930, h: 400, w: 430 }], base: 700, seed: 11 };
  const GROUND = 1028, H = 300;

  function timing(S) {
    const l1 = SC.line(S, 'L01');
    const walkEnd = l1.t1 + 0.25;
    const leap0 = walkEnd + 0.1, leap1 = leap0 + 1.45;
    return { walkEnd, leap0, leap1, crane0: leap0 - 0.25, crane1: Math.min(S.dur - 0.3, leap1 + 1.1) };
  }

  function hero(d, ts, S, tm) {
    const x0 = -140, x1 = 820;
    const ridgeX = 1400, ridgeY = N.ridgeAt(HILL, ridgeX);
    let pose, root;
    const baseY = GROUND - 0.49 * H;
    if (ts < tm.walkEnd) {
      const u = inv(0.3, tm.walkEnd, ts);
      const x = lerp(x0, x1, u);
      const w = F.walkPose(x / 232, 1);
      root = [x, baseY];
      pose = Object.assign(w, { wind: 0.35 });
    } else if (ts < tm.leap0) {
      root = [x1, baseY + 12 * smooth(inv(tm.walkEnd, tm.leap0, ts))];
      pose = { lean: 14, hp1: 40, kn1: 60, hp2: -10, kn2: 50, sh1: -30, el1: 20, sh2: -40, el2: 20, wind: 0.4 };
    } else if (ts < tm.leap1) {
      const u = inv(tm.leap0, tm.leap1, ts);
      const x = lerp(x1, ridgeX, easeInOut(u));
      const landY = ridgeY - 0.49 * H;
      const y = lerp(baseY, landY, u) - Math.sin(Math.PI * u) * 300;
      root = [x, y];
      const tuck = Math.sin(Math.PI * clamp(u * 1.2));
      pose = { lean: lerp(10, 22, tuck), hp1: lerp(20, 75, tuck), kn1: lerp(30, 110, tuck), hp2: lerp(-30, -20, tuck), kn2: lerp(20, 80, tuck),
        sh1: lerp(60, -70, u), el1: 20, sh2: lerp(-60, -90, tuck), el2: 30, wind: 1.0 };
    } else {
      const u = inv(tm.leap1, tm.leap1 + 0.5, ts);
      root = [ridgeX, ridgeY - 0.49 * H + (1 - easeOut(u)) * 22];
      pose = F.lerpPose({ lean: 18, hp1: 45, kn1: 70, hp2: -25, kn2: 40, sh1: 40, el1: 30, sh2: -50, el2: 20, wind: 0.9 },
        { lean: 2, hp1: 8, kn1: 6, hp2: -8, kn2: 8, sh1: 8, el1: 20, sh2: -10, el2: 12, head: -8, wind: 0.65 }, easeOut(u));
    }
    const p = SC.dp(ts, 0.35, 1.3);
    const J = F.figure(d, Object.assign({ root, H, dir: 1, p }, pose), { hair: 'bun', ribbon: true, gourd: false, seed: 11 }, ts);
    // sheathed sword on the back
    PR.sword(d, add(J.neck, [-44, 26]), 128, H * 0.52, { p, tassel: true, seed: 870 }, ts);
    return J;
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = SC.cam([[0, { x: 900, y: 860, z: 1.06 }], [tm.crane0, { x: 960, y: 860, z: 1.06 }], [tm.crane1, { x: 1010, y: 560, z: 1.0 }], [S.dur, { x: 1030, y: 550, z: 1.02 }]], ts);
    // sky
    camOpen(d, cam, 0.15);
    N.sun(d, [1570, 180], 64, { p: SC.dp(ts, 0.1, 1.0) }, ts);
    N.cloud(d, 470 + ts * 14, 230, 1.0, { seed: 3, p: SC.dp(ts, 0.2, 1.4) });
    N.cloud(d, 1060 + ts * 9, 110, 0.75, { seed: 8, tailDir: 1, p: SC.dp(ts, 0.4, 1.6) });
    for (let i = 0; i < 5; i++) {
      const bx = -100 + ((ts * 70 + i * 90) % 2300), by = 250 + (i % 3) * 30 + Math.sin(ts + i) * 8;
      N.bird(d, bx, by, 0.9, ts, { seed: i, p: SC.dp(ts, 1.0 + i * 0.1, 1.6 + i * 0.1) });
    }
    d.close();
    // far mountains + mist
    camOpen(d, cam, 0.35);
    N.mountains(d, Object.assign({ p: SC.dp(ts, 0.0, 1.5), fill: R.pal.fillFar, w: 2.4, texture: 10 }, FAR));
    d.close();
    camOpen(d, cam, 0.45);
    N.mist(d, { y: 640, h: 90, amp: 7, seed: 4, opacity: SC.dp(ts, 0.6, 1.6), fill: R.pal.fillFar }, ts);
    d.close();
    // campus in the valley
    camOpen(d, cam, 0.5);
    const cp = (a) => SC.dp(ts, tm.crane0 - 0.6 + a * 1.4, tm.crane0 + 0.9 + a * 1.4);
    A.building(d, 470, 840, 170, 340, { seed: 101, p: cp(0), floors: 6 });
    A.building(d, 690, 840, 240, 460, { seed: 102, p: cp(0.15), floors: 8, roof: 'tank' });
    A.building(d, 1000, 840, 210, 390, { seed: 103, p: cp(0.3), floors: 7 });
    A.building(d, 1255, 840, 170, 310, { seed: 104, p: cp(0.45), floors: 5 });
    A.banner(d, [1180, 830], 540, 118, 250, ts, { text: '世新', p: cp(0.5), seed: 341, unfurl: SC.dp(ts, tm.crane0, tm.crane1 - 0.2) });
    A.banner(d, [640, 830], 400, 88, 170, ts + 0.7, { text: '新聞', p: cp(0.6), seed: 351, unfurl: SC.dp(ts, tm.crane0 + 0.4, tm.crane1) });
    d.close();
    // hill, tunnel, path, hero
    camOpen(d, cam, 0.95);
    N.mountains(d, Object.assign({ p: SC.dp(ts, 0.1, 1.3), fill: R.pal.fillMid, w: 3.2, texture: 16 }, HILL));
    N.pine(d, 330, N.ridgeAt(HILL, 330) + 30, 0.95, { seed: 4, p: SC.dp(ts, 0.8, 1.9) }, ts);
    N.pine(d, 1690, N.ridgeAt(HILL, 1690) + 40, 0.8, { seed: 9, p: SC.dp(ts, 1.0, 2.1) }, ts);
    // stone steps up the hill
    for (let i = 0; i < 7; i++) {
      const x = 1330 + i * 16, y = 990 - i * 38;
      stroke(d, [[x - 22, y], [x + 22, y - 4]], { p: SC.dp(ts, 1.2 + i * 0.05, 1.6 + i * 0.05), w: 2.2, seed: 60 + i, color: R.pal.soft });
    }
    A.tunnel(d, 1150, GROUND, 210, 250, { p: SC.dp(ts, 0.4, 1.9), plaque: '世新大學', plaqueW: 220 });
    // riverbank path
    shape(d, [[-300, GROUND - 4], [2220, GROUND - 4], [2220, GROUND + 26], [-300, GROUND + 26]], { p: SC.dp(ts, 0, 0.8), fill: R.pal.fillNear, w: 2.6, seed: 71, start: 0 });
    for (let i = 0; i < 14; i++) stroke(d, [[i * 160 - 120, GROUND + 10], [i * 160 - 90, GROUND + 8]], { p: SC.dp(ts, 0.5 + i * 0.03, 1.0 + i * 0.03), w: 2, seed: 80 + i, color: R.pal.soft });
    hero(d, ts, S, tm);
    d.close();
    // river
    camOpen(d, cam, 1.0);
    N.river(d, { x0: -300, x1: 2240, y0: GROUND + 26, y1: 1420, seed: 2, speed: 46, p: SC.dp(ts, 0, 1.2) }, ts);
    N.rock(d, 520, 1150, 46, { seed: 8, p: SC.dp(ts, 0.6, 1.4) });
    N.rock(d, 1620, 1210, 62, { seed: 12, p: SC.dp(ts, 0.8, 1.6) });
    d.close();
    // foreground reeds
    camOpen(d, cam, 1.12);
    N.grass(d, 80, 1300, 120, { seed: 3, n: 6, p: SC.dp(ts, 0.9, 1.8) }, ts);
    N.grass(d, 1860, 1330, 140, { seed: 5, n: 7, p: SC.dp(ts, 1.0, 1.9) }, ts);
    d.close();
    N.leaves(d, ts, { n: 7, seed: 5, area: [0, 1920, -80, 1150], drift: 200 });
  }

  function cues(S) {
    const tm = timing(S);
    const c = [{ t: 0, sfx: 'riverLoop', gain: 0.55, dur: S.dur }, { t: 1.2, sfx: 'birds', gain: 0.5, pan: -0.3 }];
    for (let t = 0.6, k = 0; t < tm.walkEnd; t += 0.43, k++) c.push({ t, sfx: 'step', gain: 0.32, pan: -0.6 + t / tm.walkEnd * 0.6 });
    c.push({ t: tm.leap0 - 0.05, sfx: 'whooshUp', gain: 0.9, pan: 0 });
    c.push({ t: tm.crane0, sfx: 'windGust', gain: 0.55 });
    c.push({ t: tm.leap1, sfx: 'land', gain: 0.6, pan: 0.3 });
    c.push({ t: tm.crane1 - 0.6, sfx: 'flag', gain: 0.45, pan: 0.2 });
    c.push({ t: tm.crane1 - 0.2, sfx: 'birds', gain: 0.4, pan: 0.4 });
    return c;
  }

  G.SCENES.opening = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
