/* 4. The creed 德智兼修，手腦並用. Wuxia event: Zhou Botong's two-handed
 * combat (左右互搏) — one hand draws a circle, the other a square, at the same
 * time; they become 腦 (mind) and 手 (hands). */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeInOut, inv, add, sub, mul, stroke, shape, halo, text, camOpen, ellipse, DEG, TAU } = K;

  const GROUND = 1000;

  function timing(S) {
    const l6 = SC.line(S, 'L06'), l7 = SC.line(S, 'L07');
    const c1a = l6.t0 + 1.15, c1b = l6.t0 + 2.15, c2a = l6.t0 + 2.3, c2b = Math.min(l6.t1 + 0.35, l6.t0 + 3.3);
    const sh0 = l7 ? l7.t0 + 0.55 : l6.t1 + 0.25;
    const shd = l7 ? 2.6 : 1.9;
    return { c1a, c1b, c2a, c2b, sh0, sh1: sh0 + shd };
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    const cam = SC.cam([[0, { x: 940, y: 540, z: 1.0 }], [S.dur, { x: 990, y: 548, z: 1.05 }]], ts);
    camOpen(d, cam, 0.3);
    N.mountains(d, { peaks: [{ x: 200, h: 240, w: 420 }, { x: 900, h: 300, w: 460 }, { x: 1600, h: 260, w: 420 }], base: 1000, seed: 61, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 6, color: R.pal.soft });
    N.cloud(d, 1250 + ts * 10, 150, 0.8, { seed: 19, p: SC.dp(ts, 0.2, 1.2) });
    d.close();
    camOpen(d, cam, 0.8);
    N.bamboo(d, 90, 1080, 900, { seed: 6, p: SC.dp(ts, 0.3, 1.6), sway: 8 }, ts);
    N.bamboo(d, 175, 1080, 760, { seed: 7, p: SC.dp(ts, 0.4, 1.7), sway: 10 }, ts);
    d.close();
    camOpen(d, cam, 1);
    shape(d, [[-200, GROUND], [2120, GROUND], [2120, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.7), fill: R.pal.fillNear, w: 3, seed: 81, start: 0 });
    // hanging scroll with the creed
    const sx = 610, sy = 96, sw = 420, sl = 820;
    PR.scroll(d, sx, sy, sw, sl, SC.dp(ts, 0.25, 1.35, easeInOut), {
      draw: (dd, cur) => {
        const p1 = SC.dp(ts, tm.c1a, tm.c1b, (x) => x), p2 = SC.dp(ts, tm.c2a, tm.c2b, (x) => x);
        FX.revealText(dd, '德智兼修', sx + 95, sy + 110, p1, { size: 124, vertical: true, anchor: 'start', spacing: 0.1, glow: 0.3 });
        FX.revealText(dd, '手腦並用', sx - 95, sy + 110, p2, { size: 124, vertical: true, anchor: 'start', spacing: 0.1, glow: 0.3 });
        PR.seal(dd, [sx - 150, sy + sl - 90], 62, '世新', { p: SC.dp(ts, tm.c2b + 0.1, tm.c2b + 0.4), fill: R.pal.line, ink: R.pal.bg, seed: 826 });
      },
    });
    // the brush that writes (tip follows the current character)
    let tip = null;
    const adv = 124 * 1.1;
    if (ts > tm.c1a - 0.3 && ts < tm.c2b + 0.4) {
      const onCol = ts < (tm.c1b + tm.c2a) / 2 ? 0 : 1;
      const [a, b] = onCol === 0 ? [tm.c1a, tm.c1b] : [tm.c2a, tm.c2b];
      const u = clamp(inv(a, b, ts) * 4 * 0.999);
      const ci = Math.floor(u), fr = u - ci;
      const x = onCol === 0 ? sx + 95 : sx - 95;
      tip = [x + Math.sin(fr * Math.PI * 2) * 22, sy + 110 + ci * adv - 20 + fr * 110];
      const vis = SC.dp(ts, tm.c1a - 0.3, tm.c1a) * (1 - SC.dp(ts, tm.c2b, tm.c2b + 0.4));
      d.open('opacity="' + vis.toFixed(3) + '"');
      PR.writingBrush(d, tip, -58 + Math.sin(ts * 9) * 4, 250, { seed: 802 });
      d.close();
    }
    // Zhou Botong: 左右互搏
    const H = 440, root = [1580, GROUND - 0.49 * H];
    const sp = SC.dp(ts, tm.sh0, tm.sh1, (x) => x);
    const circleC = [1170, 390], circleR = 132, sqC = [1170, 745], sqS = 236;
    const circPt = (u) => [circleC[0] + Math.cos(-Math.PI / 2 - u * TAU) * circleR, circleC[1] + Math.sin(-Math.PI / 2 - u * TAU) * circleR];
    const sqPts = [[sqC[0] - sqS / 2, sqC[1] - sqS / 2], [sqC[0] + sqS / 2, sqC[1] - sqS / 2], [sqC[0] + sqS / 2, sqC[1] + sqS / 2], [sqC[0] - sqS / 2, sqC[1] + sqS / 2], [sqC[0] - sqS / 2, sqC[1] - sqS / 2]];
    const sqPt = (u) => K.pointAt(sqPts, u);
    const small = (q, c, k) => add(c, mul(sub(q, k === 0 ? circleC : sqC), k === 0 ? 0.3 : 0.26));
    const drawing = ts > tm.sh0 - 0.4 && ts < tm.sh1 + 0.3;
    const bounce = Math.abs(Math.sin(ts * 3.2)) * 10 * (1 - smooth(inv(tm.sh0 - 0.5, tm.sh0, ts)) + smooth(inv(tm.sh1, tm.sh1 + 0.4, ts)));
    const pose = {
      root: [root[0], root[1] - bounce], H, dir: -1, p: SC.dp(ts, 0.5, 1.5), lean: drawing ? 8 : 2, head: drawing ? 10 : -4,
      hp1: 10, kn1: 12, hp2: -10, kn2: 12, wind: 0.35,
      sh1: 20 + Math.sin(ts * 2.4) * 10, el1: 60, sh2: -10 + Math.sin(ts * 2.4 + 1) * 10, el2: 70,
    };
    if (drawing) {
      pose.hand1 = small(circPt(sp), [1462, 612], 0);
      pose.hand2 = small(sqPt(sp), [1470, 736], 1);
      pose.bend1 = 1; pose.bend2 = 1;
    }
    const J = F.figure(d, pose, { hair: 'messy', beard: 'messy', ribbon: false, hairColor: R.pal.line, seed: 41, hand1: 'fist', hand2: 'fist' }, ts);
    // the big shapes drawn in the air
    if (sp > 0) {
      const cpts = []; for (let i = 0; i <= 60; i++) cpts.push(circPt(i / 60));
      stroke(d, cpts, { p: sp, w: 7, color: R.pal.gold, seed: 91 });
      stroke(d, sqPts, { p: sp, w: 7, color: R.pal.gold, seed: 92, brush: true, taperIn: 6, taperOut: 6 });
      if (sp < 1) {
        // light threads from the hands to the drawing tips
        stroke(d, [J.A1.W, circPt(sp)], { w: 1.4, color: R.pal.goldSoft, brush: false, seed: 93, amp: 0.8 });
        stroke(d, [J.A2.W, sqPt(sp)], { w: 1.4, color: R.pal.goldSoft, brush: false, seed: 94, amp: 0.8 });
        halo(d, circPt(sp), 40, 'gold', 0.8);
        halo(d, sqPt(sp), 40, 'gold', 0.8);
      }
      const done = SC.dp(ts, tm.sh1, tm.sh1 + 0.5);
      if (done > 0) {
        halo(d, circleC, circleR * 1.6, 'gold', 0.4 * done);
        halo(d, sqC, sqS * 1.1, 'gold', 0.35 * done);
        FX.revealText(d, '腦', circleC[0], circleC[1] + 44, done, { size: 128, color: R.pal.line, glow: 0.5, tip: false });
        FX.revealText(d, '手', sqC[0], sqC[1] + 44, done, { size: 128, color: R.pal.line, glow: 0.5, tip: false });
      }
      FX.burst(d, circleC, 220, inv(tm.sh1, tm.sh1 + 0.7, ts), { seed: 12, n: 12 });
      FX.burst(d, sqC, 220, inv(tm.sh1 + 0.05, tm.sh1 + 0.75, ts), { seed: 13, n: 12 });
    }
    d.close();
    N.motes(d, ts, { n: 10, seed: 44, area: [900, 1500, 150, 950] });
  }

  function cues(S) {
    const tm = timing(S);
    const c = [{ t: 0.25, sfx: 'scrollUnroll', gain: 0.7, pan: -0.4 }, { t: 0, sfx: 'bambooWind', gain: 0.35, dur: S.dur }];
    for (let i = 0; i < 4; i++) c.push({ t: tm.c1a + i * (tm.c1b - tm.c1a) / 4, sfx: 'brushStroke', gain: 0.55, pan: -0.3 });
    for (let i = 0; i < 4; i++) c.push({ t: tm.c2a + i * (tm.c2b - tm.c2a) / 4, sfx: 'brushStroke', gain: 0.55, pan: -0.5 });
    c.push({ t: tm.sh0, sfx: 'shimmer', gain: 0.6, pan: 0.3, dur: tm.sh1 - tm.sh0 });
    c.push({ t: tm.sh1, sfx: 'chime', gain: 0.7, pan: 0.2 });
    return c;
  }

  G.SCENES.motto = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
