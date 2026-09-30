/* 9. Form Four — Editing: Zhang Wuji's Great Shift of Heaven and Earth.
 * Wuxia event: lead type, photos, pages, a camera and a microphone orbit
 * him in a vortex; with one push he "shifts" them into a newspaper layout,
 * which then transforms into a phone screen (lead type -> digital news). */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange, DEG, TAU, rectPts, f1 } = K;

  const GROUND = 930, C = [720, 560];
  const PAGE = { x: 1070, y: 160, w: 560, h: 720 };
  const PHONE = { cx: 1350, cy: 520, w: 350, h: 690 };
  const OBJS = [
    { kind: 'type', ch: '小', slot: [1245, 250], ss: 88 },
    { kind: 'type', ch: '世', slot: [1350, 250], ss: 88 },
    { kind: 'type', ch: '界', slot: [1455, 250], ss: 88 },
    { kind: 'photo', slot: [1200, 450], sw: 210, sh: 150 },
    { kind: 'paper', slot: [1470, 450], sw: 210, sh: 150 },
    { kind: 'paper', slot: [1200, 650], sw: 210, sh: 150 },
    { kind: 'photo', slot: [1470, 650], sw: 210, sh: 150 },
    { kind: 'camera', slot: [1175, 815], ss: 70 },
    { kind: 'mic', slot: [1270, 820], ss: 70 },
    { kind: 'type', ch: '新', slot: [1420, 815], ss: 62 },
    { kind: 'type', ch: '聞', slot: [1505, 815], ss: 62 },
  ];

  function timing(S) {
    const l16 = SC.line(S, 'L16'), l17 = SC.line(S, 'L17');
    const push = l16.t1 + 0.3;
    const morph = l17 ? l17.t0 + 1.3 : push + 1.35;
    return { label: l16.t0, push, landed: push + 1.1, morph, morph1: morph + 0.9 };
  }

  function drawObj(d, o, c, s, ang, k, p = 1) {
    if (o.kind === 'type') PR.leadType(d, c, (o.ss || 70) * s, o.ch, { ang, seed: 760 + k * 5, p });
    else if (o.kind === 'photo') PR.photoCard(d, c, (o.sw || 180) * s, (o.sh || 130) * s, { ang, seed: 770 + k * 5, p });
    else if (o.kind === 'paper') PR.newspaper(d, c, (o.sw || 180) * s, (o.sh || 130) * s, { ang, seed: 780 + k * 5, cols: 2, rows: 4, lw: 2, p });
    else if (o.kind === 'camera') PR.camera(d, c, (o.ss || 80) * s, { seed: 790 + k, p });
    else if (o.kind === 'mic') PR.mic(d, c, (o.ss || 80) * s, { seed: 796 + k, p });
  }

  function draw(d, ts, S) {
    const tm = timing(S);
    let cam = SC.cam([[0, { x: 940, y: 540, z: 1.0 }], [tm.push, { x: 960, y: 540, z: 1.03 }], [S.dur, { x: 1010, y: 540, z: 1.05 }]], ts);
    cam = SC.shake(cam, ts, tm.push, 8, 0.35);
    camOpen(d, cam, 0.25);
    N.cloud(d, 260 + ts * 10, 170, 0.8, { seed: 51, p: SC.dp(ts, 0.1, 1.2) });
    N.mountains(d, { peaks: [{ x: 100, h: 300, w: 380 }, { x: 600, h: 380, w: 420 }, { x: 1300, h: 280, w: 420 }, { x: 1900, h: 340, w: 400 }], base: 860, seed: 101, p: SC.dp(ts, 0, 1.3), fill: R.pal.fillFar, w: 2.2, texture: 8 });
    N.mist(d, { y: 780, h: 100, amp: 8, seed: 9, opacity: SC.dp(ts, 0.4, 1.3), fill: R.pal.fillFar }, ts);
    d.close();
    camOpen(d, cam, 1);
    // stone platform
    shape(d, [[-200, GROUND], [2120, GROUND], [2120, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.7), fill: R.pal.fillNear, w: 3, seed: 201, start: 0 });
    stroke(d, K.ellipse([C[0], GROUND + 40], 420, 46, 0, 60).concat([[C[0] + 420, GROUND + 40]]), { p: SC.dp(ts, 0.4, 1.2), w: 2.4, seed: 202, color: R.pal.soft });
    // orbit state
    const omega = (t) => { const tt = Math.min(t, tm.push); return 1.0 * tt + 0.22 * tt * tt; };
    const a0 = omega(ts);
    const orbit = OBJS.map((o, k) => {
      const th = a0 + k / OBJS.length * TAU;
      const pos = add(C, rot([Math.cos(th) * 410, Math.sin(th) * 135], -8 * DEG));
      const z = Math.sin(th);
      return { o, k, th, pos: [pos[0], pos[1] + Math.sin(ts * 2 + k) * 10], z, s: 0.8 + 0.22 * z, ang: Math.sin(ts * 1.5 + k) * 25 };
    });
    const vis = SC.dp(ts, 0.5, 1.4);
    const flying = ts >= tm.push;
    const place = (e) => {
      const u = inv(tm.push + e.k * 0.05, tm.push + e.k * 0.05 + 0.6, ts);
      return { u, pos: mix(e.pos, e.o.slot, easeInOut(u)), s: lerp(e.s, 1, u), ang: lerp(e.ang, 0, u) };
    };
    // swirl trails behind
    if (!flying) {
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let j = 0; j <= 26; j++) { const th = a0 * 1.05 + k * 2.1 + j * 0.13; pts.push(add(C, rot([Math.cos(th) * (440 - k * 30), Math.sin(th) * (150 - k * 12)], -8 * DEG))); }
        stroke(d, pts, { w: 2.2, color: R.pal.goldSoft, opacity: 0.8 * vis, seed: 210 + k });
      }
    }
    if (!flying) orbit.filter((e) => e.z < 0).forEach((e) => { d.open('opacity="' + vis.toFixed(3) + '"'); drawObj(d, e.o, e.pos, e.s, e.ang, e.k); d.close(); });
    // Zhang Wuji
    const H = 450, root = [700, GROUND - 0.49 * H];
    let pose;
    const circ = ts * 2.6;
    if (ts < tm.push - 0.25) {
      const g = SC.dp(ts, 0.6, 1.4);
      pose = { lean: 4, hp1: 26, kn1: 30, hp2: -26, kn2: 30, wind: 0.5, sh1: 30, el1: 60, sh2: -20, el2: 60 };
      pose.hand1 = [root[0] + 120 + Math.cos(circ) * 70 * g, root[1] - 70 + Math.sin(circ) * 70 * g];
      pose.hand2 = [root[0] + 100 + Math.cos(circ + Math.PI) * 70 * g, root[1] - 70 + Math.sin(circ + Math.PI) * 70 * g];
      pose.bend1 = 1; pose.bend2 = 1;
    } else {
      pose = F.poseAt([
        [tm.push - 0.25, { lean: -4, hp1: 30, kn1: 34, hp2: -28, kn2: 30, sh1: 40, el1: 100, sh2: 30, el2: 100, wind: 0.7 }],
        [tm.push + 0.05, { lean: 12, hp1: 40, kn1: 44, hp2: -34, kn2: 8, sh1: 86, el1: 0, sh2: 80, el2: 6, wind: 1.0 }, easeIn],
        [tm.landed + 0.4, { lean: 8, hp1: 34, kn1: 38, hp2: -30, kn2: 10, sh1: 70, el1: 10, sh2: 60, el2: 16, wind: 0.6 }],
        [tm.landed + 1.8, { lean: 2, hp1: 16, kn1: 14, hp2: -16, kn2: 12, sh1: 20, el1: 60, sh2: 10, el2: 60, wind: 0.4 }],
      ], ts);
    }
    Object.assign(pose, { root, H, dir: 1, p: SC.dp(ts, 0.3, 1.2) });
    const J = F.figure(d, pose, { hair: 'bun', ribbon: true, seed: 91, hand1: 'palm', hand2: 'palm', ribbonColor: R.pal.gold }, ts);
    FX.qiSwirl(d, [C[0] + 40, C[1] + 10], 150, ts, { p: vis * (1 - SC.dp(ts, tm.push, tm.push + 0.3)), n: 4, speed: 3.5 });
    if (!flying) orbit.filter((e) => e.z >= 0).forEach((e) => { d.open('opacity="' + vis.toFixed(3) + '"'); drawObj(d, e.o, e.pos, e.s, e.ang, e.k); d.close(); });
    FX.burst(d, add(J.A1.W, [40, 0]), 220, inv(tm.push, tm.push + 0.5, ts), { seed: 25, n: 12 });
    // the page layout, then the phone
    if (flying) {
      const m = SC.dp(ts, tm.morph, tm.morph1, easeInOut);
      const pc = [PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2];
      const sc = lerp(1, 0.52, m);
      const tr = (q) => add([lerp(pc[0], PHONE.cx, m), lerp(pc[1], PHONE.cy, m)], mul(sub(q, pc), sc));
      // page frame fades as the phone frame draws
      const fp = SC.dp(ts, tm.push, tm.push + 0.6);
      if (m < 1) {
        const fr = rectPts(PAGE.x, PAGE.y, PAGE.w, PAGE.h).map(tr);
        shape(d, fr, { p: fp, w: 3.4, seed: 221, fill: R.pal.fillMid, fillOpacity: 1, opacity: 1 - m });
        stroke(d, [tr([PAGE.x + 24, PAGE.y + 320]), tr([PAGE.x + PAGE.w - 24, PAGE.y + 320])], { p: fp, w: 2, seed: 222, brush: false, opacity: 1 - m });
      }
      if (m > 0) {
        PR.phone(d, [PHONE.cx, PHONE.cy], PHONE.w, PHONE.h, { p: m, seed: 781, fill: R.pal.fillMid });
        halo(d, [PHONE.cx, PHONE.cy], 420, 'gold', 0.3 * m);
      }
      orbit.forEach((e) => {
        const pl = place(e);
        const pos = pl.u < 1 ? pl.pos : tr(e.o.slot);
        const s = pl.u < 1 ? pl.s : sc;
        drawObj(d, e.o, pos, s, pl.ang, e.k);
      });
      // digital touches on the phone
      const dg = SC.dp(ts, tm.morph1 - 0.2, tm.morph1 + 0.5);
      if (dg > 0) {
        const pv = tr([1200, 450]);
        shape(d, K.ellipse(pv, 34, 34, 0, 20), { p: dg, w: 2.4, seed: 231, color: R.pal.gold, fill: R.pal.fill });
        shape(d, [add(pv, [-10, -16]), add(pv, [18, 0]), add(pv, [-10, 16])], { p: dg, w: 2, seed: 232, color: R.pal.gold, fill: R.pal.gold });
        for (let k = 0; k < 3; k++) {
          const c = [PHONE.cx + PHONE.w * 0.3, PHONE.cy - PHONE.h * 0.42];
          stroke(d, K.arc(c, 8 + k * 8, -135 * DEG, -45 * DEG, 10), { p: dg, w: 2, seed: 233 + k, color: R.pal.gold, brush: false });
        }
        text(d, 'LIVE', PHONE.cx - PHONE.w * 0.28, PHONE.cy - PHONE.h * 0.4, { font: "'Cormorant Garamond', serif", weight: 600, size: 22, color: R.pal.gold, opacity: dg, anchor: 'start', spacing: 2 });
      }
      FX.burst(d, [PHONE.cx, PHONE.cy], 380, inv(tm.morph1 - 0.2, tm.morph1 + 0.6, ts), { seed: 27, n: 14 });
    }
    d.close();
    FX.formLabel(d, 1830, 90, SC.dp(ts, tm.label, tm.label + 1.4, (x) => x), { num: '第四式', name: '乾坤大挪移', skill: '編輯', size2: 82, out: SC.labelOut(S, ts) });
    N.motes(d, ts, { n: 10, seed: 91, area: [300, 1200, 250, 900] });
  }

  function cues(S) {
    const tm = timing(S);
    const c = [{ t: 0, sfx: 'windSoft', gain: 0.35, dur: S.dur }, { t: 0.5, sfx: 'swirlLoop', gain: 0.6, dur: tm.push - 0.5 }];
    c.push({ t: tm.push - 0.2, sfx: 'palmStrike', gain: 0.75 });
    c.push({ t: tm.push, sfx: 'whooshLong', gain: 0.6, pan: 0.4 });
    OBJS.forEach((o, k) => c.push({ t: tm.push + k * 0.05 + 0.6, sfx: 'snap', gain: 0.35, pan: 0.4 }));
    c.push({ t: tm.morph, sfx: 'shimmer', gain: 0.5, pan: 0.4, dur: tm.morph1 - tm.morph });
    c.push({ t: tm.morph1, sfx: 'phoneChime', gain: 0.7, pan: 0.4 });
    return c;
  }

  G.SCENES.editing = { draw, cues };
})(typeof window !== 'undefined' ? window : globalThis);
