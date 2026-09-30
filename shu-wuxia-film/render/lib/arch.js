/* Architecture & structures: campus buildings, the tunnel mouth (山洞口),
 * gateway (牌坊), houses, city wall, lanterns, torches, printing press,
 * banners, sword mound. All shapes fill before outlining (occlusion). */
(function (G) {
  'use strict';
  const K = G.K;
  const { R, lerp, clamp, smooth, rnd, rrange, noise1, stroke, shape, sketchLine, add, sub, mul, rot, norm, perp,
    ellipse, arc, rectPts, TAU, DEG, f1, halo, text, seqP, inv, easeOut } = K;

  // --------------------------------------------------- modern building
  // o: {p, floors, cols, side (depth px), seed, lit (0..1 night windows), roof}
  function building(d, x, base, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const seed = o.seed || 100, side = o.side === undefined ? w * 0.22 : o.side, rise = side * 0.45;
    const top = base - h;
    // side face (to the right)
    if (side > 0) shape(d, [[x + w, top], [x + w + side, top - rise], [x + w + side, base - rise * 0.2], [x + w, base]], { p: seqP(p, 0, 3), w: 2.6, seed: seed + 1, fill: o.sideFill || R.pal.shade });
    // roof face
    if (side > 0) shape(d, [[x, top], [x + side, top - rise], [x + w + side, top - rise], [x + w, top]], { p: seqP(p, 0, 3), w: 2.4, seed: seed + 2, fill: o.roofFill || R.pal.fillMid });
    // front face
    shape(d, rectPts(x, top, w, h), { p: seqP(p, 0, 3, 0.6), w: 3, seed: seed, fill: o.fill || R.pal.fill });
    const wp = seqP(p, 1, 3, 0.3);
    if (wp <= 0) return;
    const floors = o.floors || Math.max(2, Math.round(h / 46)), cols = o.cols || Math.max(2, Math.round(w / 44));
    const fh = (h - 20) / floors, cw = (w - 16) / cols;
    for (let f = 0; f < floors; f++) {
      const y = top + 14 + f * fh;
      // floor slab line
      if (f > 0) stroke(d, [[x + 2, y - 4], [x + w - 2, y - 4]], { p: clamp((wp - f / floors * 0.5) / 0.5), w: 1.6, seed: seed + 10 + f, brush: false, color: R.pal.soft });
      for (let c = 0; c < cols; c++) {
        const wx = x + 8 + c * cw + cw * 0.18, wy = y + fh * 0.18, ww = cw * 0.64, wh = fh * 0.56;
        const k = seed * 97 + f * 13 + c;
        const cp = clamp((wp - rnd(k, 1) * 0.5) / 0.5);
        if (cp <= 0) continue;
        const lit = o.lit && rnd(k, 2) < o.lit;
        if (lit) {
          const fl = 0.85 + 0.15 * Math.sin(R.t * 2 + k);
          d.add('<rect x="' + f1(wx) + '" y="' + f1(wy) + '" width="' + f1(ww) + '" height="' + f1(wh) + '" fill="' + R.pal.glow + '" opacity="' + (0.85 * cp * fl).toFixed(3) + '"/>');
          halo(d, [wx + ww / 2, wy + wh / 2], ww * 1.6, 'warm', 0.35 * cp * fl);
        }
        shape(d, rectPts(wx, wy, ww, wh), { p: cp, w: 1.7, seed: k, fill: 'none', amp: 0.6 });
      }
    }
    // side windows as vertical slits
    if (side > 12) {
      for (let f = 0; f < floors; f++) {
        const y = top + 14 + f * fh + fh * 0.2;
        const cp = clamp((wp - 0.3 - f / floors * 0.4) / 0.4);
        stroke(d, [[x + w + side * 0.35, y - rise * 0.35], [x + w + side * 0.35, y + fh * 0.5 - rise * 0.35]], { p: cp, w: 1.5, seed: seed + 50 + f, brush: false, color: R.pal.soft });
        stroke(d, [[x + w + side * 0.7, y - rise * 0.7], [x + w + side * 0.7, y + fh * 0.5 - rise * 0.7]], { p: cp, w: 1.5, seed: seed + 70 + f, brush: false, color: R.pal.soft });
      }
    }
    if (o.roof === 'tank') {
      shape(d, rectPts(x + w * 0.6, top - 26, w * 0.22, 26), { p: seqP(p, 2, 3), w: 2, seed: seed + 90 });
    }
    if (o.sign) {
      text(d, o.sign, x + w / 2, top + 30, { size: o.signSize || 22, weight: 700, opacity: seqP(p, 2, 3), spacing: 2 });
    }
  }

  // ------------------------------------------------------- tunnel mouth
  // Arched tunnel into a hill face. Returns the arch geometry.
  function tunnel(d, cx, base, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const r = w / 2, spring = base - (h - r);
    const archPts = (rr, dy = 0) => {
      const pts = [[cx - rr, base + dy]];
      pts.push([cx - rr, spring]);
      for (let a = 180; a <= 360; a += 10) pts.push([cx + Math.cos(a * DEG) * rr, spring + Math.sin(a * DEG) * rr]);
      pts.push([cx + rr, base + dy]);
      return pts;
    };
    // stone ring
    const outer = archPts(r + 26);
    shape(d, outer, { p: seqP(p, 0, 3), w: 3, seed: 150, fill: o.stoneFill || R.pal.fillMid });
    // voussoir joints
    for (let a = 190; a <= 350; a += 20) {
      const u = (a - 190) / 160;
      const cp = clamp((seqP(p, 1, 3) - u * 0.5) / 0.5);
      stroke(d, [[cx + Math.cos(a * DEG) * r, spring + Math.sin(a * DEG) * r], [cx + Math.cos(a * DEG) * (r + 26), spring + Math.sin(a * DEG) * (r + 26)]], { p: cp, w: 2, seed: 160 + a, brush: false });
    }
    // dark interior
    shape(d, archPts(r), { p: seqP(p, 1, 3), w: 3.2, seed: 151, fill: o.innerFill || R.pal.dark });
    // interior depth hatching and far exit light
    const ip = seqP(p, 2, 3);
    if (ip > 0) {
      const ex = [cx + r * 0.1, spring + r * 0.15];
      shape(d, ellipse(ex, r * 0.28, r * 0.34, 0, 24), { p: ip, w: 2, seed: 152, fill: o.exitFill || R.pal.fillMid, color: R.pal.soft });
      halo(d, ex, r * 0.6, 'line', 0.25 * ip);
      for (let i = 0; i < 5; i++) {
        const a0 = [cx - r + 10 + i * 6, base - 10 - i * 30], a1 = [ex[0] - r * 0.28, ex[1] + 20 - i * 8];
        stroke(d, [a0, K.mix(a0, a1, 0.8)], { p: clamp((ip - i * 0.1) / 0.6), w: 1.4, seed: 170 + i, brush: false, color: R.pal.faint });
      }
    }
    // plaque over the arch
    if (o.plaque) {
      const py = spring - r - 26 - 58;
      const pw = o.plaqueW || 230;
      const pp = seqP(p, 2, 3);
      shape(d, rectPts(cx - pw / 2, py, pw, 50), { p: pp, w: 2.6, seed: 180, fill: R.pal.fillNear });
      text(d, o.plaque, cx, py + 36, { size: 32, weight: 700, spacing: 6, opacity: clamp((pp - 0.4) / 0.6) });
    }
    return { spring, r };
  }

  // --------------------------------------------------------- 牌坊 gate
  function paifang(d, cx, base, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const pw = w * 0.06;
    const beamY = base - h * 0.72;
    // pillars
    for (const sx of [-0.42, 0.42]) {
      shape(d, rectPts(cx + sx * w - pw / 2, beamY - 10, pw, h * 0.72 + 10), { p: seqP(p, 0, 4), w: 3, seed: 200 + (sx > 0 ? 1 : 0) });
      shape(d, rectPts(cx + sx * w - pw * 0.9, base - 30, pw * 1.8, 30), { p: seqP(p, 0, 4), w: 2.4, seed: 202 + (sx > 0 ? 1 : 0) });
    }
    // beams
    shape(d, rectPts(cx - w * 0.5, beamY - 22, w, 22), { p: seqP(p, 1, 4), w: 3, seed: 205 });
    shape(d, rectPts(cx - w * 0.46, beamY + 26, w * 0.92, 16), { p: seqP(p, 1, 4), w: 2.6, seed: 206 });
    // plaque
    const plW = w * 0.34, plH = h * 0.2;
    shape(d, rectPts(cx - plW / 2, beamY - 22 - plH - 6, plW, plH), { p: seqP(p, 2, 4), w: 2.8, seed: 207, fill: R.pal.fillNear });
    if (o.plaque) text(d, o.plaque, cx, beamY - 28 - plH * 0.28, { size: plH * 0.58, weight: 700, spacing: plH * 0.1, opacity: seqP(p, 3, 4) });
    // roof with upturned eaves
    roof(d, cx, beamY - 22 - plH - 10, w * 1.12, h * 0.22, { p: seqP(p, 2, 4), seed: 210 });
  }

  // curved Chinese roof: ridge at y-h, eaves at y, width w
  function roof(d, cx, y, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const seed = o.seed || 220;
    const hw = w / 2;
    const top = y - h;
    const eaveL = [cx - hw - 14, y - h * 0.35], eaveR = [cx + hw + 14, y - h * 0.35];
    const pts = [
      eaveL, [cx - hw * 0.92, y], [cx - hw * 0.5, y + 4], [cx + hw * 0.5, y + 4], [cx + hw * 0.92, y], eaveR,
      [cx + hw * 0.78, y - h * 0.45], [cx + hw * 0.55, top + h * 0.1], [cx + hw * 0.5, top], [cx - hw * 0.5, top], [cx - hw * 0.55, top + h * 0.1], [cx - hw * 0.78, y - h * 0.45],
    ];
    shape(d, K.spline(pts, 4, true), { p, w: 3, seed, fill: o.fill || R.pal.fillMid });
    // ridge
    stroke(d, [[cx - hw * 0.56, top - 2], [cx + hw * 0.56, top - 2]], { p, w: 5, seed: seed + 1 });
    // ridge end curls
    for (const sx of [-1, 1]) {
      const b = [cx + sx * hw * 0.56, top - 2];
      stroke(d, [b, [b[0] + sx * 14, b[1] - 8], [b[0] + sx * 10, b[1] - 18]], { p: clamp((p - 0.5) / 0.5), w: 3.2, seed: seed + 2 + sx });
    }
    // tile lines
    const n = Math.max(4, Math.round(w / 34));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const xt = lerp(cx - hw * 0.5, cx + hw * 0.5, u), xb = lerp(cx - hw * 0.95, cx + hw * 0.95, u);
      stroke(d, [[xt, top + 4], [xb, y - 2]], { p: clamp((p - 0.4 - u * 0.3) / 0.3), w: 1.5, seed: seed + 10 + i, brush: false, color: R.pal.soft });
    }
  }

  // traditional house for town scenes
  function house(d, x, base, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const seed = o.seed || 240;
    shape(d, rectPts(x + w * 0.06, base - h, w * 0.88, h), { p: seqP(p, 0, 3), w: 2.6, seed, fill: o.fill || R.pal.fill });
    // door & window
    shape(d, rectPts(x + w * 0.4, base - h * 0.62, w * 0.2, h * 0.62), { p: seqP(p, 1, 3), w: 2, seed: seed + 1, fill: R.pal.shade });
    const wx = x + w * (o.winLeft ? 0.14 : 0.68);
    shape(d, rectPts(wx, base - h * 0.75, w * 0.18, h * 0.3), { p: seqP(p, 1, 3), w: 1.8, seed: seed + 2, fill: o.lit ? R.pal.glow : R.pal.fill, fillOpacity: o.lit ? 0.85 : 1 });
    if (o.lit) halo(d, [wx + w * 0.09, base - h * 0.6], w * 0.35, 'warm', 0.6 * seqP(p, 1, 3));
    for (let k = 1; k < 3; k++) stroke(d, [[wx + w * 0.06 * k, base - h * 0.75], [wx + w * 0.06 * k, base - h * 0.45]], { p: seqP(p, 1, 3), w: 1.2, seed: seed + 3 + k, brush: false });
    roof(d, x + w / 2, base - h + 6, w * 1.02, h * 0.55, { p: seqP(p, 1, 3, 0.5), seed: seed + 10, fill: o.roofFill });
  }

  // ------------------------------------------------------ lantern & torch
  function lantern(d, top, s, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const sway = Math.sin(t * 1.6 + (o.seed || 0)) * 5 * s / 30;
    const c = [top[0] + sway, top[1] + s * 1.3];
    stroke(d, [top, [c[0], c[1] - s * 0.62]], { p, w: 1.6, seed: (o.seed || 260) + 1, brush: false });
    const glowOn = o.glow === undefined ? 1 : o.glow;
    if (glowOn > 0) halo(d, c, s * 3.2, 'warm', 0.55 * glowOn * p * (0.9 + 0.1 * Math.sin(t * 7 + (o.seed || 0))));
    shape(d, ellipse(c, s * 0.52, s * 0.6, 0, 26), { p, w: 2.4, seed: o.seed || 260, fill: glowOn > 0 ? R.pal.glow : R.pal.fill, fillOpacity: glowOn > 0 ? 0.35 + 0.5 * glowOn : 1, color: o.color || R.pal.line });
    for (const k of [-0.25, 0, 0.25]) stroke(d, [[c[0] + k * s, c[1] - s * 0.56], [c[0] + k * s * 1.3, c[1]], [c[0] + k * s, c[1] + s * 0.56]], { p, w: 1.2, seed: (o.seed || 260) + 10 + k * 10, brush: false, color: o.color || R.pal.line });
    stroke(d, [[c[0] - s * 0.22, c[1] - s * 0.62], [c[0] + s * 0.22, c[1] - s * 0.62]], { p, w: 3, seed: (o.seed || 260) + 2, color: o.color });
    stroke(d, [[c[0] - s * 0.22, c[1] + s * 0.62], [c[0] + s * 0.22, c[1] + s * 0.62]], { p, w: 3, seed: (o.seed || 260) + 3, color: o.color });
    stroke(d, [[c[0], c[1] + s * 0.64], [c[0] + sway * 0.4, c[1] + s * 1.05]], { p, w: 2, seed: (o.seed || 260) + 4, color: R.pal.gold });
  }

  function torch(d, base, s, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const tip = [base[0], base[1] - s];
    stroke(d, [base, tip], { p, w: 4, seed: (o.seed || 280) });
    shape(d, rectPts(tip[0] - 7, tip[1] - 4, 14, 12), { p, w: 2, seed: (o.seed || 280) + 1 });
    const fp = clamp((p - 0.5) / 0.5);
    if (fp <= 0) return;
    const fl = (k) => Math.sin(t * (11 + k) + (o.seed || 0) * 3 + k) * 0.5 + noise1(t * 6 + k, (o.seed || 0) + k) * 0.5;
    halo(d, [tip[0], tip[1] - s * 0.25], s * 2.2, 'warm', 0.75 * fp * (0.85 + 0.15 * fl(1)));
    const flame = [];
    const fh = s * 0.55 * (1 + 0.12 * fl(2));
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * Math.PI;
      const rr = s * 0.13 * Math.sin(a);
      flame.push([tip[0] - Math.cos(a) * s * 0.14 + rr * 0.2 * fl(i), tip[1] - 4 - Math.sin(a) * fh * (0.35 + 0.65 * (i === 6 ? 1 : Math.abs(Math.cos(a * 0.5))))]);
    }
    const tongue = [[tip[0] - s * 0.14, tip[1] - 4], [tip[0] - s * 0.08 + fl(3) * 4, tip[1] - fh * 0.6], [tip[0] + fl(4) * 6, tip[1] - fh], [tip[0] + s * 0.07 + fl(5) * 4, tip[1] - fh * 0.55], [tip[0] + s * 0.14, tip[1] - 4]];
    shape(d, K.spline(tongue, 4), { p: fp, w: 2.2, seed: (o.seed || 280) + 2, fill: R.pal.glow, fillOpacity: 0.85, color: R.pal.gold, amp: 1.5 });
    const inner = [[tip[0] - s * 0.06, tip[1] - 5], [tip[0] + fl(6) * 3, tip[1] - fh * 0.55], [tip[0] + s * 0.06, tip[1] - 5]];
    shape(d, K.spline(inner, 4), { p: fp, w: 1.6, seed: (o.seed || 280) + 3, fill: '#fff4d6', color: '#fff4d6', amp: 1 });
    if (o.smoke !== false) G.N.smoke(d, tip[0], tip[1] - fh, t, { n: 2, life: 2.2, rise: 30, w: 1.6, opacity: 0.5, color: R.pal.faint });
  }

  // ---------------------------------------------------------- city wall
  function cityWall(d, x0, x1, top, base, o = {}, t = 0) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const seed = o.seed || 300;
    shape(d, [[x0, top], [x1, top], [x1 + 30, base], [x0 - 30, base]], { p: seqP(p, 0, 3), w: 3, seed, fill: o.fill || R.pal.fillMid });
    // crenellations
    const mw = 34, gap = 22;
    for (let x = x0; x < x1 - mw; x += mw + gap) {
      const k = Math.round(x);
      shape(d, rectPts(x, top - 30, mw, 32), { p: clamp((seqP(p, 0, 3) - (x - x0) / (x1 - x0) * 0.6) / 0.4), w: 2.4, seed: seed + k, fill: o.fill || R.pal.fillMid });
    }
    // brick courses
    const bp = seqP(p, 1, 3);
    for (let y = top + 34, r = 0; y < base - 10; y += 34, r++) {
      stroke(d, [[x0 - 4, y], [x1 + 4, y]], { p: clamp((bp - r * 0.08) / 0.6), w: 1.3, seed: seed + 500 + r, brush: false, color: R.pal.faint });
      for (let x = x0 + (r % 2) * 40 + 20; x < x1; x += 80) stroke(d, [[x, y], [x, y + 34]], { p: clamp((bp - r * 0.08) / 0.6), w: 1.2, seed: seed + 600 + r * 50 + Math.round(x), brush: false, color: R.pal.faint });
    }
    // gate
    if (o.gateX) {
      const gw = o.gateW || 150, gh = base - top - 30;
      const gx = o.gateX;
      const r = gw / 2, spring = base - gh + r;
      const pts = [[gx - r, base]];
      pts.push([gx - r, spring]);
      for (let a = 180; a <= 360; a += 12) pts.push([gx + Math.cos(a * DEG) * r, spring + Math.sin(a * DEG) * r]);
      pts.push([gx + r, base]);
      shape(d, pts, { p: seqP(p, 1, 3), w: 3, seed: seed + 900, fill: R.pal.dark });
      // gate tower
      const tw = o.towerW || 360;
      shape(d, rectPts(gx - tw * 0.38, top - 150, tw * 0.76, 120), { p: seqP(p, 2, 3), w: 3, seed: seed + 901, fill: R.pal.fillMid });
      for (let k = 0; k < 4; k++) shape(d, rectPts(gx - tw * 0.3 + k * tw * 0.16, top - 120, tw * 0.1, 60), { p: seqP(p, 2, 3), w: 2, seed: seed + 910 + k, fill: o.litTower ? R.pal.glow : R.pal.shade, fillOpacity: o.litTower ? 0.8 : 1 });
      if (o.litTower) halo(d, [gx, top - 90], tw * 0.6, 'warm', 0.45 * seqP(p, 2, 3));
      roof(d, gx, top - 150, tw, 70, { p: seqP(p, 2, 3), seed: seed + 920 });
      roof(d, gx, top - 230, tw * 0.62, 60, { p: seqP(p, 2, 3), seed: seed + 930 });
      shape(d, rectPts(gx - tw * 0.24, top - 220, tw * 0.48, 72), { p: seqP(p, 2, 3), w: 2.6, seed: seed + 940, fill: R.pal.fillMid });
      if (o.sign) text(d, o.sign, gx, top - 176, { size: 38, weight: 700, spacing: 10, opacity: seqP(p, 2, 3), color: R.pal.gold });
    }
  }

  // --------------------------------------------------------- printing press
  function printingPress(d, c, s, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const T = (q) => [c[0] + q[0] * s, c[1] + q[1] * s];
    const seed = o.seed || 320;
    const spin = (o.spin === undefined ? 1 : o.spin) * t * 3.2;
    // frame plates
    shape(d, [[-1.1, 0.6], [-1.0, -0.55], [-0.2, -0.75], [0.9, -0.55], [1.1, 0.6]].map(T), { p: seqP(p, 0, 3), w: 3, seed, fill: o.fill || R.pal.fillMid });
    // rollers
    const rolls = [[-0.5, -0.1, 0.3], [0.25, -0.2, 0.36], [0.62, 0.22, 0.22]];
    rolls.forEach((r, i) => {
      const cc = T([r[0], r[1]]), rr = r[2] * s;
      shape(d, ellipse(cc, rr, rr, 0, 32), { p: seqP(p, 1, 3), w: 3, seed: seed + 10 + i, fill: R.pal.fill });
      for (let k = 0; k < 4; k++) {
        const a = spin * (i % 2 ? -1 : 1) + k * Math.PI / 2;
        stroke(d, [cc, add(cc, K.polar(a, rr * 0.85))], { p: seqP(p, 1, 3), w: 2, seed: seed + 20 + i * 4 + k, brush: false });
      }
      shape(d, ellipse(cc, rr * 0.18, rr * 0.18, 0, 12), { p: seqP(p, 1, 3), w: 2, seed: seed + 40 + i, fill: R.pal.gold, color: R.pal.gold });
    });
    // paper path
    stroke(d, [T([-1.35, -0.35]), T([-0.5, -0.4]), T([0.25, 0.16]), T([0.62, -0.0]), T([1.4, 0.05])], { p: seqP(p, 2, 3), w: 2, seed: seed + 50, brush: false, color: R.pal.soft });
    // base & legs
    stroke(d, [T([-1.2, 0.62]), T([1.2, 0.62])], { p: seqP(p, 0, 3), w: 4, seed: seed + 60 });
    stroke(d, [T([-1.0, 0.62]), T([-1.05, 0.95])], { p: seqP(p, 0, 3), w: 4, seed: seed + 61 });
    stroke(d, [T([1.0, 0.62]), T([1.05, 0.95])], { p: seqP(p, 0, 3), w: 4, seed: seed + 62 });
    if (o.label) text(d, o.label, T([-0.35, 0.42])[0], T([-0.35, 0.42])[1], { size: s * 0.2, weight: 700, opacity: seqP(p, 2, 3), color: R.pal.gold });
  }

  // --------------------------------------------------------------- banner
  // vertical flag hanging from a crossbar at the pole top, waving in wind
  function banner(d, poleBase, poleH, fw, fh, t, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const top = [poleBase[0], poleBase[1] - poleH];
    stroke(d, [poleBase, top], { p: seqP(p, 0, 2), w: 5, seed: (o.seed || 340) });
    shape(d, ellipse([top[0], top[1] - 8], 8, 8, 0, 12), { p: seqP(p, 0, 2), w: 2, seed: (o.seed || 340) + 1, fill: R.pal.gold, color: R.pal.gold });
    const unfurl = o.unfurl === undefined ? 1 : smooth(o.unfurl);
    if (unfurl <= 0.01) return;
    const wind = o.wind || 1;
    const wave = (u, v) => Math.sin(u * 5 - t * 5 * wind + v * 1.5) * 10 * u * wind;
    const pts = [];
    const n = 12;
    const W2 = fw * unfurl;
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push([top[0] + u * W2, top[1] + 10 + wave(u, 0)]); }
    for (let i = n; i >= 0; i--) { const u = i / n; pts.push([top[0] + u * W2, top[1] + 10 + fh + wave(u, 1) - u * 12]); }
    shape(d, pts, { p: seqP(p, 1, 2), w: 3, seed: (o.seed || 340) + 2, fill: o.fill || R.pal.fillNear });
    // tassels on the free edge
    for (let k = 0; k < 3; k++) {
      const u = 1, v = (k + 0.5) / 3;
      const a = [top[0] + W2, top[1] + 10 + fh * v + wave(u, v)];
      stroke(d, [a, [a[0] + 14, a[1] + 6]], { p: seqP(p, 1, 2), w: 3, seed: (o.seed || 340) + 5 + k, color: R.pal.gold });
    }
    if (o.text && unfurl > 0.6) {
      const chars = Array.from(o.text);
      chars.forEach((ch, i) => {
        const u = 0.5, v = (i + 0.72) / chars.length;
        const cx = top[0] + W2 * u, cy = top[1] + 10 + fh * v * 0.94 + wave(u, v);
        text(d, ch, cx, cy, { size: Math.min(fw * 0.62, fh / chars.length * 0.8), weight: 700, opacity: smooth((unfurl - 0.6) / 0.4) * seqP(p, 1, 2), color: o.textColor });
      });
    }
  }

  // ------------------------------------------------------------ sword mound
  function swordMound(d, c, s, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const mound = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; mound.push([c[0] + Math.cos(a) * s, c[1] + Math.sin(a) * s * 0.38]); }
    // swords behind the mound's front edge (tips buried)
    (o.swords || [[-0.45, -8], [-0.1, 6], [0.3, -4]]).forEach((sw, i) => {
      const base = [c[0] + sw[0] * s, c[1] - s * 0.22 + Math.abs(sw[0]) * s * 0.18];
      G.PROPS.sword(d, add(base, K.polar((-90 + sw[1]) * DEG, s * 0.55)), 90 + sw[1], s * 0.62, { p, tassel: false, seed: 360 + i * 10 });
    });
    shape(d, mound, { p, w: 3, seed: o.seed || 350, fill: o.fill || R.pal.fillMid });
    for (let i = 0; i < 4; i++) stroke(d, [[c[0] - s * 0.6 + i * s * 0.35, c[1] - s * 0.1], [c[0] - s * 0.45 + i * s * 0.35, c[1] - s * 0.18]], { p: clamp((p - 0.5) / 0.5), w: 1.6, seed: 356 + i, color: R.pal.soft });
  }

  G.ARCH = { building, tunnel, paifang, roof, house, lantern, torch, cityWall, printingPress, banner, swordMound };
})(typeof window !== 'undefined' ? window : globalThis);
