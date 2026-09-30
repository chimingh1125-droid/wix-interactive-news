/* Wuxia character rig + creatures (dragon, eagle).
 *
 * Pose angles are degrees measured from straight down, positive toward the
 * facing direction (dir = 1 faces right). Arms can also be driven by hand
 * targets (2-bone IK). Every body part is filled with the paper colour and
 * drawn back-to-front, so a figure always hides whatever is behind it.
 */
(function (G) {
  'use strict';
  const K = G.K;
  const { R, lerp, clamp, smooth, rnd, rrange, noise1, stroke, shape, add, sub, mul, rot, norm, perp, dist, mix,
    ellipse, arc, TAU, DEG, f1, halo, seqP, spline, easeInOut, inv } = K;

  const POSE0 = { lean: 0, head: 0, sh1: 10, el1: 16, sh2: -8, el2: 12, hp1: 5, kn1: 3, hp2: -5, kn2: 5, wind: 0.3 };
  const LOOK0 = { hair: 'bun', ribbon: true, beard: 'none', build: 1, sash: true, oneArm: false, gourd: false, hem: 0.37, detail: 'high', hand1: 'fist', hand2: 'fist', hairColor: null };

  const dv = (a, dir) => [Math.sin(a * DEG) * dir, Math.cos(a * DEG)];

  function lerpPose(a, b, t) {
    const o = {};
    for (const k in a) {
      const va = a[k], vb = b[k];
      if (typeof va === 'number' && typeof vb === 'number') o[k] = lerp(va, vb, t);
      else if (Array.isArray(va) && Array.isArray(vb) && typeof va[0] === 'number') o[k] = [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)];
      else o[k] = t < 0.5 ? va : (vb === undefined ? va : vb);
    }
    for (const k in b) if (!(k in o)) o[k] = b[k];
    return o;
  }
  // keys: [[time, poseObj, ease?], ...] sorted by time
  function poseAt(keys, t) {
    if (t <= keys[0][0]) return Object.assign({}, POSE0, keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, p0] = keys[i], [t1, p1, ez] = keys[i + 1];
      if (t <= t1) {
        const u = (t - t0) / (t1 - t0 || 1);
        return lerpPose(Object.assign({}, POSE0, p0), Object.assign({}, POSE0, p1), (ez || easeInOut)(u));
      }
    }
    return Object.assign({}, POSE0, keys[keys.length - 1][1]);
  }
  // walking cycle, phase in cycles
  function walkPose(phase, amt = 1) {
    const s = Math.sin(phase * TAU), c = Math.cos(phase * TAU);
    return {
      hp1: 24 * s * amt, kn1: (8 + 26 * Math.max(0, -c)) * amt,
      hp2: -24 * s * amt, kn2: (8 + 26 * Math.max(0, c)) * amt,
      sh1: -18 * s * amt + 4, el1: 16, sh2: 18 * s * amt - 4, el2: 14,
      bob: Math.abs(Math.cos(phase * TAU)) * 0.012,
      lean: 4 * amt,
    };
  }

  function ik(S, Wt, a, b, bend) {
    let v = sub(Wt, S);
    let dd = K.len(v);
    const maxd = a + b - 0.5;
    if (dd > maxd) { v = mul(v, maxd / dd); dd = maxd; }
    if (dd < Math.abs(a - b) + 0.5) dd = Math.abs(a - b) + 0.5;
    const cosA = clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1);
    const base = Math.atan2(v[1], v[0]);
    const ang = base + bend * Math.acos(cosA);
    const E = add(S, [Math.cos(ang) * a, Math.sin(ang) * a]);
    return { E, W: add(S, v) };
  }

  function joints(pose, look) {
    const H = pose.H, dir = pose.dir || 1, b = look.build || 1;
    const L = { T: 0.3 * H, NK: 0.036 * H, UA: 0.165 * H, FA: 0.152 * H, TH: 0.24 * H, SH: 0.235 * H, HR: 0.068 * H };
    const root = add(pose.root, [0, -(pose.bob || 0) * H]);
    const up = [Math.sin(pose.lean * DEG) * dir, -Math.cos(pose.lean * DEG)];
    const fwd = [Math.cos(pose.lean * DEG) * dir, Math.sin(pose.lean * DEG)];
    const neck = add(root, mul(up, L.T));
    const hang = pose.lean + (pose.head || 0);
    const hup = [Math.sin(hang * DEG) * dir, -Math.cos(hang * DEG)];
    const headC = add(neck, mul(hup, L.NK + L.HR * 0.92));
    const shC = add(neck, mul(up, -0.05 * H));
    const sh1 = add(shC, mul(fwd, -0.018 * H * b)), sh2 = add(shC, mul(fwd, 0.03 * H * b));
    const arm = (S, sa, ea, target, bend) => {
      if (target) { const r = ik(S, target, L.UA, L.FA, (bend || 1) * dir); return { S, E: r.E, W: r.W }; }
      const E = add(S, mul(dv(sa + pose.lean, dir), L.UA));
      const W = add(E, mul(dv(sa + pose.lean + ea, dir), L.FA));
      return { S, E, W };
    };
    const A1 = arm(sh1, pose.sh1, pose.el1, pose.hand1, pose.bend1);
    const A2 = arm(sh2, pose.sh2, pose.el2, pose.hand2, pose.bend2);
    const hip1 = add(root, mul(fwd, -0.012 * H)), hip2 = add(root, mul(fwd, 0.018 * H));
    const leg = (Hp, ha, ka, fa) => {
      const Kn = add(Hp, mul(dv(ha, dir), L.TH));
      const A = add(Kn, mul(dv(ha - ka, dir), L.SH));
      return { H: Hp, K: Kn, A, foot: fa || 0 };
    };
    const L1 = leg(hip1, pose.hp1, pose.kn1, pose.ft1), L2 = leg(hip2, pose.hp2, pose.kn2, pose.ft2);
    const waist = add(root, mul(up, 0.05 * H));
    return { H, dir, b, L, root, up, fwd, neck, headC, hup, hang, A1, A2, L1, L2, waist };
  }

  // ------------------------------------------------------------- parts
  function limbTube(a, b2, w0, w1) {
    const d0 = norm(sub(b2, a)), n = perp(d0);
    return [add(a, mul(n, w0 / 2)), add(b2, mul(n, w1 / 2)), add(b2, mul(n, -w1 / 2)), add(a, mul(n, -w0 / 2))];
  }

  function drawLeg(d, J, Lg, o, p, seed) {
    const H = J.H, lw = o.lw;
    // thigh + shin as trousers
    shape(d, limbTube(Lg.H, Lg.K, 0.085 * H, 0.066 * H), { p, w: lw, seed: seed, fill: o.fill });
    shape(d, limbTube(Lg.K, Lg.A, 0.064 * H, 0.046 * H), { p, w: lw, seed: seed + 1, fill: o.fill });
    // boot: outline in a foot frame (f = forward along the sole, u = up)
    const shinDir = norm(sub(Lg.A, Lg.K));
    const tilt = (Lg.foot || 0) + clamp((Math.atan2(shinDir[0] * J.dir, shinDir[1]) / DEG) * -0.35, -35, 35);
    const f = rot([J.dir, 0], tilt * DEG * J.dir);
    const u = rot([0, -1], tilt * DEG * J.dir);
    const A = Lg.A;
    const at = (a, b2) => add(A, add(mul(f, a * H), mul(u, b2 * H)));
    const boot = [at(-0.024, 0.056), at(-0.03, 0.0), at(-0.026, -0.02), at(0.074, -0.022), at(0.09, -0.01), at(0.056, 0.006), at(0.024, 0.056)];
    shape(d, spline(boot, 3, true), { p, w: lw, seed: seed + 2, fill: R.pal.shade });
    stroke(d, [at(-0.026, 0.045), at(0.024, 0.045)], { p: clamp((p - 0.5) / 0.5), w: lw * 0.6, seed: seed + 3, color: R.pal.soft, brush: false });
  }

  function drawPanel(d, J, Lg, o, t, p, seed, isFront) {
    const H = J.H, b = J.b, dir = J.dir;
    const dT = norm(sub(Lg.K, Lg.H));
    const sT = rot(dT, -90 * dir * DEG);
    const Lh = o.hem * H * (o.long ? 1.18 : 1);
    const wc = J.waist;
    const wind = o.wind;
    const wdir = [-dir, -0.25];
    const fl = (k) => Math.sin(t * (6 + k) + seed + k * 1.7);
    const flutter = (k, amt) => add(mul(wdir, wind * 0.06 * H * amt * (0.75 + 0.25 * fl(k))), [0, 0]);
    const wF = add(wc, mul(J.fwd, (isFront ? 0.078 : 0.07) * H * b));
    const wB = add(wc, mul(J.fwd, (isFront ? -0.05 : -0.078) * H * b));
    const hemC = add(wc, mul(dT, Lh));
    const flare = o.flare || 1;
    const hemF = add(add(hemC, mul(sT, 0.1 * H * flare)), flutter(1, 0.7));
    const hemB = add(add(hemC, mul(sT, -0.095 * H * flare)), flutter(2, 1.2));
    const midF = add(add(wc, mul(dT, Lh * 0.5)), add(mul(sT, 0.088 * H * b), flutter(3, 0.25)));
    const midB = add(add(wc, mul(dT, Lh * 0.5)), add(mul(sT, -0.085 * H * b), flutter(4, 0.45)));
    const hem = [];
    for (let i = 1; i < 4; i++) {
      const u = i / 4;
      hem.push(add(mix(hemF, hemB, u), mul(dT, Math.sin(u * Math.PI * 2 + t * 5 + seed) * 0.012 * H * (0.5 + wind))));
    }
    const pts = spline([wF, midF, hemF].concat(hem).concat([hemB, midB, wB]), 4);
    shape(d, pts, { p, w: o.lw, seed, fill: o.fill, start: 0.02 });
    if (o.detail === 'high') {
      // folds
      stroke(d, [add(wc, mul(dT, Lh * 0.18)), add(add(hemC, mul(sT, 0.02 * H)), flutter(5, 0.8))], { p: clamp((p - 0.4) / 0.6), w: o.lw * 0.6, color: R.pal.soft, seed: seed + 5 });
      if (isFront) stroke(d, [add(add(wc, mul(dT, Lh * 0.3)), mul(sT, 0.05 * H)), add(hemF, mul(sT, -0.03 * H))], { p: clamp((p - 0.5) / 0.5), w: o.lw * 0.5, color: R.pal.soft, seed: seed + 6 });
    }
  }

  function drawTorso(d, J, o, p, seed) {
    const H = J.H, b = J.b;
    const T = (a, u) => add(add(J.root, mul(J.fwd, a * H * b)), mul(J.up, u * H));
    const tl = J.L.T / H;
    const pts = [T(-0.068, 0.03), T(-0.082, 0.13), T(-0.086, 0.22), T(-0.077, tl - 0.05), T(-0.055, tl - 0.012), T(-0.024, tl + 0.004), T(0.03, tl - 0.002), T(0.07, tl - 0.038), T(0.096, tl - 0.1), T(0.09, 0.16), T(0.076, 0.03)];
    shape(d, spline(pts, 4, true), { p, w: o.lw, seed, fill: o.fill });
    // crossed collar (交領): a V around the neck running diagonally back
    const cp = clamp((p - 0.3) / 0.7);
    stroke(d, spline([T(-0.022, tl + 0.003), T(0.034, tl - 0.004), T(0.05, tl - 0.05), T(0.02, tl - 0.115), T(-0.03, tl - 0.165)], 5), { p: cp, w: o.lw * 0.85, seed: seed + 1 });
    stroke(d, spline([T(0.014, tl - 0.006), T(0.028, tl - 0.045), T(-0.004, tl - 0.105), T(-0.044, tl - 0.148)], 5), { p: cp, w: o.lw * 0.6, seed: seed + 2 });
    if (o.detail === 'high') stroke(d, spline([T(0.07, tl - 0.13), T(0.05, 0.19), T(0.058, 0.1)], 4), { p: cp, w: o.lw * 0.5, color: R.pal.soft, seed: seed + 3 });
  }

  function drawSash(d, J, o, t, p, seed) {
    const H = J.H, b = J.b;
    const T = (a, u) => add(add(J.root, mul(J.fwd, a * H * b)), mul(J.up, u * H));
    const band = [T(-0.078, 0.07), T(0.086, 0.075), T(0.084, 0.035), T(-0.08, 0.03)];
    shape(d, band, { p, w: o.lw * 0.9, seed, fill: o.sashFill || R.pal.fillNear });
    const knot = T(0.02, 0.05);
    shape(d, ellipse(knot, 0.016 * H, 0.013 * H, 0, 10), { p, w: o.lw * 0.8, seed: seed + 1, fill: o.fill, color: o.sashColor || R.pal.gold });
  }

  function sashTails(d, J, o, t, p, seed) {
    const H = J.H, dir = J.dir;
    const knot = add(add(J.root, mul(J.fwd, -0.06 * H)), mul(J.up, 0.05 * H));
    for (let k = 0; k < 2; k++) {
      const pts = [];
      const Lt = (0.16 + k * 0.04) * H;
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const wave = Math.sin(u * 4 - t * 7 - k * 1.3 + seed) * u * 0.03 * H;
        pts.push(add(knot, [-dir * u * Lt * (0.25 + 0.75 * o.wind), u * Lt * (1 - 0.6 * o.wind) + wave]));
      }
      stroke(d, pts, { p, w: o.lw * 2.2, seed: seed + k, color: o.sashColor || R.pal.gold, taperIn: 4, taperOut: 18 });
    }
  }

  function drawArm(d, J, A, o, t, p, seed, handType, isFront) {
    const H = J.H, lw = o.lw;
    const fa = norm(sub(A.W, A.E));
    const n = perp(fa);
    // "down" side of the forearm for sagging sleeve
    const downSide = n[1] > 0 ? 1 : -1;
    const nd = mul(n, downSide);
    // upper sleeve: rounded shoulder cap + tube to the elbow
    const ua = norm(sub(A.E, A.S)), nu = perp(ua);
    const r0 = 0.037 * H, r1 = 0.04 * H;
    const cap = [];
    for (let a = 90; a <= 270; a += 22.5) cap.push(add(A.S, rot(mul(ua, r0), a * DEG)));
    shape(d, spline(cap.concat([add(A.E, mul(nu, -r1)), add(A.E, mul(nu, r1))]), 3, true), { p, w: lw, seed, fill: o.fill });
    // lower wide sleeve hanging from the forearm
    const cuff = add(A.E, mul(sub(A.W, A.E), 0.86));
    const sag = o.sleeve === undefined ? 1 : o.sleeve;
    const flut = Math.sin(t * 6.5 + seed) * 0.012 * H * (0.4 + o.wind);
    const g = [0, 1];
    const wv = [-J.dir * o.wind * 0.035 * H + flut, flut * 0.6];
    const topE = add(A.E, mul(nd, -0.038 * H)), topC = add(cuff, mul(nd, -0.04 * H));
    const lip = add(topC, mul(fa, 0.014 * H));
    const botE = add(A.E, mul(nd, 0.04 * H));
    const drape = 0.07 * H * sag;
    const botC = add(add(add(cuff, mul(nd, 0.05 * H)), mul(g, drape)), wv);
    const bag = add(add(add(mix(A.E, cuff, 0.6), mul(nd, 0.066 * H)), mul(g, drape * 1.15)), mul(wv, 0.7));
    const lipMid = add(mix(lip, botC, 0.5), mul(fa, 0.016 * H));
    shape(d, spline([topE, mix(topE, topC, 0.5), topC, lip, lipMid, botC, bag, botE], 4), { p, w: lw, seed: seed + 1, fill: o.fill });
    // cuff opening + a fold
    stroke(d, spline([topC, add(mix(topC, botC, 0.5), mul(fa, -0.006 * H)), add(botC, mul(fa, -0.008 * H))], 4), { p: clamp((p - 0.4) / 0.6), w: lw * 0.7, seed: seed + 2 });
    if (o.detail === 'high') stroke(d, [add(mix(A.E, cuff, 0.3), mul(nd, 0.02 * H)), add(bag, mul(fa, 0.01 * H))], { p: clamp((p - 0.5) / 0.5), w: lw * 0.5, color: R.pal.soft, seed: seed + 3 });
    // hand
    drawHand(d, J, A, fa, o, p, seed + 5, handType);
  }

  function drawHand(d, J, A, fa, o, p, seed, type) {
    const H = J.H, n = perp(fa);
    const c = add(A.W, mul(fa, 0.018 * H));
    if (type === 'open' || type === 'palm') {
      // flat palm facing forward, fingers up
      const up = type === 'palm' ? rot(fa, -90 * J.dir * DEG) : fa;
      const pts = [add(c, mul(n, 0.022 * H)), add(add(c, mul(up, 0.06 * H)), mul(n, 0.02 * H)), add(add(c, mul(up, 0.066 * H)), mul(n, -0.004 * H)), add(add(c, mul(up, 0.05 * H)), mul(n, -0.024 * H)), add(c, mul(n, -0.024 * H))];
      shape(d, spline(pts, 3), { p, w: o.lw * 0.8, seed, fill: o.fill });
      stroke(d, [add(c, mul(n, -0.02 * H)), add(add(c, mul(fa, -0.01 * H)), mul(n, -0.04 * H))], { p, w: o.lw * 0.9, seed: seed + 1 });
    } else {
      shape(d, ellipse(c, 0.026 * H, 0.024 * H, Math.atan2(fa[1], fa[0]), 12), { p, w: o.lw * 0.8, seed, fill: o.fill });
    }
  }

  function drawHead(d, J, look, o, t, p, seed) {
    const H = J.H, dir = J.dir;
    const rx = 0.058 * H, ry = 0.07 * H;
    const ang = J.hang * DEG * dir;
    const T = (x, y) => add(J.headC, rot([x * rx * dir, y * ry], ang));
    const lw = o.lw;
    // neck
    shape(d, limbTube(add(J.neck, mul(J.up, -0.012 * H)), add(J.headC, mul(J.hup, -0.6 * ry)), 0.05 * H, 0.046 * H), { p, w: lw * 0.9, seed: seed + 20, fill: o.fill });
    // hair behind head (long hair / ribbons)
    if (look.hair === 'long') {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const w = Math.sin(u * 3 - t * 4 + seed) * 0.02 * H * u;
        pts.push(add(T(-0.7, -0.2), [-dir * (u * 0.1 * H * (0.4 + o.wind)) + w, u * 0.28 * H]));
      }
      const pts2 = pts.map((q, i) => add(q, [dir * (0.05 * H) * (1 - i / 10) + dir * 0.012 * H, 0]));
      shape(d, pts.concat(pts2.reverse()), { p, w: lw * 0.8, seed: seed + 21, fill: look.hairColor || R.pal.dark });
    }
    if (look.ribbon) {
      for (let k = 0; k < 2; k++) {
        const base = T(-0.9, -0.3);
        const pts = [];
        const Lr = (0.2 + 0.05 * k) * H;
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          const wv = Math.sin(u * 5 - t * 8 - k * 1.4 + seed) * 0.018 * H * u;
          pts.push(add(base, [-dir * u * Lr * (0.35 + 0.65 * o.wind), u * Lr * (0.55 - 0.5 * o.wind) + wv + k * 0.01 * H * u]));
        }
        stroke(d, pts, { p, w: lw * 1.7, seed: seed + 30 + k, color: look.ribbonColor || R.pal.line, taperIn: 3, taperOut: 20 });
      }
    }
    // head outline (profile-ish: forehead, nose, chin)
    const nose = look.detail === 'low' ? 1.0 : 1.07;
    const hp = [[0, -1], [0.62, -0.8], [0.93, -0.32], [0.97, -0.02], [nose, 0.14], [0.94, 0.28], [0.9, 0.45], [0.74, 0.75], [0.38, 0.97], [0, 0.98], [-0.45, 0.86], [-0.88, 0.45], [-1, 0], [-0.86, -0.55], [-0.5, -0.9]];
    shape(d, spline(hp.map((q) => T(q[0], q[1])), 3, true), { p, w: lw, seed, fill: o.fill });
    // hair cap
    const hc = look.hairColor || R.pal.dark;
    if (look.hair !== 'bald') {
      const cap = look.hair === 'messy'
        ? [[0.7, -0.6], [0.5, -1.12], [0.2, -1.05], [0, -1.28], [-0.25, -1.08], [-0.5, -1.22], [-0.7, -0.95], [-1.05, -0.9], [-1.02, -0.4], [-1.15, 0.05], [-0.86, 0.3], [-0.5, 0.1], [-0.3, -0.35], [0.2, -0.55], [0.55, -0.45]]
        : [[0.74, -0.58], [0.55, -0.95], [0.1, -1.08], [-0.45, -1.02], [-0.88, -0.66], [-1.04, -0.1], [-0.9, 0.42], [-0.62, 0.3], [-0.45, -0.1], [-0.2, -0.42], [0.3, -0.56]];
      shape(d, spline(cap.map((q) => T(q[0], q[1])), 3, true), { p, w: lw * 0.9, seed: seed + 1, fill: hc });
      if (look.detail === 'high') {
        for (let k = 0; k < 3; k++) stroke(d, [T(0.4 - k * 0.3, -0.9 + k * 0.03), T(-0.3 - k * 0.25, -0.62 + k * 0.2)], { p: clamp((p - 0.5) / 0.5), w: lw * 0.5, color: R.pal.soft, seed: seed + 40 + k });
      }
    }
    if (look.hair === 'bun' || look.hair === 'long') {
      const bc = T(-0.2, -1.12);
      shape(d, ellipse(bc, 0.3 * rx, 0.26 * ry, ang, 14), { p, w: lw * 0.85, seed: seed + 2, fill: hc });
      stroke(d, [T(-0.5, -1.02), T(0.15, -1.22)], { p, w: lw * 0.9, seed: seed + 3, color: R.pal.gold });
    }
    if (look.ribbon) stroke(d, [T(0.78, -0.5), T(0.1, -0.72), T(-0.92, -0.32)], { p, w: lw * 1.1, seed: seed + 4, color: look.ribbonColor || R.pal.line });
    if (look.hat === 'scholar') {
      const hat = [[0.72, -0.62], [0.6, -1.05], [0.1, -1.32], [-0.62, -1.2], [-0.95, -0.72], [-0.2, -0.78]];
      shape(d, spline(hat.map((q) => T(q[0], q[1])), 3, true), { p, w: lw * 0.9, seed: seed + 5, fill: R.pal.shade });
    }
    // face features
    if (look.detail !== 'low') {
      const fp = clamp((p - 0.5) / 0.5);
      stroke(d, [T(0.3, -0.3), T(0.52, -0.36), T(0.74, -0.44)], { p: fp, w: lw * 1.35, seed: seed + 6, taperIn: 2, taperOut: 8 });
      stroke(d, [T(0.4, -0.12), T(0.56, -0.16), T(0.7, -0.1)], { p: fp, w: lw * 0.8, seed: seed + 7, brush: false });
      if (fp > 0.5) { const e = T(0.58, -0.08); d.add('<circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="' + f1(Math.max(1.2, lw * 0.75)) + '" fill="' + R.pal.line + '"/>'); }
      if (look.glasses) {
        shape(d, ellipse(T(0.56, -0.1), 0.2 * rx, 0.16 * ry, 0, 12), { p: fp, w: lw * 0.6, seed: seed + 8, fill: 'none', color: R.pal.gold });
      }
      stroke(d, [T(0.7, 0.5), T(0.84, 0.5)], { p: fp, w: lw * 0.6, seed: seed + 9, brush: false });
      stroke(d, [T(-0.12, -0.02), T(-0.28, 0.12), T(-0.12, 0.26)], { p: fp, w: lw * 0.6, seed: seed + 10, color: R.pal.soft });
    }
    // beard
    if (look.beard === 'long' || look.beard === 'messy') {
      const sw = Math.sin(t * 2.2 + seed) * 0.01 * H;
      const len = look.beard === 'long' ? 0.2 : 0.13;
      const pts = [T(0.9, 0.35), T(0.75, 0.85), add(T(0.45, 1.1), [sw - J.dir * o.wind * 0.02 * H, len * H * 0.5]), add(T(0.3, 1.0), [sw * 1.5 - J.dir * o.wind * 0.03 * H, len * H]), T(0.05, 0.9), T(-0.1, 0.62)];
      shape(d, spline(pts, 4), { p, w: lw * 0.8, seed: seed + 11, fill: look.beardFill || R.pal.fill });
      for (let k = 0; k < 3; k++) stroke(d, [T(0.6 - k * 0.2, 0.7), add(T(0.45 - k * 0.15, 1.0), [sw, len * H * (0.4 + k * 0.15)])], { p: clamp((p - 0.4) / 0.6), w: lw * 0.5, color: R.pal.soft, seed: seed + 12 + k });
      stroke(d, [T(0.95, 0.33), T(0.6, 0.42), T(0.4, 0.62)], { p, w: lw * 0.9, seed: seed + 16 });
    } else if (look.beard === 'full') {
      const pts = [T(0.92, 0.3), T(0.9, 0.62), T(0.72, 0.95), T(0.3, 1.08), T(-0.2, 0.92), T(-0.5, 0.55), T(-0.45, 0.3), T(-0.1, 0.62), T(0.4, 0.7), T(0.62, 0.4)];
      shape(d, spline(pts, 3, true), { p, w: lw * 0.8, seed: seed + 11, fill: R.pal.dark });
    }
  }

  // Main entry. pose: {root, H, dir, ...angles, p, wind}; look: costume.
  function figure(d, pose, look, t) {
    look = Object.assign({}, LOOK0, look || {});
    pose = Object.assign({}, POSE0, pose);
    const J = joints(pose, look);
    const H = J.H;
    const p = pose.p === undefined ? 1 : pose.p;
    if (p <= 0) return J;
    const o = {
      lw: clamp(H / 115, 1.2, 4.2) * (look.lwScale || 1), fill: look.fill || R.pal.fill, wind: pose.wind === undefined ? 0.3 : pose.wind,
      hem: look.hem, long: look.long, detail: look.detail, flare: look.flare, sleeve: look.sleeve, sashFill: look.sashFill, sashColor: look.sashColor,
    };
    const S = (i, n) => seqP(p, i, n, 0.55);
    const seed = look.seed || 1000;
    if (look.sash) sashTails(d, J, o, t, S(3, 6), seed + 700);
    // back arm or empty sleeve
    if (look.oneArm) {
      const top = J.A2.S;
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push(add(top, [-J.dir * u * 0.12 * H * (0.5 + o.wind) + Math.sin(u * 4 - t * 7 + seed) * 0.02 * H * u, u * 0.3 * H]));
      }
      const pts2 = pts.map((q, i) => add(q, [J.dir * 0.05 * H * (1 - i / 16), 0.01 * H]));
      shape(d, pts.concat(pts2.reverse()), { p: S(1, 6), w: o.lw, seed: seed + 50, fill: o.fill });
    } else {
      drawArm(d, J, J.A2, o, t, S(1, 6), seed + 60, look.hand2, false);
    }
    drawLeg(d, J, J.L2, o, S(1, 6), seed + 100);
    drawPanel(d, J, J.L2, o, t, S(2, 6), seed + 120, false);
    drawTorso(d, J, o, S(0, 6), seed + 200);
    drawLeg(d, J, J.L1, o, S(1, 6), seed + 140);
    drawPanel(d, J, J.L1, o, t, S(2, 6), seed + 160, true);
    if (look.sash) drawSash(d, J, o, t, S(3, 6), seed + 220);
    if (look.gourd) G.PROPS.gourd(d, add(add(J.root, mul(J.fwd, -0.09 * H)), mul(J.up, 0.02 * H)), 0.07 * H, 12 * J.dir + Math.sin(t * 3) * 6, { p: S(4, 6), seed: seed + 240 });
    if (look.quiver) {
      const qa = add(J.neck, mul(J.fwd, -0.09 * H)), qb = add(J.root, mul(J.fwd, -0.12 * H));
      shape(d, limbTube(qa, qb, 0.05 * H, 0.04 * H), { p: S(4, 6), w: o.lw * 0.9, seed: seed + 250, fill: R.pal.shade });
      for (let k = 0; k < 3; k++) stroke(d, [add(qa, [k * 5 - 5, 0]), add(qa, [k * 5 - 5 - J.dir * 6, -0.06 * H])], { p: S(4, 6), w: o.lw * 0.8, seed: seed + 255 + k, color: R.pal.gold });
    }
    drawHead(d, J, look, o, t, S(4, 6), seed + 300);
    if (look.backProp) look.backProp(d, J, t);
    drawArm(d, J, J.A1, o, t, S(5, 6), seed + 400, look.hand1, true);
    return J;
  }

  // ------------------------------------------------------------- dragon
  // Body follows a path; `head` is the arc-length fraction of the head
  // along path(pts), body trails behind. o: {len (px), width, p}
  function dragon(d, path, head, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const total = K.polyLen(path);
    const bodyLen = o.len || 900;
    const N = 48;
    const spine = [];
    for (let i = 0; i < N; i++) {
      const s = head * total - (i / (N - 1)) * bodyLen;
      const pt = K.pointAt(path, clamp(s / total, 0, 1));
      const tg = K.tangentAt(path, clamp(s / total, 0.001, 0.999));
      const extra = s < 0 ? mul(tg, s) : [0, 0];
      const und = Math.sin(i * 0.36 - t * 6.5) * (o.wave || 26) * Math.min(1, i / 8);
      spine.push(add(add(pt, extra), mul(perp(tg), und)));
    }
    const width = o.width || 80;
    const wAt = (i) => { const u = i / (N - 1); return width * (u < 0.1 ? lerp(0.7, 1, u / 0.1) : lerp(1, 0.06, Math.pow((u - 0.1) / 0.9, 1.25))); };
    const ns = K.normalsOf(spine);
    // orient normals so "top" is the dorsal side (screen-up on average)
    const flip = ns.reduce((a, n) => a + n[1], 0) > 0 ? -1 : 1;
    const top = spine.map((q, i) => add(q, mul(ns[i], flip * wAt(i) / 2)));
    const bot = spine.map((q, i) => add(q, mul(ns[i], -flip * wAt(i) / 2)));
    const col = o.color || R.pal.gold, lw = o.lw || 3.6;
    const vis = Math.max(3, Math.floor(N * p));
    // legs (behind the body)
    for (const [idx, side] of [[8, 1], [10, -1], [24, 1], [26, -1]]) {
      if (idx >= vis) continue;
      const base = mix(spine[idx], bot[idx], 0.4), n = mul(ns[idx], -flip);
      const tg = norm(sub(spine[Math.max(0, idx - 1)], spine[idx + 1]));
      const kick = Math.sin(t * 5 + idx * 0.7);
      const knee = add(base, add(mul(n, width * 0.7), mul(tg, width * (side * 0.35 - 0.25 + kick * 0.25))));
      const foot = add(knee, add(mul(n, width * 0.25), mul(tg, width * 0.55)));
      stroke(d, [base, knee, foot], { w: width * 0.22, seed: 1500 + idx, color: col, taperIn: 2, taperOut: 14 });
      for (let c = -1; c <= 1; c++) {
        const cl = add(foot, add(mul(tg, width * 0.22), mul(n, c * width * 0.14)));
        stroke(d, [foot, cl, add(cl, mul(n, width * 0.08))], { w: 3, seed: 1510 + idx * 3 + c, color: col, taperOut: 6 });
      }
    }
    halo(d, spine[Math.floor(vis * 0.35)], width * 3.4, 'gold', 0.4 * p);
    const outline = top.slice(0, vis).concat(bot.slice(0, vis).reverse());
    shape(d, outline, { w: lw, color: col, seed: 1520, fill: o.fill || R.pal.fill, amp: 1 });
    // belly plates
    const belly = [];
    for (let i = 1; i < vis; i++) belly.push(mix(spine[i], bot[i], 0.55));
    if (belly.length > 2) stroke(d, belly, { w: 1.8, seed: 1525, color: R.pal.goldSoft, brush: false });
    for (let i = 2; i < vis - 2; i += 2) stroke(d, [mix(spine[i], bot[i], 0.58), mix(spine[i], bot[i], 0.95)], { w: 1.5, seed: 1526 + i, color: R.pal.goldSoft, brush: false });
    // scales on the upper body
    for (let i = 3; i < vis - 2; i += 2) {
      const c = mix(spine[i], top[i], 0.3), n = mul(ns[i], flip), tg = norm(sub(spine[i - 1], spine[i + 1]));
      const r = wAt(i) * 0.2;
      for (const off of [-0.5, 0.5]) {
        const cc = add(c, mul(n, off * r * 1.6));
        stroke(d, [add(cc, mul(n, -r)), add(cc, mul(tg, -r * 0.9)), add(cc, mul(n, r))], { w: 1.6, seed: 1530 + i * 2 + (off > 0 ? 1 : 0), color: R.pal.goldSoft, brush: false });
      }
    }
    // dorsal fins (flame-like spikes)
    for (let i = 2; i < vis - 3; i += 2) {
      const a = top[i], b2 = top[i + 2], mid = mix(a, b2, 0.35);
      const tip = add(add(mid, mul(ns[i + 1], flip * wAt(i) * 0.42)), mul(norm(sub(spine[i + 2], spine[i])), wAt(i) * 0.25));
      stroke(d, [a, tip, b2], { w: 2.2, seed: 1600 + i, color: col, brush: false });
    }
    // tail tuft
    if (vis >= N) {
      const tt = spine[N - 1], tg = norm(sub(spine[N - 1], spine[N - 3]));
      for (let k = -2; k <= 2; k++) stroke(d, [tt, add(tt, add(mul(tg, width * 0.9), mul(perp(tg), k * width * 0.18 + Math.sin(t * 6 + k) * 6)))], { w: 3, seed: 1640 + k, color: col, taperOut: 20 });
    }
    // head
    const hd = norm(sub(spine[0], spine[2]));
    const hn = mul(perp(hd), flip);
    const hc = spine[0];
    const hw = width * 0.78;
    const at = (f, s) => add(add(hc, mul(hd, f * hw)), mul(hn, s * hw));
    const jaw = 0.3 + 0.3 * Math.max(0, Math.sin(t * 4.2));
    // mane flames behind the head
    for (let k = 0; k < 6; k++) {
      const b0 = at(-0.3 - k * 0.12, 0.75 - k * 0.3);
      const tip = add(b0, add(mul(hd, -hw * (1.3 + 0.35 * Math.sin(t * 7 + k))), mul(hn, hw * (0.55 - k * 0.22))));
      stroke(d, [b0, add(mix(b0, tip, 0.5), mul(hn, hw * 0.12)), tip], { w: 3.4, seed: 1690 + k, color: col, taperOut: 22 });
    }
    // antler horns
    for (const [s0, sc] of [[0.72, 1], [0.5, 0.8]]) {
      const b0 = at(0.05, s0), tip = add(b0, add(mul(hd, -hw * 1.7 * sc), mul(hn, hw * 0.95 * sc)));
      const mid = add(mix(b0, tip, 0.45), mul(hn, hw * 0.12));
      stroke(d, [b0, mid, tip], { w: 5, seed: 1660 + s0 * 10, color: col, taperOut: 22 });
      const br = mix(b0, tip, 0.55);
      stroke(d, [br, add(br, add(mul(hd, hw * 0.1), mul(hn, hw * 0.5 * sc)))], { w: 3, seed: 1670 + s0 * 10, color: col, taperOut: 10 });
    }
    const headPts = [at(-0.55, 0.72), at(0.1, 0.92), at(0.75, 0.85), at(1.05, 0.58), at(1.8, 0.46), at(2.15, 0.58), at(2.28, 0.34), at(2.05, 0.12),
      at(1.25, 0.02 - jaw * 0.15), at(1.95, -0.22 - jaw), at(1.9, -0.44 - jaw), at(1.05, -0.62), at(0.25, -0.78), at(-0.5, -0.66)];
    shape(d, spline(headPts, 3, true), { w: lw, color: col, seed: 1650, fill: o.fill || R.pal.fill });
    // brow ridge, eye, nostril
    stroke(d, [at(0.45, 0.62), at(0.85, 0.74), at(1.15, 0.6)], { w: 3.4, seed: 1652, color: col, taperOut: 8 });
    shape(d, ellipse(at(0.82, 0.46), hw * 0.14, hw * 0.1, 0, 12), { w: 2.2, color: col, seed: 1651, fill: R.pal.glow });
    halo(d, at(0.82, 0.46), hw * 0.55, 'gold', 0.75);
    shape(d, ellipse(at(2.02, 0.44), hw * 0.06, hw * 0.05, 0, 8), { w: 1.8, color: col, seed: 1653, fill: 'none' });
    // teeth along both jaws
    for (let k = 0; k < 4; k++) {
      const u = 1.35 + k * 0.17;
      stroke(d, [at(u, 0.06 - k * 0.01), at(u + 0.05, -0.08)], { w: 2, seed: 1654 + k, color: col, brush: false });
      stroke(d, [at(u + 0.1, -0.2 - jaw * (u - 1.2) / 0.8), at(u + 0.12, -0.08 - jaw * (u - 1.2) / 0.8)], { w: 2, seed: 1658 + k, color: col, brush: false });
    }
    // whiskers
    for (const [s0, sgn] of [[0.36, 1], [-0.1, -1]]) {
      const b0 = at(2.05, s0);
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push(add(add(b0, mul(hd, -u * hw * 3.4 + hw * 0.4 * Math.sin(u * 3))), mul(hn, sgn * (u * hw * 0.6) + Math.sin(u * 5 - t * 6 + sgn) * hw * 0.35 * u)));
      }
      stroke(d, pts, { w: 3.2, seed: 1680 + sgn, color: col, taperOut: 50 });
    }
    // beard under the jaw
    for (let k = 0; k < 3; k++) {
      const b0 = at(1.1 - k * 0.25, -0.62 - jaw * 0.2);
      stroke(d, [b0, add(b0, add(mul(hn, -hw * (0.6 + k * 0.1)), mul(hd, -hw * (0.3 + Math.sin(t * 5 + k) * 0.1))))], { w: 2.6, seed: 1685 + k, color: col, taperOut: 14 });
    }
  }

  // --------------------------------------------------------------- eagle
  // giant condor (神鵰). mode: 'fly' | 'perch'
  function eagleWing(d, T, s, lift, fold, o, seed, fill, lw) {
    // canonical wing raised: shoulder (0,0); rotate by lift about shoulder
    const R0 = (q) => rot(q, lift);
    const wrist = R0([-0.35, -0.85 * fold]);
    const tipBase = add(wrist, rot([-0.55, -0.55 * fold], lift * 0.6));
    const lead = [[0.05, 0], mix([0.05, 0], wrist, 0.5), wrist, tipBase];
    const fingers = [];
    for (let k = 0; k < 5; k++) {
      const a = (-150 + k * 16) * DEG + lift * 0.6;
      const L = 0.5 - k * 0.04;
      fingers.push(add(tipBase, [Math.cos(a) * L * 0.9, Math.sin(a) * L * 0.9 * fold]));
    }
    const trail = [R0([-0.95, -0.2 * fold]), R0([-0.65, 0.05]), R0([-0.3, 0.12])];
    const outline = lead.concat([fingers[0], add(fingers[1], [0.05, 0.02]), fingers[2], add(fingers[3], [0.05, 0.02]), fingers[4]]).concat(trail).concat([[0.05, 0.08]]);
    shape(d, spline(outline.map(T), 3, true), { w: lw, seed, fill, p: o.p });
    for (let k = 0; k < 5; k++) stroke(d, [T(mix(tipBase, fingers[k], 0.2)), T(fingers[k])], { w: lw * 0.55, color: R.pal.soft, seed: seed + 10 + k, p: o.p });
    for (let k = 0; k < 3; k++) {
      const a = mix(wrist, tipBase, 0.1 + k * 0.1), b2 = mix(trail[1], trail[2], k * 0.4);
      stroke(d, [T(mix(a, b2, 0.25)), T(mix(a, b2, 0.8))], { w: lw * 0.45, color: R.pal.soft, seed: seed + 20 + k, p: o.p });
    }
  }

  function eagle(d, c, s, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const dir = o.dir || 1;
    const T = (q) => [c[0] + q[0] * s * dir, c[1] + q[1] * s];
    const lw = clamp(s / 38, 1.6, 3.6);
    if (o.mode === 'perch') {
      const bob = Math.sin(t * 1.4) * 0.02;
      // hunched body
      const body = [[0.28, -0.82], [0.58, -0.66], [0.72, -0.2], [0.62, 0.3], [0.32, 0.62], [-0.2, 0.78], [-0.72, 1.08], [-0.66, 0.66], [-0.52, 0.1], [-0.46, -0.42], [-0.12, -0.8]];
      shape(d, spline(body.map(T), 3, true), { p, w: lw, seed: 1700, fill: R.pal.fill });
      // folded wing with feather rows
      const wing = [[0.36, -0.6], [0.18, 0.02], [-0.3, 0.6], [-1.02, 1.22], [-0.7, 0.4], [-0.44, -0.3], [-0.05, -0.66]];
      shape(d, spline(wing.map(T), 3, true), { p, w: lw, seed: 1701, fill: R.pal.fillMid });
      for (let r = 0; r < 3; r++) {
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const u = k / 6;
          pts.push(T([lerp(0.2, -0.55, u) - r * 0.12, lerp(-0.35, 0.55, u) + r * 0.22 + Math.sin(u * 18) * 0.03]));
        }
        stroke(d, pts, { p, w: lw * 0.6, color: R.pal.soft, seed: 1702 + r });
      }
      // ruff of neck feathers
      const ruff = [];
      for (let k = 0; k <= 8; k++) ruff.push(T([lerp(-0.2, 0.62, k / 8), -0.72 + (k % 2 ? 0.1 : 0) + Math.abs(k / 8 - 0.5) * 0.2]));
      stroke(d, ruff, { p, w: lw * 0.9, seed: 1706, brush: false });
      // head (thrust forward) with hooked beak and fierce brow
      const hc = T([0.62, -0.98 + bob]);
      const hs = 0.2 * s;
      shape(d, ellipse(hc, hs, hs * 0.85, 0, 18), { p, w: lw, seed: 1710, fill: R.pal.fill });
      const bk = (x, y) => add(hc, [x * hs * dir, y * hs]);
      shape(d, spline([bk(0.7, -0.45), bk(1.55, -0.3), bk(1.85, 0.25), bk(1.55, 0.55), bk(1.5, 0.2), bk(0.8, 0.35)], 3, true), { p, w: lw * 0.9, seed: 1711, color: R.pal.gold, fill: R.pal.fill });
      stroke(d, [bk(0.05, -0.62), bk(0.55, -0.5), bk(0.95, -0.62)], { p, w: lw * 1.4, seed: 1712, taperOut: 6 });
      shape(d, ellipse(bk(0.45, -0.18), hs * 0.16, hs * 0.14, 0, 10), { p, w: 1.4, seed: 1713, fill: R.pal.glow, color: R.pal.gold });
      halo(d, bk(0.45, -0.18), hs * 0.8, 'gold', 0.5);
      // talons
      for (const x of [0.02, 0.3]) stroke(d, [T([x, 0.62]), T([x + 0.03, 0.86]), T([x + 0.18, 0.92])], { p, w: lw * 1.1, seed: 1720 + x * 10, color: R.pal.gold });
      return;
    }
    const flap = Math.sin(t * (o.rate || 3.4) + (o.phase || 0));
    const WL = 1.35 * s;
    // far wing
    G.N.birdWing(d, T([0.15, -0.2]), [-0.3 * WL * dir, -WL * (flap * 0.8 - 0.05)], 0.5 * s, { dirX: dir, seed: 1730, p, fill: R.pal.fillMid, w: lw * 0.9, fingers: 5, scallops: 9 });
    const body = [[0.95, -0.12], [0.62, -0.26], [0.1, -0.24], [-0.55, -0.1], [-0.75, 0.02], [-0.55, 0.16], [0.1, 0.2], [0.62, 0.14]];
    shape(d, spline(body.map(T), 3, true), { p, w: lw, seed: 1750, fill: R.pal.fill });
    // tail fan
    const tail = [[-0.6, -0.08], [-1.08, -0.22], [-1.18, 0.02], [-1.08, 0.22], [-0.6, 0.12]];
    shape(d, spline(tail.map(T), 3, true), { p, w: lw, seed: 1753, fill: R.pal.fillMid });
    for (let k = 0; k < 3; k++) stroke(d, [T([-0.66, -0.02 + k * 0.05]), T([-1.1, -0.14 + k * 0.14])], { p, w: lw * 0.5, color: R.pal.soft, seed: 1754 + k });
    // head
    const hc = T([0.98, -0.14]);
    const hs = 0.16 * s;
    shape(d, ellipse(hc, hs, hs * 0.86, 0, 16), { p, w: lw, seed: 1751, fill: R.pal.fill });
    const bk = (x, y) => add(hc, [x * hs * dir, y * hs]);
    shape(d, spline([bk(0.7, -0.4), bk(1.6, -0.25), bk(1.9, 0.3), bk(1.55, 0.55), bk(1.5, 0.2), bk(0.8, 0.35)], 3, true), { p, w: lw * 0.85, seed: 1752, color: R.pal.gold, fill: R.pal.fill });
    stroke(d, [bk(0.05, -0.6), bk(0.9, -0.55)], { p, w: lw * 1.2, seed: 1755, taperOut: 6 });
    // near wing
    G.N.birdWing(d, T([0.05, -0.12]), [-0.34 * WL * dir, -WL * flap], 0.58 * s, { dirX: dir, seed: 1740, p, w: lw, fingers: 5, scallops: 9 });
    // talons tucked
    stroke(d, [T([0.0, 0.18]), T([-0.25, 0.32])], { p, w: lw * 1.1, seed: 1760, color: R.pal.gold });
  }

  G.FIG = { POSE0, LOOK0, figure, joints, lerpPose, poseAt, walkPose, ik, dragon, eagle };
})(typeof window !== 'undefined' ? window : globalThis);
