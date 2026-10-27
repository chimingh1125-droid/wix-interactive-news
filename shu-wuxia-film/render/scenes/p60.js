/* 60-second promo cut (script_60s.json), seven scenes at fixed times:
 *   p60_open    舍我樓, 世新山洞, crane, gold title plaque
 *   p60_qiao    喬峰's Dragon-Subduing Palm shatters old media into digital light
 *   p60_yang    楊過's heavy sword writes "AI", unlocking 《AI 與媒體產業》
 *   p60_linghu  令狐沖's nine thrusts become nine Reels frames
 *   p60_zhang   張無忌 merges four skills into a light orb
 *   p60_pass    the four heroes hand the manual to a high-school student
 *   p60_end     night: the department logo and the recruitment call
 * Beats are timed from the narration lines (SC.line) so picture and voice
 * stay in step whatever the measured line lengths are. */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG, SC = G.SC, P = G.PROMO;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, add, sub, mul, mix, rot, stroke, shape, halo, text, camOpen, rnd, rrange,
    DEG, TAU, rectPts, f1 } = K;
  const GROUND = 930;
  const LOOK = {
    qiao: { hair: 'bun', ribbon: false, beard: 'full', build: 1.28, seed: 71, hand1: 'palm', hand2: 'palm', sashColor: '#ebbb52' },
    yang: { hair: 'long', ribbon: false, oneArm: true, seed: 81, hem: 0.39 },
    linghu: { hair: 'bun', ribbon: true, gourd: true, seed: 61 },
    zhang: { hair: 'bun', ribbon: true, seed: 91, hand1: 'palm', hand2: 'palm', ribbonColor: '#ebbb52' },
  };
  const L = (S, id) => SC.line(S, id);
  // The score runs at 133⅓ BPM with a downbeat on every segment change (audio/music.py),
  // so rhythmic runs and the big hits land on its eighth notes.
  const BEAT = 0.45;
  const onBeat = (S, t, step = BEAT / 2) => { const g = S.seg[0] - S.start; return g + Math.ceil((t - g) / step - 1e-6) * step; };

  function hills(d, ts, cam, seed, o = {}) {
    camOpen(d, cam, 0.25);
    N.cloud(d, 260 + ts * 14, 150, 0.85, { seed: seed + 1, p: SC.dp(ts, 0.1, 1.0) });
    N.cloud(d, 1250 + ts * 10, 110, 0.7, { seed: seed + 2, tailDir: 1, p: SC.dp(ts, 0.2, 1.1) });
    N.mountains(d, { peaks: o.peaks || [{ x: 200, h: 300, w: 420 }, { x: 860, h: 250, w: 460 }, { x: 1550, h: 360, w: 460 }, { x: 2150, h: 280, w: 420 }], base: 870, seed, p: SC.dp(ts, 0, 1.0), fill: R.pal.fillFar, w: 2.2, texture: 8 });
    d.close();
  }
  function ground(d, ts, seed) {
    shape(d, [[-200, GROUND], [2300, GROUND], [2300, 1300], [-200, 1300]], { p: SC.dp(ts, 0, 0.6), fill: R.pal.fillNear, w: 3, seed, start: 0 });
  }
  const label = (d, ts, S, t0, num, name, skill) =>
    FX.formLabel(d, 1830, 80, SC.dp(ts, t0, t0 + 1.2, (x) => x), { num, name, skill, size1: 40, size2: 78, out: SC.labelOut(S, ts) });

  // ===================================================== 1. opening + title
  G.SCENES.p60_open = {
    draw(d, ts, S) {
      const cardP = inv(1.45, 3.9, ts);
      const cam = SC.cam([[0, { x: 960, y: 560, z: 1.0 }], [S.dur, { x: 960, y: 540, z: 1.07 }]], ts);
      camOpen(d, cam, 0.2);
      N.mountains(d, { peaks: [{ x: 160, h: 380, w: 380 }, { x: 640, h: 300, w: 420 }, { x: 1180, h: 420, w: 400 }, { x: 1780, h: 340, w: 420 }], base: 880, seed: 501, p: SC.dp(ts, 0, 0.9), fill: R.pal.fillFar, w: 2.2, texture: 8 });
      N.mist(d, { y: 760, h: 90, amp: 10, seed: 3, opacity: SC.dp(ts, 0.3, 1.0), fill: R.pal.fillFar }, ts);
      d.close();
      camOpen(d, cam, 0.5);
      N.cloud(d, 300 + ts * 22, 240, 0.9, { seed: 505, p: SC.dp(ts, 0.2, 0.9) });
      N.cloud(d, 1500 - ts * 16, 170, 0.75, { seed: 506, tailDir: 1, p: SC.dp(ts, 0.3, 1.0) });
      // the white crane crossing the sky
      const cx = lerp(-220, 2150, inv(0.5, 4.8, ts));
      if (ts > 0.5 && ts < 4.8) N.crane(d, cx, 300 - 60 * inv(0.5, 4.8, ts), 0.95, ts, { rate: 5.5 });
      d.close();
      camOpen(d, cam, 1);
      ground(d, ts, 507);
      for (const [x, s, sd] of [[70, 1.0, 1], [640, 0.8, 2], [1180, 0.85, 3], [1860, 1.0, 4]]) N.pine(d, x, GROUND, s, { seed: 510 + sd, p: SC.dp(ts, 0.3, 1.2) }, ts);
      A.tunnel(d, 330, GROUND, 240, 280, { p: SC.dp(ts, 0.1, 1.2), plaque: '世新大學' });
      P.shewo(d, 1510, GROUND, { p: SC.dp(ts, 0.25, 1.4), lit: 0.15 });
      N.mist(d, { y: 905, h: 50, amp: 6, seed: 9, opacity: 0.6 * SC.dp(ts, 0.6, 1.4), fill: R.pal.fillMid }, ts);
      d.close();
      P.titleCard(d, [960, 470], cardP, { size: 88, w: 1000, h: 168 });
      if (ts > 3.9) for (let k = 0; k < 7; k++) { const ph = ((ts - 3.9) * 0.9 + k / 7) % 1; P.sparkle(d, [520 + 880 * rnd(520, k), 380 + 180 * rnd(521, k)], 14 * Math.sin(ph * Math.PI), R.pal.gold, Math.sin(ph * Math.PI)); }
      N.motes(d, ts, { n: 10, seed: 522, area: [300, 1600, 250, 900] });
    },
    cues(S) {
      return [
        { t: 0.0, sfx: 'windSoft', gain: 0.3, dur: S.dur },
        { t: 0.9, sfx: 'craneCall', gain: 0.45, pan: -0.4 },
        { t: 1.45, sfx: 'inkSpread', gain: 0.9 },
        { t: 2.2, sfx: 'shimmer', gain: 0.5, dur: 1.6 },
        { t: 3.9, sfx: 'chime', gain: 0.55 },
      ];
    },
  };

  // =============================================== 2. 喬峰: old media shattered
  function timingQiao(S) {
    const l3 = L(S, 'P03'), l4 = L(S, 'P04');
    const strike = onBeat(S, l3.t0 + 1.1);
    return { gather: l3.t0 - 0.25, strike, hit: strike + 0.95, wave: l4.t0 + 0.05, crash: l4.t1 - 0.9, stand: l4.t1 - 1.0 };
  }
  const QPATH = K.spline([[560, 560], [760, 400], [980, 330], [1180, 400], [1380, 560]], 14);
  const CAM_C = [1300, 600], STACK_C = [1650, 770];
  function oldMedia(d) {
    P.oldCamera(d, CAM_C, 190, { base: GROUND });
    shape(d, rectPts(1545, 840, 210, 90), { w: 2.6, seed: 2390, fill: R.pal.fillMid });
    for (let k = 1; k < 3; k++) stroke(d, [[1548, 840 + k * 30], [1752, 840 + k * 30]], { w: 1.4, seed: 2391 + k, brush: false, color: R.pal.soft });
    P.paperStack(d, STACK_C, 200, {});
  }
  G.SCENES.p60_qiao = {
    draw(d, ts, S) {
      const tm = timingQiao(S);
      let cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.strike, { x: 990, y: 540, z: 1.03 }], [tm.wave + 1, { x: 1060, y: 520, z: 1.06 }], [S.dur, { x: 1040, y: 530, z: 1.05 }]], ts);
      cam = SC.shake(cam, ts, tm.hit, 18, 0.5);
      cam = SC.shake(cam, ts, tm.stand, 10, 0.4);
      hills(d, ts, cam, 531);
      camOpen(d, cam, 1);
      ground(d, ts, 532);
      // old newspapers and camera, smashed into digital light by the dragon
      const mp = SC.dp(ts, 0.2, 1.1);
      if (ts < tm.hit) { d.open('opacity="' + mp.toFixed(3) + '"'); oldMedia(d); d.close(); }
      else P.shatter(d, oldMedia, [1080, 380, 1780, 930], [1150, 560], tm.hit, ts, { seed: 2500, cols: 5, rows: 4, pixels: 240, rise: 320, scale: 1.4 });
      // the media wave of light points
      const wp = SC.dp(ts, tm.wave, tm.wave + 1.6, easeOut);
      const crash = SC.dp(ts, tm.crash, tm.crash + 1.2, easeIn);
      if (wp > 0 && crash < 1) P.digitalWave(d, [1860, GROUND], 980, 600, ts, wp, crash, { dir: -1 });
      if (ts > tm.crash) P.pixels(d, [900, 300, 1850, 900], tm.crash + 0.3, ts, { n: 90, seed: 2650, life: 4.5, rise: 120, scale: 1.2 });
      // 喬峰
      const H = 470;
      const g = SC.dp(ts, tm.gather, tm.gather + 0.7);
      const root = [380, GROUND - 0.49 * H + 30 * g];
      let pose;
      if (ts < tm.strike - 0.25) {
        pose = { lean: 2, hp1: lerp(10, 36, g), kn1: lerp(8, 48, g), hp2: lerp(-10, -36, g), kn2: lerp(8, 48, g), wind: 0.4 + 0.5 * g, sh1: 10, el1: 30, sh2: -8, el2: 30 };
        if (g > 0) {
          const circ = ts * 3.4;
          pose.hand1 = [root[0] + 120 + Math.cos(circ) * 55 * g, root[1] - 40 + Math.sin(circ) * 45 * g];
          pose.hand2 = [root[0] + 110 + Math.cos(circ + Math.PI) * 55 * g, root[1] - 40 + Math.sin(circ + Math.PI) * 45 * g];
          pose.bend1 = 1; pose.bend2 = 1;
        }
      } else {
        pose = F.poseAt([
          [tm.strike - 0.25, { lean: -6, hp1: 36, kn1: 48, hp2: -36, kn2: 48, sh1: 20, el1: 110, sh2: 10, el2: 110, wind: 0.9 }],
          [tm.strike, { lean: 16, hp1: 44, kn1: 50, hp2: -40, kn2: 10, sh1: 86, el1: 0, sh2: 82, el2: 4, wind: 1.0 }, easeIn],
          [tm.hit + 1.0, { lean: 10, hp1: 40, kn1: 44, hp2: -36, kn2: 14, sh1: 78, el1: 6, sh2: 72, el2: 10, wind: 0.8 }],
          [tm.stand - 0.3, { lean: 0, hp1: 30, kn1: 40, hp2: -30, kn2: 40, sh1: 40, el1: 70, sh2: 30, el2: 70, wind: 0.9 }],
          [tm.stand, { lean: -2, hp1: 40, kn1: 56, hp2: -40, kn2: 56, sh1: 60, el1: 20, sh2: -40, el2: 20, wind: 1.0 }, easeIn],
          [S.dur, { lean: -2, hp1: 38, kn1: 52, hp2: -38, kn2: 52, sh1: 56, el1: 24, sh2: -36, el2: 24, wind: 0.6 }],
        ], ts);
      }
      const sink = ts > tm.stand ? 26 * SC.dp(ts, tm.stand - 0.1, tm.stand + 0.15) : 0;
      Object.assign(pose, { root: [root[0] + 26 * SC.dp(ts, tm.strike - 0.2, tm.strike), root[1] + sink], H, dir: 1, p: SC.dp(ts, 0.2, 1.0) });
      const J = F.figure(d, pose, LOOK.qiao, ts);
      const qg = g * (1 - SC.dp(ts, tm.strike, tm.strike + 0.2));
      FX.qiSwirl(d, mix(J.A1.W, J.A2.W, 0.5), 110, ts, { p: qg, n: 6 });
      halo(d, mix(J.A1.W, J.A2.W, 0.5), 140, 'gold', 0.5 * qg);
      if (qg > 0.05) FX.ring(d, [root[0], GROUND], 380, (ts % 1.2) / 1.2, { w: 3 * qg, ry: 0.18, color: R.pal.soft });
      // golden palm force as a dragon
      const hd = SC.dp(ts, tm.strike, tm.hit, (x) => 1 - Math.pow(1 - x, 1.5));
      const fade = 1 - SC.dp(ts, tm.hit, tm.hit + 0.35);
      if (hd > 0 && fade > 0) {
        d.open('opacity="' + fade.toFixed(3) + '"');
        F.dragon(d, QPATH, hd, ts, { len: 760, width: 80, flip: 1, p: SC.dp(ts, tm.strike, tm.strike + 0.35) });
        d.close();
      }
      FX.burst(d, add(J.A1.W, [30, 0]), 200, inv(tm.strike, tm.strike + 0.5, ts), { seed: 23, n: 12 });
      FX.burst(d, [1300, 600], 420, inv(tm.hit, tm.hit + 0.8, ts), { seed: 24, n: 18 });
      FX.ring(d, [1300, 600], 520, inv(tm.hit, tm.hit + 0.9, ts), { w: 6, color: R.pal.gold });
      // standing firm: shock ring on the ground, aura
      FX.ring(d, [root[0] + 26, GROUND], 560, inv(tm.stand, tm.stand + 0.9, ts), { w: 5, ry: 0.16, color: R.pal.gold });
      if (ts > tm.stand) halo(d, add(J.neck, [0, 40]), 260, 'gold', 0.35 * SC.dp(ts, tm.stand, tm.stand + 0.4));
      d.close();
      label(d, ts, S, L(S, 'P03').t0 - 0.2, '喬峰', '降龍十八掌', '創新');
      N.motes(d, ts, { n: 10, seed: 533, area: [900, 1800, 300, 900] });
    },
    cues(S) {
      const tm = timingQiao(S);
      return [
        { t: 0, sfx: 'windSoft', gain: 0.3, dur: S.dur },
        { t: tm.gather, sfx: 'qiCharge', gain: 0.75, dur: tm.strike - tm.gather },
        { t: tm.strike, sfx: 'palmStrike', gain: 1.0 },
        { t: tm.strike + 0.12, sfx: 'dragonRoar', gain: 0.75, pan: 0.1 },
        { t: tm.strike + 0.25, sfx: 'whooshLong', gain: 0.6, pan: 0.3 },
        { t: tm.hit, sfx: 'shatter', gain: 0.95, pan: 0.45 },
        { t: tm.hit + 0.05, sfx: 'debris', gain: 0.6, pan: 0.45 },
        { t: tm.hit + 0.15, sfx: 'digitalSparkle', gain: 0.6, pan: 0.4, dur: 1.6 },
        { t: tm.wave, sfx: 'waveRise', gain: 0.6, pan: 0.4 },
        { t: tm.stand, sfx: 'land', gain: 0.9, pan: -0.3 },
        { t: tm.crash, sfx: 'digitalSparkle', gain: 0.5, pan: 0.2, dur: 1.2 },
      ];
    },
  };

  // ========================================= 3. 楊過: "AI" unlocks the course
  function timingYang(S) {
    const l5 = L(S, 'P05'), l6 = L(S, 'P06');
    const draw = l5.t0 + 0.25, unlock = onBeat(S, draw + 2.25);
    return { draw, write: draw + 0.75, stream: unlock - 0.3, unlock, gen: onBeat(S, l6.t0), weapon: l6.t1 - 0.6 };
  }
  const MON = { c: [1350, 450], w: 640, h: 420 };
  G.SCENES.p60_yang = {
    draw(d, ts, S) {
      const tm = timingYang(S);
      const cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.unlock, { x: 1000, y: 530, z: 1.03 }], [S.dur, { x: 1060, y: 520, z: 1.06 }]], ts);
      hills(d, ts, cam, 541, { peaks: [{ x: 300, h: 260, w: 420 }, { x: 1000, h: 330, w: 460 }, { x: 1750, h: 280, w: 420 }] });
      camOpen(d, cam, 1);
      ground(d, ts, 542);
      // desk with the computer
      const dp = SC.dp(ts, 0.2, 1.0);
      shape(d, rectPts(1010, 772, 680, 26), { p: dp, w: 2.6, seed: 543, fill: R.pal.fillMid });
      for (const x of [1040, 1650]) stroke(d, [[x, 798], [x, GROUND]], { p: dp, w: 3, seed: 544 + x });
      const unlock = SC.dp(ts, tm.unlock, tm.unlock + 0.6);
      const gen = SC.dp(ts, tm.gen, tm.gen + 2.2, (x) => x);
      P.monitor(d, MON.c, MON.w, MON.h, ts, { unlock, title: SC.dp(ts, tm.unlock + 0.3, tm.unlock + 1.0, (x) => x), layers: gen, play: ts > tm.gen ? (ts - tm.gen) * 0.35 : 0, glow: 0.6 * SC.dp(ts, tm.stream, tm.unlock + 0.4) * (1 - 0.5 * SC.dp(ts, tm.unlock + 0.6, tm.unlock + 1.5)) + 0.5 * SC.dp(ts, tm.weapon, tm.weapon + 0.4) }, { p: dp });
      P.layerCards(d, [790, 520], ts, SC.dp(ts, tm.gen + 0.5, tm.gen + 2.4, (x) => x));
      // 楊過 with the heavy iron sword
      const H = 480;
      const ready = { lean: 2, sh1: 30, el1: 20, sh2: 0, el2: 0, hp1: 26, kn1: 22, hp2: -26, kn2: 8, wind: 0.6 };
      const raised = { lean: -8, sh1: 150, el1: 20, sh2: 0, el2: 0, hp1: 30, kn1: 26, hp2: -30, kn2: 8, wind: 0.8 };
      const point = { lean: 10, sh1: 92, el1: 2, sh2: 0, el2: 0, hp1: 36, kn1: 34, hp2: -32, kn2: 6, wind: 0.8 };
      const writing = (u) => ({ lean: 4, sh1: 110 + 26 * Math.sin(u * TAU * 2.2), el1: 10 + 18 * Math.sin(u * TAU * 3.1 + 1), sh2: 0, el2: 0, hp1: 32, kn1: 30, hp2: -30, kn2: 8, wind: 0.8 });
      let pose;
      if (ts < tm.draw) pose = ready;
      else if (ts < tm.write) pose = F.lerpPose(ready, raised, easeOut(inv(tm.draw, tm.draw + 0.5, ts)));
      else if (ts < tm.stream) pose = F.lerpPose(raised, writing(inv(tm.write, tm.stream, ts)), smooth(inv(tm.write, tm.write + 0.3, ts)));
      else if (ts < tm.weapon) pose = F.lerpPose(writing(1), point, smooth(inv(tm.stream, tm.stream + 0.4, ts)));
      else pose = F.lerpPose(point, raised, easeOut(inv(tm.weapon, tm.weapon + 0.5, ts)));
      Object.assign(pose, { root: [420, GROUND - 0.49 * H], H, dir: 1, p: SC.dp(ts, 0.2, 1.0) });
      const J = F.figure(d, pose, LOOK.yang, ts);
      const fa = K.norm(sub(J.A1.W, J.A1.E));
      const sang = Math.atan2(fa[1], fa[0]) / DEG - 12;
      PR.heavySword(d, J.A1.W, sang, H * 0.56, { p: pose.p });
      const tip = add(J.A1.W, K.polar(sang * DEG, H * 0.56));
      FX.slashArc(d, add(J.A1.S, [20, -10]), 300, 60, -110, inv(tm.draw, tm.draw + 0.55, ts), { w: 46, seed: 545 });
      if (ts > tm.draw && ts < tm.draw + 0.6) halo(d, tip, 90, 'gold', 0.8 * (1 - inv(tm.draw, tm.draw + 0.6, ts)));
      // the gold "AI" written in the air, then poured into the screen
      const ap = SC.dp(ts, tm.write, tm.stream, (x) => x);
      const aOut = SC.dp(ts, tm.stream, tm.stream + 0.6);
      const box = [700, 230, 240];
      if (ap > 0 && aOut < 1) {
        d.open('opacity="' + (1 - aOut).toFixed(3) + '"');
        const head = P.aiTrail(d, box, ap, ts, { w: 18 });
        d.close();
        if (head && ap < 1) FX.streak(d, tip, head, 0.45, { w: 6 });
      }
      if (ts > tm.stream && ts < tm.unlock + 0.6) {
        for (let k = 0; k < 14; k++) {
          const u = clamp((ts - tm.stream - k * 0.025) / 0.5);
          if (u <= 0 || u >= 1) continue;
          const a = [box[0] + 40 + rnd(546, k) * 220, box[1] + rnd(547, k) * box[2]];
          const b = [MON.c[0] + rrange(548, k, -80, 80), MON.c[1] + rrange(549, k, -40, 40)];
          const m = add(mix(a, b, 0.5), [0, -90]);
          const e = easeIn(u), q = add(add(mul(a, (1 - e) * (1 - e)), mul(m, 2 * (1 - e) * e)), mul(b, e * e));
          P.sparkle(d, q, 10 * (1 - u * 0.5), k % 3 ? R.pal.gold : '#fff8e6');
          halo(d, q, 26, 'gold', 0.5 * (1 - u));
        }
      }
      if (ts > tm.weapon) { halo(d, tip, 120, 'gold', 0.7 * SC.dp(ts, tm.weapon, tm.weapon + 0.3)); P.sparkle(d, tip, 26 * SC.dp(ts, tm.weapon, tm.weapon + 0.3) * (0.8 + 0.2 * Math.sin(ts * 12)), '#fff8e6'); }
      d.close();
      label(d, ts, S, L(S, 'P05').t0 - 0.2, '楊過', '玄鐵重劍', 'ＡＩ');
      N.motes(d, ts, { n: 10, seed: 550, area: [900, 1800, 200, 800] });
    },
    cues(S) {
      const tm = timingYang(S);
      const c = [
        { t: 0, sfx: 'windSoft', gain: 0.25, dur: S.dur },
        { t: tm.draw, sfx: 'swordDraw', gain: 0.95, pan: -0.4 },
        { t: tm.write, sfx: 'shimmer', gain: 0.55, pan: -0.1, dur: tm.stream - tm.write },
        { t: tm.stream, sfx: 'whooshUp', gain: 0.5, pan: 0.3 },
        { t: tm.unlock, sfx: 'unlock', gain: 0.8, pan: 0.4 },
        { t: tm.unlock + BEAT / 2, sfx: 'techPulse', gain: 0.6, pan: 0.4 },
        { t: tm.weapon, sfx: 'chimeBig', gain: 0.55, pan: -0.3 },
      ];
      for (let k = 0; k < 6; k++) c.push({ t: tm.gen + k * BEAT, sfx: 'uiBlip', gain: 0.5, pan: 0.35 + 0.05 * (k % 3) });
      return c;
    },
  };

  // ============================================= 4. 令狐沖: nine Reels frames
  function timingLinghu(S) {
    const l7 = L(S, 'P07'), l8 = L(S, 'P08');
    const jump = l7.t0 - 0.05, step = BEAT / 2, first = onBeat(S, jump + 0.3);
    const thrusts = [];
    for (let i = 0; i < 9; i++) thrusts.push(first + i * step);
    return { jump, step, thrusts, land: thrusts[8] + 0.45, boom: onBeat(S, l8.t1 - 0.55) };
  }
  const GRID = (i) => [1360 + ((i % 3) - 1) * 168, 520 + (Math.floor(i / 3) - 1) * 276];
  G.SCENES.p60_linghu = {
    draw(d, ts, S) {
      const tm = timingLinghu(S);
      const cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.land, { x: 1000, y: 530, z: 1.03 }], [S.dur, { x: 1040, y: 530, z: 1.05 }]], ts);
      hills(d, ts, cam, 561, { peaks: [{ x: 250, h: 300, w: 440 }, { x: 900, h: 240, w: 460 }, { x: 1600, h: 340, w: 440 }] });
      camOpen(d, cam, 1);
      ground(d, ts, 562);
      for (let x = 60; x < 700; x += 140) N.bamboo(d, x, GROUND + 4, 520 + (x % 3) * 60, { seed: 563 + x, p: SC.dp(ts, 0.2, 1.0), sway: 10 }, ts);
      // the nine frames
      const boom = SC.dp(ts, tm.boom, tm.boom + 0.25);
      tm.thrusts.forEach((tt, i) => {
        const fp = SC.dp(ts, tt + 0.12, tt + 0.45, (x) => x);
        P.reelsFrame(d, GRID(i), 140, 249, i, ts, fp, { ai: i % 3 === 1, hot: boom > 0 && boom < 1 });
      });
      if (ts > tm.boom) {
        tm.thrusts.forEach((tt, i) => FX.burst(d, GRID(i), 150, inv(tm.boom, tm.boom + 0.7, ts), { seed: 570 + i, n: 10, w: 3 }));
        FX.sparks(d, [1360, 520], tm.boom, ts, { n: 40, speed: 1100, seed: 579, gravity: 600, life: 1.2 });
      }
      // 令狐沖 in the air, thrusting nine times
      const H = 440;
      const air = SC.dp(ts, tm.jump, tm.jump + 0.35, easeOut) * (1 - SC.dp(ts, tm.land - 0.2, tm.land, easeIn));
      const root = [520, GROUND - 0.49 * H - 150 * air + Math.sin(ts * 9) * 6 * air];
      let k = -1;
      tm.thrusts.forEach((tt, i) => { if (ts >= tt - 0.1) k = i; });
      const ph = k >= 0 ? clamp((ts - (tm.thrusts[k] - 0.1)) / tm.step) : 0;
      const ext = k >= 0 && ts < tm.land ? Math.sin(ph * Math.PI) : 0;
      const base = { lean: 6, hp1: 40 * air + 18, kn1: 60 * air + 16, hp2: -10 * air - 16, kn2: 70 * air + 12, sh2: -40, el2: 30, wind: 0.9 };
      const pose = Object.assign({}, ts < tm.land + 0.6 ? base : F.lerpPose(base, { lean: 2, hp1: 20, kn1: 16, hp2: -18, kn2: 12, sh2: -20, el2: 30, wind: 0.5 }, smooth(inv(tm.land + 0.6, tm.land + 1.2, ts))));
      let aim;
      if (k >= 0 && ts < tm.land) {
        const tgt = GRID(k);
        aim = Math.atan2(tgt[1] - (root[1] - 0.25 * H), tgt[0] - root[0]) / DEG;
        pose.sh1 = 90 - aim * 0.9 + 10 * (1 - ext); pose.el1 = lerp(60, 0, ext);
      } else {
        pose.sh1 = lerp(80, 150, smooth(inv(tm.land, tm.land + 0.6, ts))); pose.el1 = 20;
      }
      Object.assign(pose, { root, H, dir: 1, p: SC.dp(ts, 0.2, 1.0) });
      const J = F.figure(d, pose, LOOK.linghu, ts);
      const fa = K.norm(sub(J.A1.W, J.A1.E));
      const sAng = aim === undefined ? Math.atan2(fa[1], fa[0]) / DEG - 30 : aim;
      PR.sword(d, J.A1.W, sAng, H * 0.5, { p: pose.p, seed: 862, gleam: ext }, ts);
      const tip = add(J.A1.W, K.polar(sAng * DEG, H * 0.5));
      tm.thrusts.forEach((tt, i) => FX.streak(d, tip, GRID(i), inv(tt, tt + 0.32, ts), { w: 12 }));
      d.close();
      label(d, ts, S, L(S, 'P07').t0 - 0.2, '令狐沖', '獨孤九劍', '影音');
    },
    cues(S) {
      const tm = timingLinghu(S);
      const c = [{ t: 0, sfx: 'bambooWind', gain: 0.3, dur: S.dur }, { t: tm.jump, sfx: 'jump', gain: 0.7, pan: -0.4 }];
      tm.thrusts.forEach((tt, i) => {
        c.push({ t: tt, sfx: 'swordSwing', gain: 0.5, pan: -0.2 + 0.05 * i });
        c.push({ t: tt + BEAT / 4, sfx: 'pop', gain: 0.55, pan: 0.3 + 0.05 * (i % 3) });
      });
      c.push({ t: tm.land, sfx: 'land', gain: 0.7, pan: -0.4 });
      c.push({ t: tm.boom, sfx: 'confetti', gain: 0.8, pan: 0.3 });
      c.push({ t: tm.boom, sfx: 'burstBell', gain: 0.5, pan: 0.3 });
      return c;
    },
  };

  // ========================================== 5. 張無忌: four skills, one orb
  function timingZhang(S) {
    const l9 = L(S, 'P09'), l10 = L(S, 'P10');
    const a0 = onBeat(S, l9.t0 + 0.2), appear = [0, 1, 2, 3].map((k) => a0 + k * BEAT);
    return { appear, merge: l10.t0 + 0.15, orb: l10.t0 + 0.85, flare: onBeat(S, l10.t1 - 0.3, 4 * BEAT) };
  }
  const SKILLS = [['interview', '採訪'], ['edit', '剪輯'], ['ai', 'AI 生成'], ['social', '社群營運']];
  G.SCENES.p60_zhang = {
    draw(d, ts, S) {
      const tm = timingZhang(S);
      let cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.orb, { x: 940, y: 520, z: 1.04 }], [S.dur, { x: 920, y: 510, z: 1.08 }]], ts);
      cam = SC.shake(cam, ts, tm.flare, 10, 0.5);
      hills(d, ts, cam, 581);
      camOpen(d, cam, 1);
      ground(d, ts, 582);
      FX.ring(d, [760, GROUND + 30], 520, (ts % 1.4) / 1.4, { w: 3, ry: 0.16, color: R.pal.soft });
      const H = 460, root = [760, GROUND - 0.49 * H];
      const ORB = [1060, 470];
      // orbit of the four badges around 張無忌, spiralling into the orb
      const m = SC.dp(ts, tm.merge, tm.orb, easeIn);
      const C = mix([760, 560], ORB, m);
      const spin = ts * (1.6 + 2.2 * m);
      const orbit = SKILLS.map(([kind, lb], k) => {
        const a = spin + k * TAU / 4;
        const rx = 470 * (1 - m), ry = 170 * (1 - m);
        return { kind, lb, k, a, pos: add(C, rot([Math.cos(a) * rx, Math.sin(a) * ry], -8 * DEG)), z: Math.sin(a) };
      });
      const drawBadge = (e) => P.skillBadge(d, e.pos, 74 * lerp(1, 0.4, m) * (0.85 + 0.15 * e.z), e.kind, m < 0.5 ? e.lb : null, SC.dp(ts, tm.appear[e.k], tm.appear[e.k] + 0.45, (x) => x) * (1 - SC.dp(ts, tm.orb - 0.1, tm.orb + 0.2)), ts, { labelSize: 30 });
      orbit.filter((e) => e.z < 0).forEach(drawBadge);
      // 張無忌, hands circling (乾坤大挪移), then pushing toward the orb
      let pose;
      const g = SC.dp(ts, 0.3, 1.0);
      if (ts < tm.merge) {
        const circ = ts * 2.8;
        pose = { lean: 4, hp1: 26, kn1: 30, hp2: -26, kn2: 30, wind: 0.6, sh1: 30, el1: 60, sh2: -20, el2: 60 };
        pose.hand1 = [root[0] + 130 + Math.cos(circ) * 80 * g, root[1] - 70 + Math.sin(circ) * 80 * g];
        pose.hand2 = [root[0] + 110 + Math.cos(circ + Math.PI) * 80 * g, root[1] - 70 + Math.sin(circ + Math.PI) * 80 * g];
        pose.bend1 = 1; pose.bend2 = 1;
      } else {
        pose = F.poseAt([
          [tm.merge, { lean: -4, hp1: 30, kn1: 34, hp2: -28, kn2: 30, sh1: 40, el1: 100, sh2: 30, el2: 100, wind: 0.8 }],
          [tm.orb, { lean: 12, hp1: 40, kn1: 44, hp2: -34, kn2: 8, sh1: 80, el1: 6, sh2: 74, el2: 10, wind: 1.0 }, easeIn],
          [S.dur, { lean: 8, hp1: 36, kn1: 40, hp2: -32, kn2: 10, sh1: 76, el1: 10, sh2: 70, el2: 14, wind: 0.8 }],
        ], ts);
      }
      Object.assign(pose, { root, H, dir: 1, p: SC.dp(ts, 0.2, 1.0) });
      const J = F.figure(d, pose, LOOK.zhang, ts);
      FX.qiSwirl(d, mix(J.A1.W, J.A2.W, 0.5), 130, ts, { p: g * (1 - m), n: 5, speed: 3.6 });
      orbit.filter((e) => e.z >= 0).forEach(drawBadge);
      // light orb
      const op = SC.dp(ts, tm.orb - 0.2, tm.orb + 0.6, (x) => x);
      const flare = SC.dp(ts, tm.flare, tm.flare + 0.3);
      if (op > 0) {
        stroke(d, [J.A1.W, ORB], { w: 3, color: R.pal.gold, opacity: 0.6 * op, seed: 583, brush: false });
        P.lightOrb(d, ORB, 110 * (1 + 0.3 * flare) + 6 * Math.sin(ts * 5), ts, op, { labels: ['採訪', '剪輯', 'AI', '社群'] });
      }
      FX.burst(d, ORB, 420, inv(tm.flare, tm.flare + 0.8, ts), { seed: 584, n: 20, w: 5 });
      FX.ring(d, ORB, 620, inv(tm.flare, tm.flare + 1.0, ts), { w: 7, color: R.pal.gold });
      FX.sparks(d, ORB, tm.flare, ts, { n: 30, speed: 1000, seed: 585, gravity: 500, life: 1.1 });
      d.close();
      label(d, ts, S, L(S, 'P09').t0 - 0.2, '張無忌', '乾坤大挪移', '融通');
      N.motes(d, ts, { n: 12, seed: 586, area: [700, 1700, 200, 850] });
    },
    cues(S) {
      const tm = timingZhang(S);
      const c = [
        { t: 0.2, sfx: 'qiCharge', gain: 0.55, dur: tm.merge - 0.2 },
        { t: tm.merge, sfx: 'whooshUp', gain: 0.7 },
        { t: tm.orb, sfx: 'swirl', gain: 0.7, dur: S.dur - tm.orb },
        { t: tm.flare, sfx: 'burstBell', gain: 0.8 },
        { t: tm.flare, sfx: 'palmStrike', gain: 0.5 },
      ];
      tm.appear.forEach((t, k) => c.push({ t: t + BEAT / 4, sfx: 'pop', gain: 0.55, pan: -0.3 + 0.2 * k }));
      return c;
    },
  };

  // ======================================= 6. the manual passes to a student
  function timingPass(S) {
    const l11 = L(S, 'P11'), l12 = L(S, 'P12');
    return { offer: l11.t0 + 0.2, fly: l11.t0 + 1.0, take: onBeat(S, l11.t1 - 0.6), eyes: l12.t0 + 0.6 };
  }
  G.SCENES.p60_pass = {
    draw(d, ts, S) {
      const tm = timingPass(S);
      // hold wide on the handover, then ease in on the student as the eyes light up
      const cam = SC.cam([[0, { x: 960, y: 540, z: 1.0 }], [tm.eyes - 0.4, { x: 975, y: 540, z: 1.01 }], [S.dur, { x: 1070, y: 548, z: 1.07 }]], ts);
      camOpen(d, cam, 0.2);
      N.sun(d, [1110, 250], 66, { p: SC.dp(ts, 0.2, 1.0), rays: true, glow: 0.5 + 0.3 * SC.dp(ts, tm.eyes, tm.eyes + 1) }, ts);
      N.mountains(d, { peaks: [{ x: 200, h: 320, w: 420 }, { x: 860, h: 260, w: 460 }, { x: 1500, h: 360, w: 440 }, { x: 2100, h: 300, w: 420 }], base: 860, seed: 601, p: SC.dp(ts, 0, 0.9), fill: R.pal.fillFar, w: 2.2, texture: 8 });
      N.cloud(d, 300 + ts * 12, 160, 0.8, { seed: 602, p: SC.dp(ts, 0.2, 1.0) });
      d.close();
      // the campus behind the student: 世新山洞 and 舍我樓
      camOpen(d, cam, 0.55);
      const bp = SC.dp(ts, 0.1, 1.1);
      A.tunnel(d, 1100, 880, 170, 190, { p: bp, plaque: '世新大學', plaqueW: 180 });
      P.shewo(d, 1680, 880, { p: bp, w: 190, h: 400 });
      for (const [x, s] of [[880, 0.66], [1900, 0.72]]) N.pine(d, x, 880, s, { seed: 605 + x, p: bp }, ts);
      d.close();
      camOpen(d, cam, 1);
      ground(d, ts, 606);
      // the four heroes offer the manual, then lower their arms and nod
      const H = 440;
      const offer = SC.dp(ts, tm.offer, tm.offer + 0.7), rest = SC.dp(ts, tm.take + 0.2, tm.take + 1.1);
      [['qiao', 215], ['yang', 400], ['linghu', 585], ['zhang', 770]].forEach(([key, x], i) => {
        const pose = { lean: 2 + 4 * offer - 2 * rest, hp1: 10, kn1: 6, hp2: -10, kn2: 6, head: 6 * rest, sh1: lerp(lerp(10, 70 - i * 4, offer), 26, rest), el1: lerp(16, 10, offer), sh2: -8, el2: 12, wind: 0.4 };
        Object.assign(pose, { root: [x, GROUND - 0.49 * H], H, dir: 1, p: SC.dp(ts, 0.2 + i * 0.1, 1.0 + i * 0.1) });
        F.figure(d, pose, Object.assign({}, LOOK[key], { hand1: 'open' }), ts);
      });
      // the high-school student on the right takes it
      const SH = 420, sroot = [1380, GROUND - 0.49 * SH];
      const reach = SC.dp(ts, tm.take - 0.7, tm.take, easeOut);
      const hold = SC.dp(ts, tm.take, tm.take + 0.6);
      const glow = SC.dp(ts, tm.eyes, tm.eyes + 0.8);
      const bookAt = [sroot[0] - 0.2 * SH, sroot[1] - 0.12 * SH - 8 * hold - 24 * glow];
      const spose = { lean: lerp(0, 6, reach) - 4 * hold, hp1: 8, kn1: 4, hp2: -8, kn2: 4, head: lerp(0, 8, hold) - 12 * glow, wind: 0.3 };
      if (reach > 0) {
        spose.hand1 = mix([sroot[0] - 0.05 * SH, sroot[1] + 0.05 * SH], add(bookAt, [12, 6]), reach);
        spose.hand2 = mix([sroot[0] + 0.02 * SH, sroot[1] + 0.06 * SH], add(bookAt, [-14, 10]), reach);
        spose.bend1 = 1; spose.bend2 = 1;
      } else { spose.sh1 = 8; spose.el1 = 10; spose.sh2 = -6; spose.el2 = 10; }
      Object.assign(spose, { root: sroot, H: SH, dir: -1, p: SC.dp(ts, 0.4, 1.3) });
      // the manual: glows over the heroes' hands, floats across, lands in the student's
      const start = [900, 520], fly = SC.dp(ts, tm.fly, tm.take, easeInOut);
      let bc = mix(start, bookAt, fly);
      bc = add(bc, [0, -Math.sin(fly * Math.PI) * 120 + Math.sin(ts * 3) * 6 * (1 - hold)]);
      const bookP = SC.dp(ts, tm.offer, tm.offer + 0.5);
      const SJ = F.figure(d, spose, { outfit: 'modern', hair: 'short', ribbon: false, sash: false, seed: 1501, hand1: 'open', hand2: 'open', eyeGlow: glow }, ts);
      if (bookP > 0) {
        if (fly > 0 && fly < 1) for (let k = 0; k < 8; k++) { const u = clamp(fly - k * 0.05); P.sparkle(d, add(mix(start, bookAt, u), [0, -Math.sin(u * Math.PI) * 120]), 8 * (1 - k / 8), R.pal.gold, 1 - k / 8); }
        P.manual(d, bc, 104, 138, lerp(-8, 6, fly), { p: bookP, glow: 0.5 + 0.3 * Math.sin(ts * 4) * (1 - hold) + 0.4 * glow });
      }
      if (glow > 0) {
        for (let k = 0; k < 9; k++) { const ph = (ts * 0.7 + k / 9) % 1; P.sparkle(d, [sroot[0] - 150 + 300 * rnd(607, k), sroot[1] - 0.6 * SH + 320 * (1 - ph)], 12 * Math.sin(ph * Math.PI) * glow, R.pal.gold, Math.sin(ph * Math.PI) * glow); }
        halo(d, add(sroot, [0, -0.3 * SH]), 300, 'gold', 0.35 * glow);
        // the glint in the eye: a flash as it lights up, then a steady twinkle
        if (SJ && SJ.eye) {
          const flash = Math.exp(-2.5 * Math.max(0, ts - tm.eyes - 0.3)), tw = 0.85 + 0.15 * Math.sin(ts * 9);
          halo(d, SJ.eye, 70, 'gold', 0.8 * glow);
          P.sparkle(d, SJ.eye, (18 + 30 * flash) * glow * tw, R.pal.gold, glow);
          P.sparkle(d, SJ.eye, (7 + 10 * flash) * glow, '#fffaf0', glow);
        }
      }
      d.close();
      N.motes(d, ts, { n: 14, seed: 608, area: [200, 1700, 200, 900] });
    },
    cues(S) {
      const tm = timingPass(S);
      return [
        { t: 0, sfx: 'dawnAmb', gain: 0.35, dur: S.dur },
        { t: tm.offer, sfx: 'shimmer', gain: 0.5, dur: 1.2 },
        { t: tm.fly, sfx: 'whooshUp', gain: 0.35, pan: 0.2 },
        { t: tm.take, sfx: 'chime', gain: 0.6, pan: 0.3 },
        { t: tm.eyes, sfx: 'shimmer', gain: 0.55, pan: 0.3, dur: 1.6 },
      ];
    },
  };

  // ============================================ 7. night end card: recruit
  function timingEnd(S) {
    const l13 = L(S, 'P13'), l14 = L(S, 'P14');
    return { logo0: 0.3, logo1: l13.t0 + 1.9, word: l13.t1 - 0.6, banner0: l14.t0 - 0.3, banner1: l14.t1 - 0.2, finale: onBeat(S, l14.t1 + 0.25) };
  }
  G.SCENES.p60_end = {
    draw(d, ts, S) {
      const tm = timingEnd(S);
      const cam = SC.cam([[0, { x: 960, y: 560, z: 1.04 }], [S.dur, { x: 960, y: 540, z: 1.0 }]], ts);
      camOpen(d, cam, 0.3);
      N.mountains(d, { peaks: [{ x: 160, h: 260, w: 420 }, { x: 760, h: 200, w: 460 }, { x: 1300, h: 280, w: 440 }, { x: 1900, h: 230, w: 420 }], base: 1000, seed: 621, p: SC.dp(ts, 0, 1.0), fill: R.pal.fillFar, w: 2.2, texture: 6 });
      for (let k = 0; k < 40; k++) { const tw = 0.5 + 0.5 * Math.sin(ts * 3 + k * 1.7); P.dot(d, [1920 * rnd(622, k), 60 + 500 * rnd(623, k)], 1.2 + 1.6 * rnd(624, k), R.pal.gold, 0.6 * tw * SC.dp(ts, 0.2, 1.2)); }
      d.close();
      camOpen(d, cam, 1);
      // lanterns down both sides
      for (const [x, y, s, sd] of [[150, 60, 66, 1], [345, 0, 54, 2], [1575, 0, 54, 3], [1770, 60, 66, 4]]) {
        stroke(d, [[x, -20], [x, y + 60]], { w: 1.4, seed: 625 + sd, brush: false, color: R.pal.soft });
        A.lantern(d, [x, y + 60], s, ts, { seed: 630 + sd * 7, p: SC.dp(ts, 0.1 * sd, 0.8 + 0.1 * sd) });
      }
      // the department logo in red and white lines
      const lp = SC.dp(ts, tm.logo0, tm.logo1, (x) => x);
      PR.emblem(d, [960, 300], 150, { p: lp, color: '#fff3e2', lineColor: R.pal.line, keepLine: true, glow: 0.4 * SC.dp(ts, tm.logo1 - 0.5, tm.logo1 + 0.5), seed: 640 });
      const wp = SC.dp(ts, tm.word, tm.word + 0.8);
      if (wp > 0) {
        text(d, '世新大學新聞學系', 960, 548, { size: 56, weight: 700, color: '#fff3e2', spacing: 8, opacity: wp });
        text(d, 'Department of Journalism · Shih Hsin University', 960, 594, { font: "'Cormorant Garamond', serif", italic: true, weight: 500, size: 28, color: R.pal.gold, opacity: 0.9 * wp });
      }
      P.recruitBanner(d, [960, 740], SC.dp(ts, tm.banner0, tm.banner1, (x) => x), ts, { w: 900, h: 190 });
      // finale: gold flashes
      if (ts > tm.finale) {
        FX.burst(d, [960, 300], 360, inv(tm.finale, tm.finale + 0.9, ts), { seed: 641, n: 18, w: 4 });
        FX.sparks(d, [960, 740], tm.finale, ts, { n: 36, speed: 900, seed: 642, gravity: 400, life: 1.4 });
      }
      d.close();
      N.motes(d, ts, { n: 20, seed: 643, area: [100, 1820, 100, 1000] });
    },
    cues(S) {
      const tm = timingEnd(S);
      return [
        { t: 0, sfx: 'nightAmb', gain: 0.35, dur: S.dur },
        { t: 0.25, sfx: 'templeBell', gain: 0.85 },
        { t: tm.logo0 + 0.5, sfx: 'shimmer', gain: 0.4, dur: 1.8 },
        { t: tm.banner0, sfx: 'shimmer', gain: 0.45, dur: 1.4 },
        { t: tm.finale, sfx: 'burstBell', gain: 0.6 },
        { t: tm.finale + 0.05, sfx: 'templeBell', gain: 0.55 },
      ];
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
