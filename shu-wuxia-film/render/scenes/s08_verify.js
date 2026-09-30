/* 8. Form Three — Verification: Yang Guo's heavy iron sword (玄鐵重劍).
 * Wuxia event: training in the sea tide — waves carrying rumours (謠言、
 * 假消息、未證實) crash in; the one-armed swordsman cleaves them apart with
 * the blunt heavy sword and stands firm; truth (真相) remains. The giant
 * condor watches from the rock and takes off. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG } = K;

  const HORIZON = 560, WATER = 925;
  const RUMOURS = [['謠言', '假消息'], ['未證實', '聽說', '謠言']];

  function timing(S) {
    const l = SC.line(S, 'L14');
    const w1 = l.t0 + 1.7;
    const w2 = Math.min(S.dur - 1.6, l.t1 + 1.05);
    return { label: l.t0, w1, w2, bolt: l.t0 + 0.4, takeoff: w2 + 0.9 };
  }

  function wave(d, ts, tHit, k, tm) {
    // travels from the left, crests and is cut at tHit at x ≈ 600
    const t0 = tHit - 2.2;
    const u = inv(t0, tHit, ts);
    if (u <= 0) return;
    const cut = ts >= tHit;
    const age = ts - tHit;
    const x = lerp(-420, 560, easeIn(u) * 0.35 + u * 0.65);
    const s = (k === 0 ? 250 : 330) * lerp(0.7, 1, u);
    if (!cut) {
      const r = N.bigWave(d, x, WATER + 10, s, { phase: lerp(0.2, 0.95, u), seed: 7 + k, p: 1 });
      // rumours riding the crest
      RUMOURS[k].forEach((w, i) => {
        const c = add(r.crest, [-120 - i * 150, 60 + i * 40]);
        text(d, w, c[0], c[1], { size: 34 + (k ? 6 : 0), weight: 700, color: R.pal.soft, transform: 'rotate(-18 ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ')' });
      });
    } else if (age < 1.6) {
      // the cleaved wave collapses into two halves of spray
      const fall = easeOut(clamp(age / 1.0));
      d.open('opacity="' + (1 - smooth(age / 1.6)).toFixed(3) + '"');
      for (const side of [-1, 1]) {
        const cx = x + side * 90 * fall, cy = WATER + 10 + 140 * fall;
        N.bigWave(d, cx, cy, s * (1 - 0.5 * fall), { phase: 0.95, seed: 17 + k + side, p: 1 });
      }
      RUMOURS[k].forEach((w, i) => {
        const c = [x - 120 - i * 150 + (i % 2 ? 1 : -1) * 120 * age, WATER - s * 0.6 + 60 + 420 * age * age];
        text(d, w, c[0], c[1], { size: 34, weight: 700, color: R.pal.soft, transform: 'rotate(' + (-18 + (i % 2 ? 1 : -1) * 120 * age).toFixed(1) + ' ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ')' });
      });
      d.close();
    }
    N.spray(d, [x + 60, WATER - s * 0.7], tHit, ts, { n: 30, speed: 620, a0: -170, spread: 160, seed: 40 + k, life: 1.4 });
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    let cam = SC.cam([[0, { x: 960, y: 540, z: 1.02 }], [S.dur, { x: 1000, y: 550, z: 1.08 }]], ts);
    cam = SC.shake(cam, ts, tm.w1, 10, 0.4);
    cam = SC.shake(cam, ts, tm.w2, 16, 0.55);
    // stormy sky
    camOpen(d, cam, 0.2);
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 520 + ts * (20 + i * 6)) % 2400) - 240;
      N.cloud(d, cx, 120 + (i % 2) * 90, 1.1 + (i % 2) * 0.3, { seed: 40 + i, p: SC.dp(ts, 0.1 + i * 0.1, 1.2 + i * 0.1), fill: R.pal.fillMid, lobes: 4 });
    }
    // lightning
    const bl = inv(tm.bolt, tm.bolt + 0.35, ts);
    if (bl > 0 && bl < 1) {
      const pts = [[1250, 60]];
      for (let i = 1; i <= 7; i++) pts.push([1250 + (i % 2 ? -1 : 1) * rrange(171, i, 20, 55) - i * 18, 60 + i * 65]);
      stroke(d, pts, { w: 5, color: R.pal.gold, opacity: 1 - bl, seed: 172, brush: false, amp: 0 });
      d.add('<rect x="-10" y="-10" width="1940" height="1100" fill="#fff4dc" opacity="' + (0.18 * (1 - bl)).toFixed(3) + '"/>');
    }
    d.close();
    // rain streaks (restrained)
    for (let i = 0; i < 26; i++) {
      const x = ((i * 97 + ts * 700) % 2200) - 140, y = ((i * 211 + ts * 1100) % 1300) - 150;
      stroke(d, [[x, y], [x - 14, y + 44]], { w: 1.4, color: R.pal.faint, seed: 180 + i, brush: false, amp: 0 });
    }
    camOpen(d, cam, 0.5);
    N.sea(d, { x0: -300, x1: 2220, y0: HORIZON, y1: WATER, speed: 70, p: SC.dp(ts, 0, 1.0) }, ts);
    d.close();
    camOpen(d, cam, 1);
    // the rock and the condor
    const rockP = SC.dp(ts, 0.3, 1.3);
    N.rock(d, 1570, WATER + 30, 210, { seed: 44, p: rockP, wide: 1.25, tall: 1.4 });
    const tk = ts - tm.takeoff;
    if (tk < 0) {
      F.eagle(d, [1545, WATER - 330], 130, ts, { mode: 'perch', dir: -1, p: SC.dp(ts, 0.8, 1.8) });
    } else {
      const c = [lerp(1480, 760, easeIn(clamp(tk / 2.2))), WATER - 360 - 330 * easeOut(clamp(tk / 2.2))];
      F.eagle(d, c, 118, ts, { mode: 'fly', dir: -1, rate: 4, phase: 1 });
    }
    // waves (behind the swordsman)
    wave(d, ts, tm.w1, 0, tm);
    wave(d, ts, tm.w2, 1, tm);
    // Yang Guo
    const H = 470;
    const swing = (tHit) => {
      const u = inv(tHit - 0.55, tHit + 0.25, ts);
      return u;
    };
    const s1 = swing(tm.w1), s2 = swing(tm.w2);
    const raised = { lean: -8, sh1: 150, el1: 20, sh2: 0, el2: 0, hp1: 30, kn1: 26, hp2: -30, kn2: 8, wind: 0.8 };
    const cutP = { lean: 16, sh1: 80, el1: 4, sh2: 0, el2: 0, hp1: 40, kn1: 40, hp2: -36, kn2: 4, wind: 1.0 };
    const follow = { lean: 10, sh1: 40, el1: 10, sh2: 0, el2: 0, hp1: 36, kn1: 36, hp2: -32, kn2: 6, wind: 0.8 };
    const ready = { lean: 2, sh1: 100, el1: -20, sh2: 0, el2: 0, hp1: 26, kn1: 22, hp2: -26, kn2: 8, wind: 0.7 };
    const seg = (u, a, b, c2) => (u < 0.55 ? F.lerpPose(a, b, easeIn(u / 0.55)) : F.lerpPose(b, c2, easeOut((u - 0.55) / 0.45)));
    let pose;
    if (s2 > 0) pose = s2 < 1 ? seg(s2, raised, cutP, follow) : F.lerpPose(follow, ready, SC.dp(ts, tm.w2 + 0.3, tm.w2 + 1.6));
    else if (s1 > 0) pose = s1 < 1 ? seg(s1, raised, cutP, follow) : F.lerpPose(follow, raised, SC.dp(ts, tm.w1 + 0.4, tm.w2 - 0.6));
    else pose = F.lerpPose(ready, raised, SC.dp(ts, tm.w1 - 1.4, tm.w1 - 0.6));
    Object.assign(pose, { root: [720, WATER + 40 - 0.49 * H], H, dir: 1, p: SC.dp(ts, 0.3, 1.2) });
    const J = F.figure(d, pose, { hair: 'long', ribbon: false, oneArm: true, seed: 81, hem: 0.39 }, ts);
    const fa = K.norm(sub(J.A1.W, J.A1.E));
    const sang = Math.atan2(fa[1], fa[0]) / DEG - 12;
    PR.heavySword(d, J.A1.W, sang, H * 0.56, { p: pose.p });
    FX.slashArc(d, add(J.A1.S, [30, 0]), 300, -120, 60, inv(tm.w1 - 0.12, tm.w1 + 0.5, ts), { w: 52, seed: 8 });
    FX.slashArc(d, add(J.A1.S, [30, 0]), 360, -130, 70, inv(tm.w2 - 0.12, tm.w2 + 0.55, ts), { w: 70, seed: 9 });
    // truth remains after the second cut
    const tp = SC.dp(ts, tm.w2 + 0.45, tm.w2 + 1.0, easeOutBack);
    if (tp > 0) {
      const c = [470, 470 - 30 * clamp(tp) + Math.sin(ts * 1.6) * 6];
      halo(d, c, 170, 'gold', 0.55 * clamp(tp));
      text(d, '真相', c[0], c[1] + 36, { size: 104 * lerp(0.6, 1, clamp(tp)), weight: 700, color: R.pal.gold, opacity: clamp(tp), spacing: 8 });
    }
    // foreground water hides the legs below the knees
    const fw = [];
    for (let x = -300; x <= 2220; x += 20) fw.push([x, WATER + Math.sin(x / 60 - ts * 3) * 7 + Math.sin(x / 23 + ts * 5) * 3]);
    K.shape(d, fw.concat([[2220, 1300], [-300, 1300]]), { p: 1, fill: R.pal.fillNear, noStroke: true, amp: 0 });
    stroke(d, fw, { w: 3, seed: 190, p: SC.dp(ts, 0, 0.9) });
    for (let r = 0; r < 4; r++) {
      const y = WATER + 40 + r * 38;
      const pts = [];
      for (let x = -300; x <= 2220; x += 24) pts.push([x, y + Math.sin(x / (50 + r * 10) - ts * (2.5 + r * 0.4) + r) * (5 + r * 2)]);
      stroke(d, pts, { w: 2.2, color: R.pal.soft, seed: 191 + r, p: SC.dp(ts, 0.2, 1.0) });
    }
    N.spray(d, [760, WATER - 10], tm.w1 + 0.05, ts, { n: 14, speed: 380, seed: 61, life: 1 });
    N.spray(d, [760, WATER - 10], tm.w2 + 0.05, ts, { n: 20, speed: 460, seed: 62, life: 1.1 });
    d.close();
    FX.formLabel(d, 1830, 90, SC.dp(ts, tm.label, tm.label + 1.4, (x) => x), { num: '第三式', name: '玄鐵重劍', skill: '查證', out: SC.labelOut(S, ts) });
  }

  function cues(S) {
    const tm = timing(S);
    return [
      { t: 0, sfx: 'oceanLoop', gain: 0.45, dur: S.dur },
      { t: 0, sfx: 'stormWind', gain: 0.3, dur: S.dur },
      { t: tm.bolt, sfx: 'thunder', gain: 0.7, pan: 0.3 },
      { t: tm.w1 - 1.0, sfx: 'waveRise', gain: 0.6, pan: -0.5 },
      { t: tm.w1 - 0.35, sfx: 'heavySwing', gain: 0.9 },
      { t: tm.w1, sfx: 'waveCrash', gain: 0.6, pan: -0.2 },
      { t: tm.w2 - 1.0, sfx: 'waveRise', gain: 0.7, pan: -0.5 },
      { t: tm.w2 - 0.35, sfx: 'heavySwing', gain: 1.0 },
      { t: tm.w2, sfx: 'waveCrash', gain: 0.8, pan: -0.2 },
      { t: tm.w2 + 0.5, sfx: 'chimeBig', gain: 0.5, pan: -0.3 },
      { t: tm.takeoff - 0.3, sfx: 'eagleCry', gain: 0.8, pan: 0.5 },
      { t: tm.takeoff, sfx: 'wingFlap', gain: 0.6, pan: 0.4 },
    ];
  }

  G.SCENES.verify = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
