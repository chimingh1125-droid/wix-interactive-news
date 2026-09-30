/* 6. Form One — Interviewing: Linghu Chong's Nine Swords of Dugu (獨孤九劍).
 * Wuxia event: a whirlwind of sabers and evasive phrases (無可奉告…) circles;
 * he spots the flaw (破綻), dashes in with a single thrust, the storm
 * shatters, and a golden question mark remains at the sword tip. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG, TAU } = K;

  const GROUND = 950, C = [1330, 500];
  const WORDS = ['無可奉告', '沒有意見', '官腔', '不予置評'];

  function timing(S) {
    const l = SC.line(S, 'L10');
    const thrust = l.t1 + 0.12;
    return { label: l.t0, parry: l.t0 + 1.45, flaw: l.t0 + 2.3, thrust, hit: thrust + 0.26, q: thrust + 0.55 };
  }

  // storm angle: accelerating spin until the hit
  const spin = (ts, tm) => { const t = Math.min(ts, tm.hit); return 1.2 * t + 0.18 * t * t; };

  function draw(d, ts, S) {
    const tm = timing(S);
    let cam = SC.cam([[0, { x: 940, y: 540, z: 1.0 }], [tm.thrust, { x: 1000, y: 535, z: 1.05 }], [S.dur, { x: 1010, y: 540, z: 1.06 }]], ts);
    cam = SC.shake(cam, ts, tm.hit, 12, 0.45);
    camOpen(d, cam, 0.25);
    N.mountains(d, { peaks: [{ x: 150, h: 420, w: 360 }, { x: 700, h: 300, w: 420 }, { x: 1400, h: 360, w: 420 }, { x: 1950, h: 400, w: 380 }], base: 900, seed: 81, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 8 });
    N.mist(d, { y: 780, h: 120, amp: 9, seed: 7, opacity: SC.dp(ts, 0.4, 1.3), fill: R.pal.fillFar }, ts);
    d.close();
    camOpen(d, cam, 0.85);
    N.bamboo(d, 60, 1100, 980, { seed: 16, p: SC.dp(ts, 0.2, 1.5), sway: 12 }, ts);
    N.bamboo(d, 150, 1100, 820, { seed: 17, p: SC.dp(ts, 0.3, 1.6), sway: 14 }, ts);
    N.bamboo(d, 250, 1100, 700, { seed: 18, p: SC.dp(ts, 0.4, 1.7), sway: 10 }, ts);
    d.close();
    camOpen(d, cam, 1);
    shape(d, [[-200, GROUND], [2120, GROUND], [2120, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.7), fill: R.pal.fillNear, w: 3, seed: 111, start: 0 });
    N.rock(d, 1700, GROUND + 40, 90, { seed: 19, p: SC.dp(ts, 0.3, 1.2), wide: 1.5 });
    N.grass(d, 1540, GROUND + 20, 60, { seed: 9, p: SC.dp(ts, 0.6, 1.3) }, ts);
    // --- the storm of blades and evasive words
    const broken = ts >= tm.hit;
    const a0 = spin(ts, tm);
    const storm = SC.dp(ts, 0.5, 1.4);
    const back = [], front = [];
    for (let i = 0; i < 7; i++) {
      const th = a0 + i / 7 * TAU;
      const pos = add(C, rot([Math.cos(th) * 270, Math.sin(th) * 170], -10 * DEG));
      back.push({ kind: 'blade', i, th, pos, z: Math.sin(th) });
    }
    WORDS.forEach((w, i) => {
      const th = -a0 * 0.8 + i / WORDS.length * TAU + 0.4;
      const pos = add(C, [Math.cos(th) * 150, Math.sin(th) * 95]);
      back.push({ kind: 'word', i, th, pos, w, z: Math.sin(th) });
    });
    if (!broken && storm > 0) {
      // swirl trails
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let j = 0; j <= 24; j++) { const th = a0 * 1.1 + k * 2.1 + j * 0.12; pts.push(add(C, rot([Math.cos(th) * (310 - k * 40), Math.sin(th) * (190 - k * 25)], -10 * DEG))); }
        stroke(d, pts, { w: 2.2, color: R.pal.soft, opacity: 0.7 * storm, seed: 120 + k });
      }
      back.sort((a, b) => a.z - b.z).forEach((o) => {
        if (o.kind === 'blade') {
          if (o.i === 2 && ts > tm.parry - 0.5 && ts < tm.parry + 1.2) return; // this one attacks
          PR.saber(d, o.pos, (o.th / DEG) + 90, 150 * (1 + 0.15 * o.z), { seed: 890 + o.i * 3, p: storm });
        } else {
          text(d, o.w, o.pos[0], o.pos[1] + 14, { size: 40 * (1 + 0.12 * o.z), weight: 700, opacity: storm * (0.75 + 0.25 * o.z), color: R.pal.line });
        }
      });
      // the flaw at the eye of the storm
      const fl = SC.dp(ts, tm.flaw, tm.flaw + 0.4);
      if (fl > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(ts * 9);
        halo(d, C, 70 * (1 + 0.2 * pulse), 'gold', fl * pulse);
        d.add('<circle cx="' + C[0] + '" cy="' + C[1] + '" r="' + (7 + 3 * pulse).toFixed(1) + '" fill="' + R.pal.glow + '" opacity="' + fl.toFixed(3) + '"/>');
        stroke(d, K.ellipse(C, 26, 26, 0, 24).concat([[C[0] + 26, C[1]]]), { w: 2, color: R.pal.gold, opacity: fl, seed: 131, brush: false });
      }
      // one saber flies at the swordsman and is parried
      if (ts > tm.parry - 0.5 && ts < tm.parry + 1.2) {
        const u = inv(tm.parry - 0.5, tm.parry, ts);
        const start = back.find((o) => o.kind === 'blade' && o.i === 2).pos;
        let pos = mix(start, [720, 560], easeIn(u)), ang = 200 + u * 540;
        if (ts > tm.parry) {
          const v = ts - tm.parry;
          pos = add([720, 560], [260 * v, -420 * v + 900 * v * v]);
          ang = 200 + 540 + v * 900;
        }
        PR.saber(d, pos, ang, 150, { seed: 896 });
      }
    }
    if (broken) {
      // shattered pieces fall like leaves
      back.forEach((o, k) => {
        const age = ts - tm.hit;
        const dir = K.norm(sub(o.pos, C));
        const v = add(mul(dir, rrange(141, k, 380, 620)), [0, -180]);
        const pos = add(o.pos, add(mul(v, age), [0, 700 * age * age]));
        if (pos[1] > 1300) return;
        const fade = 1 - smooth((age - 1.6) / 1.2);
        if (fade <= 0) return;
        d.open('opacity="' + fade.toFixed(3) + '"');
        if (o.kind === 'blade') {
          for (const half of [-1, 1]) {
            const hp = add(pos, mul(K.perp(dir), half * 26 * age));
            PR.saber(d, hp, (o.th / DEG) + 90 + half * age * 260, 70, { seed: 900 + k * 2 + (half > 0 ? 1 : 0) });
          }
        } else {
          Array.from(o.w).forEach((ch, j) => {
            const cp = add(pos, [(j - o.w.length / 2) * 44 * (1 + age), Math.sin(age * 5 + j) * 20 * age]);
            text(d, ch, cp[0], cp[1], { size: 38, weight: 700, transform: 'rotate(' + ((j - 1) * 40 * age).toFixed(1) + ' ' + cp[0].toFixed(1) + ' ' + cp[1].toFixed(1) + ')' });
          });
        }
        d.close();
      });
    }
    FX.burst(d, C, 330, inv(tm.hit, tm.hit + 0.8, ts), { seed: 15, n: 18 });
    FX.ring(d, C, 420, inv(tm.hit, tm.hit + 0.9, ts), { w: 6, color: R.pal.gold });
    FX.sparks(d, C, tm.hit, ts, { n: 26, speed: 950, seed: 35 });
    // --- Linghu Chong
    const H = 440;
    const dash = SC.dp(ts, tm.thrust - 0.18, tm.thrust + 0.1, easeOut);
    const root = [lerp(520, 800, dash), GROUND - 0.49 * H + 22 * dash];
    const keys = [
      [0, { lean: 4, sh1: 60, el1: -40, sh2: -20, el2: 30, hp1: 18, kn1: 16, hp2: -16, kn2: 12, wind: 0.4 }],
      [tm.parry - 0.25, { lean: 6, sh1: 70, el1: -30, sh2: -30, el2: 30, hp1: 22, kn1: 22, hp2: -18, kn2: 14, wind: 0.5 }],
      [tm.parry, { lean: 10, sh1: 120, el1: -10, sh2: -50, el2: 20, hp1: 28, kn1: 30, hp2: -22, kn2: 10, wind: 0.7 }, easeIn],
      [tm.parry + 0.5, { lean: 4, sh1: 60, el1: -30, sh2: -25, el2: 30, hp1: 20, kn1: 20, hp2: -18, kn2: 12, wind: 0.5 }],
      [tm.thrust - 0.3, { lean: -4, sh1: 30, el1: 60, sh2: -30, el2: 30, hp1: 24, kn1: 40, hp2: -20, kn2: 30, wind: 0.6 }],
      [tm.thrust + 0.08, { lean: 22, sh1: 72, el1: 0, sh2: -70, el2: 10, hp1: 62, kn1: 68, hp2: -42, kn2: 4, wind: 1.0 }, easeIn],
      [tm.hit + 1.6, { lean: 16, sh1: 70, el1: 0, sh2: -60, el2: 12, hp1: 55, kn1: 60, hp2: -38, kn2: 6, wind: 0.6 }],
      [tm.hit + 2.8, { lean: 4, sh1: 30, el1: 30, sh2: -20, el2: 30, hp1: 18, kn1: 14, hp2: -14, kn2: 10, wind: 0.4 }],
    ];
    const pose = Object.assign(F.poseAt(keys, ts), { root, H, dir: 1, p: SC.dp(ts, 0.3, 1.2) });
    const J = F.figure(d, pose, { hair: 'bun', ribbon: true, gourd: true, seed: 61 }, ts);
    const fa = K.norm(sub(J.A1.W, J.A1.E));
    const aim = ts > tm.thrust - 0.12 && ts < tm.hit + 1.8 ? Math.atan2(C[1] - J.A1.W[1], C[0] - J.A1.W[0]) / DEG : Math.atan2(fa[1], fa[0]) / DEG - 35;
    PR.sword(d, J.A1.W, aim, H * 0.5, { p: pose.p, seed: 862, gleam: SC.dp(ts, tm.thrust, tm.thrust + 0.1) * (1 - SC.dp(ts, tm.hit, tm.hit + 0.6)) }, ts);
    const tip = add(J.A1.W, K.polar(aim * DEG, H * 0.5));
    FX.slashArc(d, add(J.A1.W, [30, -20]), 190, -120, 40, inv(tm.parry - 0.08, tm.parry + 0.5, ts), { w: 30, seed: 6 });
    FX.sparks(d, [760, 560], tm.parry, ts, { n: 12, speed: 600, seed: 37 });
    FX.streak(d, tip, C, inv(tm.thrust, tm.hit + 0.35, ts), { w: 16 });
    // the good question
    const qp = SC.dp(ts, tm.q, tm.q + 0.5, easeOutBack);
    if (qp > 0) {
      const qc = [C[0], C[1] - 10 + Math.sin(ts * 2) * 8];
      halo(d, qc, 150, 'gold', 0.55 * clamp(qp));
      text(d, '？', qc[0], qc[1] + 60 * qp, { size: 170 * qp, weight: 700, color: R.pal.gold, opacity: clamp(qp) });
    }
    d.close();
    FX.formLabel(d, 1815, 90, SC.dp(ts, tm.label, tm.label + 1.4, (x) => x), { num: '第一式', name: '獨孤九劍', skill: '採訪', out: SC.labelOut(S, ts) });
    N.leaves(d, ts, { n: 8, seed: 29, drift: 300 });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'bambooWind', gain: 0.4, dur: S.dur },
      { t: 0.6, sfx: 'bladeSwirl', gain: 0.4, dur: tm.hit - 0.6, pan: 0.4 },
      { t: tm.parry - 0.45, sfx: 'whooshSoft', gain: 0.6, pan: 0.1 },
      { t: tm.parry, sfx: 'clang', gain: 0.7, pan: -0.1 },
      { t: tm.flaw, sfx: 'chime', gain: 0.35, pan: 0.4 },
      { t: tm.thrust - 0.15, sfx: 'dash', gain: 0.9 },
      { t: tm.hit, sfx: 'swordStab', gain: 1.0, pan: 0.3 },
      { t: tm.hit + 0.03, sfx: 'shatter', gain: 0.9, pan: 0.35 },
      { t: tm.hit + 0.6, sfx: 'debris', gain: 0.5, pan: 0.3 },
      { t: tm.q, sfx: 'chimeBig', gain: 0.6, pan: 0.3 },
    ];
  }

  G.SCENES.interview = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
