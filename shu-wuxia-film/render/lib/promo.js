/* Components for the 60-second promo cut: 舍我樓, the title plaque, old
 * newspapers and a bellows camera that shatter into digital light, a digital
 * wave, a computer that generates video layers, the "AI" light trail, Reels
 * frames with animated memes, the four skill badges and the light orb, and
 * the recruitment banner. Same hand-drawn conventions as the other libs:
 * shapes are filled with the paper colour before their outline, and every
 * component takes a draw-on progress p. */
(function (G) {
  'use strict';
  const K = G.K, A = G.ARCH, FX = G.FX, PR = G.PROPS;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, easeOutBack, inv, rnd, rrange, noise1, stroke, shape, add, sub, mul, rot,
    norm, perp, mix, ellipse, rectPts, TAU, DEG, f1, halo, text, spline, seqP } = K;

  const rrect = (x, y, w, h, r, n = 4) => {
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * DEG; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x + w - r, y + r, -90); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, 90); corner(x + r, y + r, 180);
    return pts;
  };
  const dot = (d, c, r, col, op = 1) => { if (r > 0.1 && op > 0.01) d.add('<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '" fill="' + col + '"' + (op < 1 ? ' opacity="' + op.toFixed(3) + '"' : '') + '/>'); };
  const sq = (d, c, s, ang, col, op = 1) => {
    if (s <= 0.2 || op <= 0.01) return;
    d.add('<rect x="' + f1(c[0] - s / 2) + '" y="' + f1(c[1] - s / 2) + '" width="' + f1(s) + '" height="' + f1(s) + '" fill="' + col + '" opacity="' + op.toFixed(3) + '" transform="rotate(' + f1(ang) + ' ' + f1(c[0]) + ' ' + f1(c[1]) + ')"/>');
  };

  // ---------------------------------------------------------- 舍我樓
  // The main tower with its vertical name board, on a podium with an entrance.
  function shewo(d, x, base, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const w = o.w || 230, h = o.h || 470, seed = o.seed || 2100, side = w * 0.24;
    const top = base - h;
    A.building(d, x, base - 70, w, h - 70, { p: seqP(p, 0, 3), seed, floors: 10, cols: 4, side, lit: o.lit });
    shape(d, rectPts(x - 8, top - 14, w + 16, 14), { p: seqP(p, 1, 3), w: 2.4, seed: seed + 5, fill: R.pal.fillNear });
    stroke(d, [[x + w * 0.3, top - 14], [x + w * 0.3, top - 60]], { p: seqP(p, 1, 3), w: 2.2, seed: seed + 6, brush: false });
    // name board 舍我樓
    const bp = seqP(p, 2, 3);
    const sx = x + w - 56, sy = top + 34, sw = 42, sh = 158;
    shape(d, rectPts(sx, sy, sw, sh), { p: bp, w: 2.4, seed: seed + 7, fill: R.pal.fillNear, color: o.signColor || R.pal.gold });
    ['舍', '我', '樓'].forEach((ch, i) => text(d, ch, sx + sw / 2, sy + 42 + i * 46, { size: 32, weight: 700, color: o.signColor || R.pal.gold, opacity: clamp((bp - 0.3) / 0.7) }));
    // podium with the entrance
    A.building(d, x - 70, base, w + 140, 76, { p: seqP(p, 1, 3), seed: seed + 20, floors: 1, cols: 7, side: 0 });
    shape(d, rectPts(x + w / 2 - 44, base - 60, 88, 60), { p: seqP(p, 2, 3), w: 2.4, seed: seed + 21, fill: R.pal.fillMid });
    stroke(d, [[x + w / 2, base - 60], [x + w / 2, base]], { p: seqP(p, 2, 3), w: 1.8, seed: seed + 22, brush: false });
    if (o.label) text(d, o.label, x + w / 2, base + 40, { size: 26, color: R.pal.soft, opacity: bp });
  }

  // ------------------------------------------------------- title plaque
  // Gold plaque whose title is brushed on, over an ink wash that blooms out.
  function titleCard(d, c, p, o = {}) {
    if (p <= 0) return;
    const str = o.text || '世新新聞系武功秘笈';
    const size = o.size || 92, w = o.w || 1060, h = o.h || 176;
    const ink = smooth(clamp(p / 0.45));
    FX.washBlob(d, c, w * 0.58, h * 0.95, { p: ink, seed: 44, color: R.pal.dark, opacity: 0.55 });
    for (let k = 0; k < 9; k++) {           // ink speckles thrown out by the bloom
      const a = rnd(46, k) * TAU, rr = lerp(w * 0.3, w * 0.62, rnd(47, k)) * easeOut(ink);
      dot(d, add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.32]), rrange(48, k, 3, 8) * ink, R.pal.dark, 0.5 * ink);
    }
    const fp = smooth(inv(0.1, 0.5, p));
    if (fp > 0) {
      const x = c[0] - w / 2, y = c[1] - h / 2;
      shape(d, rrect(x, y, w, h, 18), { p: fp, w: 3.2, seed: 2201, fill: R.pal.fillNear, fillOpacity: 0.85, color: R.pal.gold });
      shape(d, rrect(x + 12, y + 12, w - 24, h - 24, 10), { p: fp, w: 1.6, seed: 2202, fill: 'none', color: R.pal.gold });
      // cloud-curl corners
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const cc = [c[0] + sx * (w / 2 - 34), c[1] + sy * (h / 2 - 34)];
        const pts = [];
        for (let i = 0; i <= 16; i++) { const a = (i / 16) * 1.7 * TAU; const rr = 16 * (1 - i / 22); pts.push([cc[0] + Math.cos(a) * rr * sx, cc[1] + Math.sin(a) * rr * sy]); }
        stroke(d, pts, { p: fp, w: 2, seed: 2210 + sx * 3 + sy, color: R.pal.gold, brush: false });
      }
    }
    const tp = inv(0.3, 0.92, p);
    if (tp > 0) FX.revealText(d, str, c[0], c[1] + size * 0.36, tp, { size, color: R.pal.gold, glow: 0.45, spacing: 0.08, stagger: 0.55 });
  }

  // ------------------------------------------------ old media to shatter
  function paperStack(d, c, s, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const sheets = [[-0.06, 0.1, -4], [0.05, 0.05, 3], [-0.02, 0.0, -2], [0.0, -0.06, 1]];
    sheets.forEach(([dx, dy, ang], i) => {
      PR.newspaper(d, add(c, [dx * s, dy * s]), s, s * 0.7, { ang, seed: 2300 + i * 9, cols: 3, rows: 5, lw: 1.6, p, title: i === sheets.length - 1 ? (o.title || '舊聞日報') : null, titleColor: R.pal.line });
    });
    // string tying the bundle
    stroke(d, [add(c, [-s * 0.55, s * 0.02]), add(c, [s * 0.55, -s * 0.03])], { p, w: 2.2, seed: 2340, color: R.pal.gold });
    stroke(d, [add(c, [0.02 * s, -s * 0.42]), add(c, [-0.02 * s, s * 0.44])], { p, w: 2.2, seed: 2341, color: R.pal.gold });
  }

  // vintage bellows camera on a wooden tripod
  function oldCamera(d, c, s, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const T = (x, y) => [c[0] + x * s, c[1] + y * s];
    const base = o.base === undefined ? c[1] + 1.15 * s : o.base;
    // tripod
    for (const [fx, sd] of [[-0.42, 1], [0.08, 2], [0.5, 3]]) stroke(d, [T(0.02, 0.36), [c[0] + fx * s, base]], { p, w: 3, seed: 2400 + sd });
    shape(d, rectPts(c[0] - 0.12 * s, c[1] + 0.3 * s, 0.26 * s, 0.08 * s), { p, w: 2, seed: 2404, fill: R.pal.fillMid });
    // dark cloth draped over the back
    shape(d, spline([T(-0.62, -0.32), T(-0.4, -0.38), T(-0.36, 0.3), T(-0.5, 0.52), T(-0.66, 0.36), T(-0.7, 0.0)], 4, true), { p, w: 2.2, seed: 2405, fill: R.pal.shade });
    // body box
    shape(d, rectPts(c[0] - 0.42 * s, c[1] - 0.32 * s, 0.4 * s, 0.62 * s), { p, w: 2.8, seed: 2406, fill: R.pal.fill });
    // bellows (accordion) to the lens board
    const bel = [T(-0.02, -0.26), T(0.34, -0.17), T(0.34, 0.17), T(-0.02, 0.26)];
    shape(d, bel, { p, w: 2.6, seed: 2407, fill: R.pal.fillMid });
    for (let k = 1; k < 5; k++) {
      const u = k / 5, y0 = lerp(-0.26, -0.17, u), x = lerp(-0.02, 0.34, u);
      stroke(d, [T(x, y0), T(x, -y0)], { p, w: 1.4, seed: 2410 + k, brush: false, color: R.pal.soft });
    }
    shape(d, rectPts(c[0] + 0.34 * s, c[1] - 0.22 * s, 0.1 * s, 0.44 * s), { p, w: 2.4, seed: 2416, fill: R.pal.fill });
    shape(d, ellipse(T(0.5, 0), 0.12 * s, 0.12 * s, 0, 20), { p, w: 2.6, seed: 2417, fill: R.pal.fillNear });
    shape(d, ellipse(T(0.5, 0), 0.06 * s, 0.06 * s, 0, 16), { p, w: 1.8, seed: 2418, fill: R.pal.dark });
    // flash tray on top
    stroke(d, [T(-0.22, -0.32), T(-0.22, -0.5)], { p, w: 2, seed: 2419, brush: false });
    shape(d, [T(-0.4, -0.5), T(-0.04, -0.5), T(-0.08, -0.56), T(-0.36, -0.56)], { p, w: 2, seed: 2420, fill: R.pal.fillMid });
  }

  // ------------------------------------------- shatter into digital light
  // Breaks a drawing (drawFn(d)) into shards that fly from `from`, spin and
  // fade, shedding pixel-like light points. box: [x0, y0, x1, y1].
  function shatter(d, drawFn, box, from, t0, t, o = {}) {
    if (t < t0) { drawFn(d); return; }
    const age = t - t0, life = o.life || 1.1, seed = o.seed || 2500;
    const [x0, y0, x1, y1] = box, cols = o.cols || 4, rows = o.rows || 3;
    if (age < life) {
      const cw = (x1 - x0) / cols, rh = (y1 - y0) / rows;
      const J = (i, j) => [x0 + i * cw + (i > 0 && i < cols ? rrange(seed, i * 31 + j, -0.3, 0.3) * cw : 0), y0 + j * rh + (j > 0 && j < rows ? rrange(seed + 1, i * 17 + j, -0.3, 0.3) * rh : 0)];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const quad = [J(i, j), J(i + 1, j), J(i + 1, j + 1), J(i, j + 1)];
        const tris = rnd(seed + 2, i * 7 + j) > 0.5 ? [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]] : [[quad[0], quad[1], quad[3]], [quad[1], quad[2], quad[3]]];
        tris.forEach((tri, k) => {
          const cen = mul(add(add(tri[0], tri[1]), tri[2]), 1 / 3);
          const dir = norm(add(sub(cen, from), [rrange(seed + 3, i * 13 + j * 5 + k, -40, 40), rrange(seed + 4, i * 11 + j * 3 + k, -60, 20)]));
          const sp = rrange(seed + 5, i * 19 + j * 7 + k, 260, 620) * (o.speed || 1);
          const u = age / life;
          const off = add(mul(dir, sp * age), [0, 160 * age * age]);
          const ang = rrange(seed + 6, i * 23 + j + k * 3, -260, 260) * age;
          const sc = 1 - 0.55 * easeIn(u);
          const id = d.id('sh');
          d.add('<defs><clipPath id="' + id + '"><path d="M' + tri.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z"/></clipPath></defs>');
          d.open('transform="translate(' + f1(cen[0] + off[0]) + ' ' + f1(cen[1] + off[1]) + ') rotate(' + f1(ang) + ') scale(' + sc.toFixed(3) + ') translate(' + f1(-cen[0]) + ' ' + f1(-cen[1]) + ')" opacity="' + (1 - easeIn(u)).toFixed(3) + '"');
          d.open('clip-path="url(#' + id + ')"');
          drawFn(d);
          d.close(); d.close();
        });
      }
    }
    pixels(d, box, t0, t, { n: o.pixels || 90, seed: seed + 9, life: o.pixelLife || 2.2, rise: o.rise || 260, scale: o.scale });
  }

  // light points: small squares (some with 0/1) turning from white to gold
  function pixels(d, box, t0, t, o = {}) {
    const [x0, y0, x1, y1] = box, n = o.n || 80, seed = o.seed || 2600, life = o.life || 2.0;
    for (let i = 0; i < n; i++) {
      const born = t0 + rnd(seed, i) * 0.6, age = t - born;
      if (age < 0 || age > life) continue;
      const u = age / life;
      const st = [lerp(x0, x1, rnd(seed + 1, i)), lerp(y0, y1, rnd(seed + 2, i))];
      const vx = rrange(seed + 3, i, -1, 1) * 180, vy = -rrange(seed + 4, i, 0.4, 1) * (o.rise || 240);
      const pos = add(st, [vx * age + Math.sin(age * 4 + i) * 14, vy * age * (1 - 0.3 * u)]);
      const s = rrange(seed + 5, i, 4, 11) * (1 - 0.4 * u) * (o.scale || 1);
      const tw = 0.6 + 0.4 * Math.sin(age * 18 + i * 1.7);
      const col = u < 0.25 ? R.pal.line : R.pal.gold;
      const op = Math.sin(Math.PI * Math.min(1, u * 1.4)) * tw;
      if (rnd(seed + 6, i) < 0.12) text(d, rnd(seed + 7, i) < 0.5 ? '0' : '1', pos[0], pos[1], { font: "'Cormorant Garamond', serif", weight: 600, size: s * 2.2, color: R.pal.gold, opacity: op });
      else sq(d, pos, s, rnd(seed + 8, i) < 0.3 ? 45 : 0, col, op);
      if (i % 9 === 0) halo(d, pos, s * 3, 'gold', 0.35 * op);
    }
  }

  // a towering wave made of light points (傳媒大浪滔天), anchored at base
  // [x, y], `s` = height. p grows it, `crash` (0..1) breaks it into sparks.
  const WAVE = [[0, 0], [0.18, -0.08], [0.36, -0.22], [0.52, -0.45], [0.64, -0.7], [0.72, -0.9], [0.8, -1.0], [0.9, -0.98], [0.98, -0.88], [1.0, -0.76],
    [0.94, -0.74], [0.9, -0.82], [0.84, -0.8], [0.82, -0.66], [0.86, -0.4], [0.92, -0.16], [1.0, 0]];
  function insidePoly(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const WAVE_DOTS = [];
  for (let gy = 0; gy < 32; gy++) for (let gx = 0; gx < 42; gx++) {
    const q = [(gx + 0.5 + (gy % 2) * 0.5) / 42, -(gy + 0.5) / 32];
    if (insidePoly(q, WAVE)) WAVE_DOTS.push(q);
  }
  function digitalWave(d, base, w, s, t, p, crash = 0, o = {}) {
    if (p <= 0) return;
    const dir = o.dir || -1;                 // the curl faces the hero on the left
    const T = (q) => [base[0] + (dir < 0 ? (1 - q[0]) : q[0]) * w - (dir < 0 ? w : 0), base[1] + q[1] * s * easeOut(p)];
    const outline = spline(WAVE.map(T), 4);
    if (crash < 1) stroke(d, outline, { p: smooth(p), w: 3.4, color: R.pal.gold, seed: 2700, opacity: 1 - crash });
    WAVE_DOTS.forEach((q, i) => {
      const k = rnd(2701, i);
      if (k > p * 1.2) return;
      let pos = T(q);
      if (crash > 0) pos = add(pos, [dir * crash * rrange(2702, i, 120, 420), -crash * rrange(2703, i, -80, 260) + crash * crash * 300]);
      const tw = 0.55 + 0.45 * Math.sin(t * 9 + i * 0.7);
      sq(d, pos, 8 + 3 * Math.sin(t * 5 + i), 0, q[1] < -0.72 ? R.pal.line : R.pal.gold, (0.35 + 0.65 * tw) * (1 - crash));
    });
    if (p > 0.3) { halo(d, T([0.6, -0.4]), s * 0.75, 'gold', 0.4 * (1 - crash) * p); halo(d, T([0.8, -0.86]), s * 0.4, 'line', 0.4 * (1 - crash) * p); }
  }

  // -------------------------------------------------------- computer
  // Monitor with an editing interface. st: {unlock, title, layers, play}
  function monitor(d, c, w, h, t, st = {}, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const x = c[0] - w / 2, y = c[1] - h / 2;
    // stand
    shape(d, [[c[0] - 26, y + h], [c[0] + 26, y + h], [c[0] + 40, y + h + 70], [c[0] - 40, y + h + 70]], { p, w: 2.6, seed: 2801, fill: R.pal.fillMid });
    shape(d, rrect(c[0] - 130, y + h + 66, 260, 22, 8), { p, w: 2.6, seed: 2802, fill: R.pal.fillNear });
    // bezel + screen
    shape(d, rrect(x, y, w, h, 18), { p, w: 3.4, seed: 2803, fill: R.pal.fillNear });
    const sx = x + 18, sy = y + 18, sw = w - 36, sh = h - 36;
    const glow = st.glow || 0;
    shape(d, rectPts(sx, sy, sw, sh), { p, w: 2, seed: 2804, fill: '#3d0609', fillOpacity: 0.92 });
    if (glow > 0) halo(d, c, w * 0.6, 'gold', 0.4 * glow);
    const up = clamp((p - 0.4) / 0.6);
    if (up <= 0) return;
    // title bar with window dots and the course title
    stroke(d, [[sx, sy + 34], [sx + sw, sy + 34]], { p: up, w: 1.6, seed: 2805, brush: false, color: R.pal.soft });
    [0, 1, 2].forEach((k) => dot(d, [sx + 20 + k * 20, sy + 17], 5, k === 0 ? R.pal.gold : R.pal.soft, up));
    if ((st.title || 0) > 0) { halo(d, [sx + sw / 2, sy + 18], 120, 'gold', 0.3 * st.title); text(d, o.title || 'AI 與媒體產業', sx + sw / 2, sy + 27, { size: 24, weight: 700, color: R.pal.gold, opacity: st.title, spacing: 2 }); }
    // tool column
    for (let k = 0; k < 4; k++) shape(d, rrect(sx + 10, sy + 50 + k * 40, 26, 26, 5), { p: up, w: 1.4, seed: 2806 + k, fill: 'none', color: R.pal.soft });
    // preview pane
    const px = sx + 52, py = sy + 46, pw = sw * 0.62, ph = sh * 0.52;
    shape(d, rectPts(px, py, pw, ph), { p: up, w: 1.8, seed: 2811, fill: '#52090d', color: R.pal.soft });
    const unlock = st.unlock || 0;
    const gen = st.layers || 0;
    if (gen > 0) {
      // a picture builds itself in the preview: hills, sun, play button
      const g1 = clamp(gen / 0.4);
      stroke(d, [[px + 10, py + ph - 14], [px + pw * 0.32, py + ph * 0.45], [px + pw * 0.5, py + ph * 0.7], [px + pw * 0.7, py + ph * 0.35], [px + pw - 10, py + ph - 14]], { p: g1, w: 2.2, seed: 2812, color: R.pal.line });
      shape(d, ellipse([px + pw * 0.8, py + ph * 0.26], 16, 16, 0, 16), { p: g1, w: 2, seed: 2813, fill: 'none', color: R.pal.gold });
      const pc = [px + pw / 2, py + ph / 2];
      shape(d, [add(pc, [-14, -18]), add(pc, [22, 0]), add(pc, [-14, 18])], { p: clamp((gen - 0.3) / 0.3), w: 2, seed: 2814, fill: R.pal.gold, color: R.pal.gold });
    }
    // padlock in the middle of the preview until it is unlocked
    if (unlock < 1) {
      const lc = [px + pw / 2, py + ph / 2 + 8];
      const op = 1 - smooth(inv(0.6, 1, unlock));
      d.open('opacity="' + op.toFixed(3) + '"');
      const lift = easeOutBack(clamp(unlock / 0.6)) * 16;
      const arcPts = [];
      for (let a = 180; a <= 360; a += 15) arcPts.push([lc[0] + Math.cos(a * DEG) * 22, lc[1] - 14 - lift + Math.sin(a * DEG) * 26]);
      stroke(d, [[lc[0] - 22, lc[1] - lift * 0]].concat(arcPts).concat([[lc[0] + 22, lc[1] - 14 - lift + 12]]), { p: up, w: 4, seed: 2815, color: R.pal.gold, brush: false });
      shape(d, rrect(lc[0] - 32, lc[1] - 8, 64, 50, 8), { p: up, w: 2.6, seed: 2816, fill: R.pal.fillNear, color: R.pal.gold });
      dot(d, [lc[0], lc[1] + 14], 6, R.pal.gold, up);
      d.close();
    }
    // side panel: layer list
    const lx = px + pw + 14, lw = sx + sw - lx - 10;
    for (let k = 0; k < 4; k++) {
      const lp = clamp((gen - 0.12 * k) / 0.3);
      if (lp <= 0) continue;
      shape(d, rrect(lx, py + k * 44, lw * easeOutBack(lp), 34, 6), { p: 1, w: 1.6, seed: 2820 + k, fill: '#5d0a10', color: k === 3 ? R.pal.gold : R.pal.soft });
      text(d, ['影像', '字幕', '音樂', 'AI 特效'][k], lx + 14, py + k * 44 + 24, { size: 18, anchor: 'start', color: k === 3 ? R.pal.gold : R.pal.line, opacity: lp });
    }
    // timeline: tracks fill with clips, a playhead runs
    const ty = py + ph + 22, tw = sw - 62;
    for (let r = 0; r < 3; r++) {
      const yy = ty + r * 30;
      stroke(d, [[sx + 52, yy + 22], [sx + 52 + tw, yy + 22]], { p: up, w: 1, seed: 2830 + r, brush: false, color: R.pal.faint });
      const clips = [[0.0, 0.3], [0.33, 0.62], [0.66, 0.95]];
      clips.forEach(([a, b], k) => {
        const cp = clamp((gen - 0.15 - 0.08 * (r * 3 + k)) / 0.25);
        if (cp <= 0) return;
        const cx0 = sx + 52 + a * tw, cw = (b - a) * tw * easeOut(cp);
        shape(d, rrect(cx0, yy, cw, 20, 4), { p: 1, w: 1.4, seed: 2840 + r * 3 + k, fill: r === 2 ? '#7a5a1f' : '#6a0d14', color: r === 2 ? R.pal.gold : R.pal.soft });
        if (r === 1) for (let b2 = 0; b2 < 10; b2++) { const bx = cx0 + 6 + b2 * (cw - 12) / 10; const bh = 4 + 6 * Math.abs(Math.sin(t * 8 + b2 + k)); stroke(d, [[bx, yy + 10 - bh / 2], [bx, yy + 10 + bh / 2]], { w: 1.4, seed: 2850 + b2, brush: false, color: R.pal.line, amp: 0 }); }
      });
    }
    if ((st.play || 0) > 0) {
      const hx = sx + 52 + tw * ((st.play * 1.3) % 1);
      stroke(d, [[hx, ty - 6], [hx, ty + 88]], { w: 2.4, seed: 2860, brush: false, color: R.pal.gold, amp: 0 });
    }
  }

  // floating cards that pop out of the screen: generated layers
  function layerCards(d, c, t, p, o = {}) {
    for (let k = 0; k < 4; k++) {
      const lp = clamp((p - k * 0.18) / 0.4);
      if (lp <= 0) continue;
      const e = easeOutBack(lp);
      const pos = add(c, [k * 70 * e - 105, -k * 58 * e - 20 + Math.sin(t * 2 + k) * 6]);
      const w = 180, h = 112;
      d.open('opacity="' + clamp(lp * 1.5).toFixed(3) + '"');
      shape(d, rrect(pos[0] - w / 2, pos[1] - h / 2, w, h, 10), { p: 1, w: 2, seed: 2900 + k, fill: R.pal.fillNear, fillOpacity: 0.92, color: k === 3 ? R.pal.gold : R.pal.line });
      if (k === 0) { shape(d, ellipse(add(pos, [0, -14]), 14, 14, 0, 14), { w: 1.8, seed: 2910, fill: 'none' }); stroke(d, spline([add(pos, [-30, 36]), add(pos, [0, 6]), add(pos, [30, 36])], 4), { w: 1.8, seed: 2911 }); }
      if (k === 1) { text(d, 'T', pos[0] - 52, pos[1] + 14, { font: "'Cormorant Garamond', serif", weight: 600, size: 44, color: R.pal.line }); for (let r = 0; r < 3; r++) stroke(d, [add(pos, [-20, -20 + r * 18]), add(pos, [62 - r * 16, -20 + r * 18])], { w: 1.8, seed: 2912 + r, brush: false }); }
      if (k === 2) { for (let b = 0; b < 14; b++) { const bx = pos[0] - 70 + b * 10.5, bh = 10 + 30 * Math.abs(Math.sin(t * 7 + b * 0.8)); stroke(d, [[bx, pos[1] - bh / 2], [bx, pos[1] + bh / 2]], { w: 2, seed: 2915 + b, brush: false, color: R.pal.gold, amp: 0 }); } }
      if (k === 3) { text(d, 'AI', pos[0], pos[1] + 16, { font: "'Cormorant Garamond', serif", weight: 600, size: 52, color: R.pal.gold }); sparkle(d, add(pos, [52, -26]), 12 + 4 * Math.sin(t * 6), R.pal.gold); sparkle(d, add(pos, [-56, 22]), 8, R.pal.line); }
      d.close();
    }
  }

  function sparkle(d, c, r, col, op = 1) {
    if (r <= 0.5) return;
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.28 : r; pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]); }
    d.add('<path d="M' + pts.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z" fill="' + col + '" opacity="' + op.toFixed(3) + '"/>');
  }

  // ------------------------------------------------- "AI" light trail
  // Strokes of the letters in a box; p draws them in order with a bright head.
  const AI_STROKES = [[[0, 1], [0.5, 0]], [[0.5, 0], [1, 1]], [[0.24, 0.62], [0.76, 0.62]], [[1.3, 0], [1.9, 0]], [[1.6, 0], [1.6, 1]], [[1.3, 1], [1.9, 1]]];
  function aiTrail(d, box, p, t, o = {}) {
    if (p <= 0) return null;
    const [x, y, s] = box;                    // top-left and letter height
    const T = (q) => [x + q[0] * s * 0.62, y + q[1] * s];
    const n = AI_STROKES.length;
    let head = null;
    AI_STROKES.forEach((st, i) => {
      const sp = clamp(p * n - i);
      if (sp <= 0) return;
      const a = T(st[0]), b = T(st[1]);
      const h = mix(a, b, easeInOut(sp));
      const pts = K.resample([a, h], 6);
      if (pts.length < 2) return;
      const dD = K.ribbonD(pts, o.w || 16, { seed: 3000 + i, taperIn: 6, taperOut: 6 });
      d.add('<path d="' + dD + '" fill="' + R.pal.gold + '" opacity="0.85" filter="url(#blur8)"/>');
      d.add('<path d="' + dD + '" fill="#fff4d6"/>');
      if (sp < 1) head = h;
    });
    if (head) { halo(d, head, 70, 'gold', 0.9); sparkle(d, head, 22 + 6 * Math.sin(t * 20), '#fff8e6'); }
    return head;
  }

  // ------------------------------------------------------ Reels frames
  // 9:16 short-video frame with an animated meme doodle (kind 0..8).
  function reelsFrame(d, c, w, h, kind, t, p, o = {}) {
    if (p <= 0) return;
    const e = easeOutBack(clamp(p));
    d.open('transform="translate(' + f1(c[0]) + ' ' + f1(c[1]) + ') scale(' + e.toFixed(3) + ') translate(' + f1(-c[0]) + ' ' + f1(-c[1]) + ')" opacity="' + clamp(p * 2).toFixed(3) + '"');
    const x = c[0] - w / 2, y = c[1] - h / 2;
    shape(d, rrect(x, y, w, h, 14), { p: 1, w: 2.6, seed: 3100 + kind, fill: R.pal.fillNear, color: o.hot ? R.pal.gold : R.pal.line });
    stroke(d, [[c[0] - 16, y + 12], [c[0] + 16, y + 12]], { w: 2.4, seed: 3110 + kind, brush: false });
    // side actions: heart, comment, share
    const ax = x + w - 18;
    heart(d, [ax, y + h * 0.56], 7, R.pal.line, 1, 3120 + kind);
    shape(d, ellipse([ax, y + h * 0.68], 8, 6, 0, 10), { w: 1.6, seed: 3130 + kind, fill: 'none' });
    stroke(d, [[ax - 7, y + h * 0.8], [ax + 7, y + h * 0.77], [ax + 1, y + h * 0.83]], { w: 1.6, seed: 3140 + kind, brush: false });
    // caption + progress bar
    stroke(d, [[x + 12, y + h - 30], [x + w * 0.55, y + h - 30]], { w: 1.6, seed: 3150 + kind, brush: false, color: R.pal.soft });
    stroke(d, [[x + 10, y + h - 12], [x + w - 10, y + h - 12]], { w: 1.4, seed: 3160 + kind, brush: false, color: R.pal.faint });
    stroke(d, [[x + 10, y + h - 12], [x + 10 + (w - 20) * ((t * 0.4 + kind * 0.13) % 1), y + h - 12]], { w: 2.4, seed: 3170 + kind, brush: false, color: R.pal.gold, amp: 0 });
    if (o.ai) { shape(d, rrect(x + 8, y + 22, 34, 20, 5), { w: 1.4, seed: 3180 + kind, fill: R.pal.gold, color: R.pal.gold }); text(d, 'AI', x + 25, y + 37, { font: "'Cormorant Garamond', serif", weight: 600, size: 17, color: R.pal.fillNear }); }
    meme(d, [c[0] - 6, c[1] - 6], Math.min(w, h) * 0.36, kind, t);
    d.close();
  }

  function heart(d, c, r, col, op = 1, seed = 3200, fill = 'none') {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * TAU;
      const hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      pts.push([c[0] + hx * r / 16, c[1] + hy * r / 16]);
    }
    shape(d, pts, { w: 1.8, seed, fill, color: col, opacity: op, amp: 0.4 });
  }

  function meme(d, c, s, kind, t) {
    const b = Math.abs(Math.sin(t * 5 + kind)) * s * 0.12;
    const L = R.pal.line, Gd = R.pal.gold;
    if (kind === 0) {                       // winking smiley, bouncing
      const cc = add(c, [0, -b]);
      shape(d, ellipse(cc, s * 0.62, s * 0.62, 0, 24), { w: 2.4, seed: 3300, fill: R.pal.fillMid });
      const wink = Math.sin(t * 3) > 0.6;
      dot(d, add(cc, [-s * 0.22, -s * 0.12]), s * 0.07, L);
      if (wink) stroke(d, [add(cc, [s * 0.12, -s * 0.12]), add(cc, [s * 0.32, -s * 0.14])], { w: 2.4, seed: 3301, brush: false });
      else dot(d, add(cc, [s * 0.22, -s * 0.12]), s * 0.07, L);
      stroke(d, K.arc(add(cc, [0, 0.02 * s]), s * 0.34, 20 * DEG, 160 * DEG, 10), { w: 2.4, seed: 3302 });
    } else if (kind === 1) {                // cat in sunglasses
      const tilt = Math.sin(t * 2.4) * 10;
      d.open('transform="rotate(' + f1(tilt) + ' ' + f1(c[0]) + ' ' + f1(c[1]) + ')"');
      shape(d, [add(c, [-s * 0.5, -s * 0.2]), add(c, [-s * 0.42, -s * 0.72]), add(c, [-s * 0.12, -s * 0.42]), add(c, [s * 0.12, -s * 0.42]), add(c, [s * 0.42, -s * 0.72]), add(c, [s * 0.5, -s * 0.2]), add(c, [s * 0.45, s * 0.35]), add(c, [0, s * 0.55]), add(c, [-s * 0.45, s * 0.35])], { w: 2.4, seed: 3310, fill: R.pal.fillMid });
      shape(d, ellipse(add(c, [-s * 0.2, -s * 0.05]), s * 0.17, s * 0.11, 0, 12), { w: 2, seed: 3311, fill: R.pal.dark });
      shape(d, ellipse(add(c, [s * 0.2, -s * 0.05]), s * 0.17, s * 0.11, 0, 12), { w: 2, seed: 3312, fill: R.pal.dark });
      stroke(d, [add(c, [-s * 0.04, -s * 0.06]), add(c, [s * 0.04, -s * 0.06])], { w: 2, seed: 3313, brush: false });
      for (const sgn of [-1, 1]) stroke(d, [add(c, [sgn * s * 0.2, s * 0.22]), add(c, [sgn * s * 0.62, s * 0.16])], { w: 1.4, seed: 3314 + sgn, brush: false, color: R.pal.soft });
      d.close();
    } else if (kind === 2) {                // dancing stick figure
      const ph = t * 6;
      const hip = add(c, [0, s * 0.2 - b * 0.5]), neck = add(hip, [Math.sin(ph) * s * 0.08, -s * 0.5]);
      shape(d, ellipse(add(neck, [0, -s * 0.16]), s * 0.15, s * 0.15, 0, 14), { w: 2.2, seed: 3320, fill: R.pal.fillMid });
      stroke(d, [neck, hip], { w: 2.6, seed: 3321 });
      for (const sgn of [-1, 1]) {
        stroke(d, [neck, add(neck, [sgn * s * 0.28, -s * 0.12 * Math.sin(ph + sgn)]), add(neck, [sgn * s * 0.42, -s * 0.36 * (0.5 + 0.5 * Math.sin(ph * 1.3 + sgn))])], { w: 2.2, seed: 3322 + sgn });
        stroke(d, [hip, add(hip, [sgn * s * 0.2, s * 0.3]), add(hip, [sgn * s * 0.26 + Math.sin(ph + sgn) * s * 0.08, s * 0.58])], { w: 2.2, seed: 3325 + sgn });
      }
      for (let k = 0; k < 3; k++) { const a = t * 3 + k * 2.1; sparkle(d, add(c, [Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.5 - s * 0.2]), 6, Gd, 0.8); }
    } else if (kind === 3) {                // pulsing heart with little hearts rising
      const sc = 1 + 0.15 * Math.abs(Math.sin(t * 4));
      heart(d, add(c, [0, s * 0.08]), s * 0.6 * sc, Gd, 1, 3330, R.pal.fillMid);
      for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; heart(d, add(c, [(k - 1) * s * 0.4, s * 0.3 - ph * s * 1.0]), s * 0.14, L, 1 - ph, 3331 + k); }
    } else if (kind === 4) {                // 哈哈 jumping
      ['哈', '哈'].forEach((ch, i) => text(d, ch, c[0] + (i - 0.5) * s * 0.62, c[1] + s * 0.2 - Math.abs(Math.sin(t * 6 + i * 1.5)) * s * 0.25, { size: s * 0.62, weight: 700, color: i ? Gd : L }));
      for (let k = 0; k < 3; k++) stroke(d, [add(c, [-s * 0.7, -s * 0.4 + k * s * 0.3]), add(c, [-s * 0.55, -s * 0.42 + k * s * 0.3])], { w: 1.8, seed: 3340 + k, brush: false, color: R.pal.soft });
    } else if (kind === 5) {                // play button with music notes
      shape(d, ellipse(c, s * 0.5, s * 0.5, 0, 22), { w: 2.4, seed: 3350, fill: R.pal.fillMid });
      shape(d, [add(c, [-s * 0.16, -s * 0.24]), add(c, [s * 0.28, 0]), add(c, [-s * 0.16, s * 0.24])], { w: 2, seed: 3351, fill: Gd, color: Gd });
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.6 + k * 0.5) % 1, nc = add(c, [s * (0.45 + k * 0.2), -s * 0.3 - ph * s * 0.6]);
        dot(d, nc, s * 0.08, L, 1 - ph);
        stroke(d, [add(nc, [s * 0.07, 0]), add(nc, [s * 0.07, -s * 0.26]), add(nc, [s * 0.2, -s * 0.2])], { w: 1.8, seed: 3352 + k, brush: false, opacity: 1 - ph });
      }
    } else if (kind === 6) {                // 讚 badge with a burst
      const sc = 1 + 0.1 * Math.sin(t * 5);
      shape(d, ellipse(c, s * 0.55 * sc, s * 0.55 * sc, 0, 22), { w: 2.4, seed: 3360, fill: R.pal.fillMid, color: Gd });
      text(d, '讚', c[0], c[1] + s * 0.22, { size: s * 0.62, weight: 700, color: Gd });
      FX.burst(d, c, s * 0.95, (t * 0.8) % 1, { seed: 3361, n: 10, w: 2.4, flash: false });
    } else if (kind === 7) {                // little dragon swimming across
      const ph = t * 3;
      const pts = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(add(c, [lerp(s * 0.55, -s * 0.6, u), Math.sin(ph - u * 5) * s * 0.18])); }
      stroke(d, pts, { w: 5, seed: 3370, color: Gd, taperIn: 2, taperOut: 10 });
      shape(d, ellipse(pts[0], s * 0.13, s * 0.1, 0, 12), { w: 1.8, seed: 3371, fill: R.pal.fillMid, color: Gd });
      dot(d, add(pts[0], [s * 0.04, -s * 0.03]), 2.4, L);
      stroke(d, [add(pts[0], [-s * 0.02, -s * 0.1]), add(pts[0], [-s * 0.12, -s * 0.24])], { w: 1.6, seed: 3372, brush: false, color: Gd });
    } else {                                // 爆 explosion
      const sc = 1 + 0.18 * Math.abs(Math.sin(t * 5));
      const star = [];
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, rr = (i % 2 ? 0.42 : 0.72) * s * sc; star.push(add(c, [Math.cos(a) * rr, Math.sin(a) * rr])); }
      shape(d, star, { w: 2.4, seed: 3380, fill: R.pal.fillMid, color: Gd });
      text(d, '爆', c[0], c[1] + s * 0.2, { size: s * 0.55, weight: 700, color: L });
    }
  }

  // ------------------------------------------------ four skill badges
  function skillBadge(d, c, r, kind, label, p, t, o = {}) {
    if (p <= 0) return;
    const e = easeOutBack(clamp(p));
    halo(d, c, r * 1.8, 'gold', 0.35 * clamp(p) * (o.glow === undefined ? 1 : o.glow));
    shape(d, ellipse(c, r * e, r * e, 0, 28), { p: 1, w: 3, seed: 3400 + kind.length, fill: R.pal.fillNear, color: R.pal.gold });
    const s = r * 0.55 * e;
    if (kind === 'interview') PR.mic(d, add(c, [0, s * 0.1]), s * 1.25, { seed: 3410 });
    else if (kind === 'edit') {
      shape(d, rectPts(c[0] - s * 0.7, c[1] - s * 0.2, s * 1.4, s * 0.9), { w: 2.2, seed: 3420, fill: R.pal.fillMid });
      shape(d, [add(c, [-s * 0.7, -s * 0.24]), add(c, [s * 0.7, -s * 0.62]), add(c, [s * 0.76, -s * 0.38]), add(c, [-s * 0.64, 0.0 - s * 0.0])], { w: 2.2, seed: 3421, fill: R.pal.fill });
      for (let k = 0; k < 3; k++) stroke(d, [add(c, [-s * 0.4 + k * s * 0.42, -s * 0.34 - k * s * 0.11]), add(c, [-s * 0.2 + k * s * 0.42, -s * 0.1 - k * s * 0.12])], { w: 2.4, seed: 3422 + k, brush: false });
    } else if (kind === 'ai') {
      shape(d, rrect(c[0] - s * 0.62, c[1] - s * 0.62, s * 1.24, s * 1.24, 6), { w: 2.4, seed: 3430, fill: R.pal.fillMid });
      for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
        const u = (k - 1) * s * 0.36;
        stroke(d, [add(c, [u, sd * s * 0.62]), add(c, [u, sd * s * 0.86])], { w: 2, seed: 3431 + k + sd, brush: false });
        stroke(d, [add(c, [sd * s * 0.62, u]), add(c, [sd * s * 0.86, u])], { w: 2, seed: 3437 + k + sd, brush: false });
      }
      text(d, 'AI', c[0], c[1] + s * 0.24, { font: "'Cormorant Garamond', serif", weight: 600, size: s * 0.8, color: R.pal.gold });
      sparkle(d, add(c, [s * 0.9, -s * 0.9]), s * 0.3 * (0.8 + 0.2 * Math.sin(t * 8)), R.pal.gold);
    } else {
      shape(d, spline([add(c, [-s * 0.8, -s * 0.5]), add(c, [s * 0.8, -s * 0.5]), add(c, [s * 0.8, s * 0.4]), add(c, [-s * 0.2, s * 0.4]), add(c, [-s * 0.5, s * 0.8]), add(c, [-s * 0.45, s * 0.4]), add(c, [-s * 0.8, s * 0.4])], 2, true), { w: 2.2, seed: 3440, fill: R.pal.fillMid });
      heart(d, add(c, [0, -s * 0.05]), s * 0.38 * (1 + 0.12 * Math.sin(t * 6)), R.pal.gold, 1, 3441, R.pal.gold);
    }
    if (label) text(d, label, c[0], c[1] + r + 40, { size: o.labelSize || 34, weight: 700, color: R.pal.line, opacity: clamp(p * 1.5), spacing: 2 });
  }

  // ---------------------------------------------------------- light orb
  function lightOrb(d, c, r, t, p, o = {}) {
    if (p <= 0) return;
    const pr = r * easeOutBack(clamp(p));
    halo(d, c, pr * 3.2, 'gold', 0.55 * clamp(p));
    halo(d, c, pr * 1.8, 'line', 0.7 * clamp(p));
    for (let k = 0; k < 2; k++) {
      const ang = t * (k ? -70 : 90) + k * 60;
      const pts = ellipse(c, pr * 1.35, pr * 0.42, ang * DEG, 36);
      stroke(d, pts.concat([pts[0]]), { w: 2.6, color: R.pal.gold, seed: 3500 + k, brush: false, opacity: clamp(p) });
    }
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + t * 0.6;
      const r0 = pr * 1.1, r1 = pr * (1.45 + 0.25 * Math.sin(t * 7 + i * 1.3));
      stroke(d, [add(c, K.polar(a, r0)), add(c, K.polar(a, r1))], { w: 2.2, color: R.pal.gold, seed: 3510 + i, opacity: 0.8 * clamp(p) });
    }
    shape(d, ellipse(c, pr, pr, 0, 30), { w: 3, seed: 3530, fill: '#fff4d6', color: R.pal.gold });
    halo(d, c, pr * 0.8, 'line', 0.9 * clamp(p));
    if (o.labels) o.labels.forEach((lb, i) => {
      const a = t * 1.6 + i / o.labels.length * TAU;
      text(d, lb, c[0] + Math.cos(a) * pr * 0.55, c[1] + Math.sin(a) * pr * 0.32 + 8, { size: pr * 0.2, weight: 700, color: R.pal.gold, opacity: clamp(p) * 0.9 });
    });
  }

  // ---------------------------------------------------- recruitment banner
  function recruitBanner(d, c, p, t, o = {}) {
    if (p <= 0) return;
    const w = o.w || 980, h = o.h || 210;
    const fp = smooth(clamp(p / 0.35));
    const x = c[0] - w / 2, y = c[1] - h / 2;
    halo(d, c, w * 0.55, 'gold', 0.25 * fp);
    shape(d, rrect(x, y, w, h, 24), { p: fp, w: 3.2, seed: 3600, fill: R.pal.fillNear, fillOpacity: 0.9, color: R.pal.gold });
    shape(d, rrect(x + 14, y + 14, w - 28, h - 28, 14), { p: fp, w: 1.6, seed: 3601, fill: 'none', color: R.pal.gold });
    const l1 = inv(0.25, 0.65, p), l2 = inv(0.55, 0.95, p);
    if (l1 > 0) FX.revealText(d, o.line1 || '個人申請／志願填報', c[0], c[1] - 18, l1, { size: 60, color: R.pal.gold, glow: 0.4, spacing: 0.06 });
    if (l2 > 0) FX.revealText(d, o.line2 || '熱烈招募中', c[0], c[1] + 70, l2, { size: 70, color: '#fff3e2', glow: 0.5, spacing: 0.16 });
    if (p >= 1) for (let k = 0; k < 6; k++) {
      const ph = (t * 0.8 + k / 6) % 1;
      sparkle(d, [x + w * rnd(3610, k), y + h * (0.15 + 0.7 * rnd(3611, k))], 10 * Math.sin(ph * Math.PI), R.pal.gold, Math.sin(ph * Math.PI));
    }
  }

  // closed thread-bound manual (線裝書) with a vertical title slip
  function manual(d, c, w, h, ang, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const T = (x, y) => add(c, rot([x * w, y * h], ang * DEG));
    if (o.glow) halo(d, c, Math.max(w, h) * 1.4, 'gold', o.glow);
    shape(d, [T(-0.47, -0.47), T(0.53, -0.47), T(0.53, 0.53), T(-0.47, 0.53)], { p, w: 2, seed: 3700, fill: R.pal.fillMid });
    shape(d, [T(-0.5, -0.5), T(0.5, -0.5), T(0.5, 0.5), T(-0.5, 0.5)], { p, w: 2.8, seed: 3701, fill: R.pal.fillNear, color: o.color || R.pal.line });
    for (let k = 0; k < 4; k++) {
      const y = -0.38 + k * 0.25;
      stroke(d, [T(-0.5, y), T(-0.36, y)], { p, w: 1.6, seed: 3702 + k, color: R.pal.gold, brush: false });
    }
    stroke(d, [T(-0.36, -0.5), T(-0.36, 0.5)], { p, w: 1.4, seed: 3707, color: R.pal.soft, brush: false });
    shape(d, [T(0.12, -0.4), T(0.36, -0.4), T(0.36, 0.3), T(0.12, 0.3)], { p, w: 1.6, seed: 3708, fill: R.pal.fill, color: R.pal.gold });
    const chars = Array.from(o.title || '武功秘笈');
    const fs = h * 0.15;
    chars.forEach((ch, i) => {
      const q = T(0.24, -0.4 + (i + 0.82) * 0.7 / chars.length);
      text(d, ch, q[0], q[1] + fs * 0.1, { size: fs, weight: 700, color: R.pal.gold, opacity: clamp((p - 0.4) / 0.6), transform: 'rotate(' + f1(ang) + ' ' + f1(q[0]) + ' ' + f1(q[1]) + ')' });
    });
  }

  G.PROMO = { manual, rrect, dot, sq, sparkle, heart, shewo, titleCard, paperStack, oldCamera, shatter, pixels, digitalWave, monitor, layerCards, aiTrail, reelsFrame, meme, skillBadge, lightOrb, recruitBanner };
})(typeof window !== 'undefined' ? window : globalThis);
