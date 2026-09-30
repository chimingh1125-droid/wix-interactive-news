/* 7. Form Two — Writing: Qiao Feng's Eighteen Dragon-Subduing Palms.
 * Wuxia event: he gathers qi, pushes both palms, a golden dragon bursts out,
 * loops and smashes the great doors open — revealing the mountain beyond
 * (開門見山: a lead that gets straight to the point). */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG, rectPts, f1 } = K;

  const GROUND = 930, DX = 1360, DY0 = 470, DY1 = 900, DW = 170;

  function timing(S) {
    const l = SC.line(S, 'L12');
    const strike = l.t1 + 0.22;
    return { label: l.t0, gather: l.t0 + 0.3, strike, hit: strike + 1.45 };
  }

  function dragonPath() {
    return K.spline([[640, 650], [820, 520], [900, 300], [760, 190], [640, 300], [820, 420], [1060, 360], [1240, 520], [DX, 700]], 14);
  }
  const PATH = dragonPath();

  function doors(d, ts, tm) {
    const open = SC.dp(ts, tm.hit, tm.hit + 0.4, easeOut);
    // the view beyond the doorway (seen once the doors open)
    const id = d.id('door');
    d.add('<defs><clipPath id="' + id + '"><rect x="' + (DX - DW) + '" y="' + DY0 + '" width="' + (2 * DW) + '" height="' + (DY1 - DY0) + '"/></clipPath></defs>');
    d.open('clip-path="url(#' + id + ')"');
    d.add('<rect x="' + (DX - DW) + '" y="' + DY0 + '" width="' + (2 * DW) + '" height="' + (DY1 - DY0) + '" fill="' + R.pal.fillFar + '"/>');
    N.sun(d, [DX + 40, 600], 58, { p: 1, rays: true, glow: 0.9 * open }, ts);
    N.mountains(d, { peaks: [{ x: DX - 60, h: 330, w: 190 }, { x: DX + 150, h: 210, w: 160 }], base: DY1, seed: 93, p: 1, fill: R.pal.fillMid, w: 3, x0: DX - DW - 20, x1: DX + DW + 20, texture: 6 });
    N.cloud(d, DX - 80, 700, 0.5, { seed: 27, p: 1 });
    d.close();
    // door leaves swinging open (foreshortened)
    for (const side of [-1, 1]) {
      const hinge = DX + side * DW;
      const w = DW * lerp(1, 0.12, open);
      const skew = open * 30;
      const xin = hinge - side * w;
      const pts = [[hinge, DY0], [xin, DY0 - skew * 0.4], [xin, DY1 + skew * 0.3], [hinge, DY1]];
      shape(d, pts, { p: SC.dp(ts, 0.3, 1.2), w: 3, seed: side > 0 ? 141 : 142, fill: R.pal.fillMid });
      if (w > 30) {
        for (let k = 1; k < 4; k++) {
          const x = lerp(hinge, xin, k / 4);
          stroke(d, [[x, DY0 + 8], [x, DY1 - 8]], { p: SC.dp(ts, 0.6, 1.4), w: 1.4, seed: 143 + k + side * 5, brush: false, color: R.pal.soft });
        }
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
          const x = lerp(hinge, xin, (c + 0.8) / 4), y = DY0 + 60 + r * 80;
          d.add('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="3.2" fill="' + R.pal.gold + '" opacity="' + SC.dp(ts, 0.9, 1.4).toFixed(2) + '"/>');
        }
        const ring = [lerp(hinge, xin, 0.85), (DY0 + DY1) / 2];
        stroke(d, K.ellipse(ring, 14, 16, 0, 16).concat([[ring[0] + 14, ring[1]]]), { p: SC.dp(ts, 1.0, 1.5), w: 2.4, color: R.pal.gold, seed: 150 + side, brush: false });
      }
    }
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    let cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.strike, { x: 980, y: 540, z: 1.02 }], [tm.hit + 0.3, { x: 1080, y: 560, z: 1.08 }], [S.dur, { x: 1100, y: 560, z: 1.1 }]], ts);
    cam = SC.shake(cam, ts, tm.hit, 20, 0.6);
    cam = SC.shake(cam, ts, tm.strike, 8, 0.3);
    camOpen(d, cam, 0.25);
    N.cloud(d, 200 + ts * 12, 160, 0.9, { seed: 31, p: SC.dp(ts, 0.1, 1.2) });
    N.cloud(d, 1150 + ts * 9, 110, 0.7, { seed: 32, tailDir: 1, p: SC.dp(ts, 0.3, 1.3) });
    N.mountains(d, { peaks: [{ x: 250, h: 330, w: 440 }, { x: 900, h: 260, w: 460 }, { x: 1600, h: 380, w: 460 }, { x: 2200, h: 300, w: 420 }], base: 860, seed: 91, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 8 });
    d.close();
    camOpen(d, cam, 1);
    shape(d, [[-200, GROUND], [2300, GROUND], [2300, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.7), fill: R.pal.fillNear, w: 3, seed: 131, start: 0 });
    // courtyard wall with the great doors
    const wp = SC.dp(ts, 0.2, 1.3);
    shape(d, rectPts(1080, 400, 570, GROUND - 400), { p: wp, w: 3, seed: 133, fill: R.pal.fillMid });
    for (let y = 440; y < GROUND; y += 46) stroke(d, [[1084, y], [1646, y]], { p: wp, w: 1.2, brush: false, seed: 134 + y, color: R.pal.faint });
    A.roof(d, 1365, 404, 620, 70, { p: wp, seed: 136 });
    shape(d, rectPts(DX - DW - 22, DY0 - 30, 2 * DW + 44, DY1 - DY0 + 30), { p: wp, w: 3.2, seed: 137, fill: R.pal.shade });
    doors(d, ts, tm);
    // the words once the doors burst open
    const kp = SC.dp(ts, tm.hit + 0.3, tm.hit + 1.5, (x) => x);
    if (kp > 0) FX.revealText(d, '開門見山', DX, 300, kp, { size: 78, color: R.pal.gold, glow: 0.5, spacing: 0.12 });
    FX.burst(d, [DX, 690], 360, inv(tm.hit, tm.hit + 0.8, ts), { seed: 21, n: 18 });
    FX.dust(d, [DX, GROUND], tm.hit + 0.05, ts, { n: 9, dist: 420, size: 80, a0: 180, spread: 170, life: 2.0 });
    FX.sparks(d, [DX, 690], tm.hit, ts, { n: 22, speed: 900, seed: 39, color: R.pal.line });
    // --- Qiao Feng
    const H = 460;
    const g = SC.dp(ts, tm.gather, tm.gather + 0.6);
    const root = [420, GROUND - 0.49 * H + 34 * g];
    const circ = ts * 3.2;
    let pose;
    if (ts < tm.strike - 0.25) {
      pose = {
        lean: 2, hp1: lerp(10, 36, g), kn1: lerp(8, 48, g), hp2: lerp(-10, -36, g), kn2: lerp(8, 48, g), wind: 0.4 + 0.5 * g,
        sh1: 10, el1: 30, sh2: -8, el2: 30,
      };
      if (g > 0) {
        pose.hand1 = [root[0] + 120 + Math.cos(circ) * 55 * g, root[1] - 40 + Math.sin(circ) * 45 * g];
        pose.hand2 = [root[0] + 110 + Math.cos(circ + Math.PI) * 55 * g, root[1] - 40 + Math.sin(circ + Math.PI) * 45 * g];
        pose.bend1 = 1; pose.bend2 = 1;
      }
    } else {
      pose = F.poseAt([
        [tm.strike - 0.25, { lean: -6, hp1: 36, kn1: 48, hp2: -36, kn2: 48, sh1: 20, el1: 110, sh2: 10, el2: 110, wind: 0.9 }],
        [tm.strike, { lean: 16, hp1: 44, kn1: 50, hp2: -40, kn2: 10, sh1: 86, el1: 0, sh2: 82, el2: 4, wind: 1.0 }, easeIn],
        [tm.hit + 1.2, { lean: 12, hp1: 42, kn1: 48, hp2: -38, kn2: 12, sh1: 80, el1: 4, sh2: 76, el2: 8, wind: 0.7 }],
        [tm.hit + 2.6, { lean: 2, hp1: 30, kn1: 34, hp2: -30, kn2: 30, sh1: 20, el1: 50, sh2: 10, el2: 50, wind: 0.5 }],
      ], ts);
    }
    Object.assign(pose, { root: [root[0] + 26 * SC.dp(ts, tm.strike - 0.2, tm.strike), root[1]], H, dir: 1, p: SC.dp(ts, 0.3, 1.2) });
    // pebbles lifted by the gathering qi
    for (let k = 0; k < 7; k++) {
      const lift = g * (1 - SC.dp(ts, tm.strike, tm.strike + 0.3));
      if (lift <= 0) break;
      const x = root[0] + (k - 3) * 70 + Math.sin(ts * 2 + k) * 8;
      const y = GROUND - 10 - lift * (40 + 50 * rnd(151, k)) - Math.sin(ts * 3 + k) * 8;
      K.shape(d, K.ellipse([x, y], 9, 6, k, 8), { w: 1.8, seed: 160 + k, fill: R.pal.fillMid });
    }
    const J = F.figure(d, pose, { hair: 'bun', ribbon: false, beard: 'full', build: 1.28, seed: 71, hand1: 'palm', hand2: 'palm', sashColor: R.pal.gold }, ts);
    const qg = g * (1 - SC.dp(ts, tm.strike, tm.strike + 0.2));
    FX.qiSwirl(d, mix(J.A1.W, J.A2.W, 0.5), 110, ts, { p: qg, n: 6 });
    halo(d, mix(J.A1.W, J.A2.W, 0.5), 140, 'gold', 0.5 * qg);
    if (qg > 0.05) FX.ring(d, [root[0], GROUND], 380, (ts % 1.2) / 1.2, { w: 3 * qg, ry: 0.18, color: R.pal.soft });
    // dragon
    const hd = SC.dp(ts, tm.strike, tm.hit, (x) => 1 - Math.pow(1 - x, 1.6));
    const fade = 1 - SC.dp(ts, tm.hit + 0.1, tm.hit + 0.8);
    if (hd > 0 && fade > 0) {
      d.open('opacity="' + fade.toFixed(3) + '"');
      F.dragon(d, PATH, hd, ts, { len: 900, width: 86, flip: 1, p: SC.dp(ts, tm.strike, tm.strike + 0.4) });
      d.close();
    }
    FX.burst(d, add(J.A1.W, [30, 0]), 200, inv(tm.strike, tm.strike + 0.5, ts), { seed: 23, n: 12 });
    d.close();
    FX.formLabel(d, 1830, 90, SC.dp(ts, tm.label, tm.label + 1.4, (x) => x), { num: '第二式', name: '降龍十八掌', skill: '寫作', size2: 82, out: SC.labelOut(S, ts) });
    N.motes(d, ts, { n: 12, seed: 71, area: [1100, 1800, 300, 900] });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'windSoft', gain: 0.35, dur: S.dur },
      { t: tm.gather, sfx: 'qiCharge', gain: 0.8, dur: tm.strike - tm.gather },
      { t: tm.gather + 0.3, sfx: 'rumble', gain: 0.5, dur: tm.strike - tm.gather },
      { t: tm.strike, sfx: 'palmStrike', gain: 1.0 },
      { t: tm.strike + 0.15, sfx: 'dragonRoar', gain: 0.9, pan: 0.1 },
      { t: tm.strike + 0.3, sfx: 'whooshLong', gain: 0.6, pan: 0.2 },
      { t: tm.hit, sfx: 'doorCrash', gain: 1.0, pan: 0.45 },
      { t: tm.hit + 0.35, sfx: 'chimeBig', gain: 0.5, pan: 0.45 },
    ];
  }

  G.SCENES.writing = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
