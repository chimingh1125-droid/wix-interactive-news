/* Effects: brush-wipe transitions, sword-light arcs, bursts, sparks, dust,
 * qi swirls, speed lines, calligraphy text reveal, ink wash blobs. */
(function (G) {
  'use strict';
  const K = G.K;
  const { R, lerp, clamp, smooth, easeOut, easeIn, easeInOut, rnd, rrange, noise1, stroke, shape, add, sub, mul, rot, norm,
    perp, ellipse, arc, TAU, DEG, f1, halo, text, ribbonD, cutPts, resample, inv, esc } = K;

  // Mask revealing the incoming scene with big diagonal brush strokes.
  function brushWipeMask(d, p, seed) {
    const id = d.id('wipe');
    let s = '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="-40" y="-40" width="2000" height="1160">' +
      '<rect x="-40" y="-40" width="2000" height="1160" fill="#000"/>';
    const bands = 4, stag = 0.3;
    for (let i = 0; i < bands; i++) {
      const bp = easeInOut(clamp((p * (1 + stag * (bands - 1)) - i * stag)));
      if (bp <= 0) continue;
      const yc = -40 + (i + 0.5) * 1160 / bands;
      const pts = [];
      for (let x = -420; x <= 2340; x += 40) {
        pts.push([x, yc + (x - 960) * -0.12 + noise1(x / 300 + i * 3, seed + i) * 40]);
      }
      const cut = cutPts(resample(pts, 12), bp);
      if (cut.length < 2) continue;
      s += '<path d="' + ribbonD(cut, 1160 / bands * 1.75, { fullLen: 2760, seed: seed + i * 7, taperIn: 260, taperOut: 0 }) + '" fill="#fff"/>';
      // dry-brush bristle streaks at the leading edge
      for (let k = 0; k < 6; k++) {
        const off = (k - 2.5) / 6 * 1160 / bands * 1.4;
        const tail = cut.slice(Math.max(0, cut.length - 30 - k * 4));
        const streak = tail.map((q) => [q[0], q[1] + off]);
        if (streak.length > 2) s += '<path d="' + ribbonD(streak.concat([[streak[streak.length - 1][0] + 60 + k * 12, streak[streak.length - 1][1] + off * 0.1]]), 18 + k * 3, { seed: seed + i * 13 + k, taperIn: 30, taperOut: 80 }) + '" fill="#fff"/>';
      }
    }
    if (p > 0.82) s += '<rect x="-40" y="-40" width="2000" height="1160" fill="#fff" opacity="' + smooth((p - 0.82) / 0.18).toFixed(3) + '"/>';
    s += '</mask></defs>';
    d.add(s);
    return id;
  }

  // Crescent of sword light sweeping from angle a0 to a1 (degrees) around c.
  function slashArc(d, c, r, a0, a1, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const head = lerp(a0, a1, easeOut(clamp(p / 0.55)));
    const tail = lerp(a0, a1, easeIn(clamp((p - 0.2) / 0.8)));
    if (Math.abs(head - tail) < 1) return;
    const n = 28, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(tail, head, i / n) * DEG;
      const rr = r * (o.squash ? lerp(1, o.squash, Math.abs(Math.sin(a))) : 1);
      pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * (o.ry || 1)]);
    }
    const w = (o.w || r * 0.12) * (1 - clamp((p - 0.6) / 0.4) * 0.6);
    const dD = ribbonD(pts, w, { seed: o.seed || 1, taperIn: K.polyLen(pts) * 0.85, taperOut: 8 });
    const col = o.color || R.pal.gold;
    const op = 1 - smooth((p - 0.65) / 0.35);
    d.add('<path d="' + dD + '" fill="' + col + '" opacity="' + (0.8 * op).toFixed(3) + '" filter="url(#blur8)"/>');
    d.add('<path d="' + dD + '" fill="' + (o.core || '#fff8e6') + '" opacity="' + op.toFixed(3) + '"/>');
  }

  // straight light streak (thrust / arrow trail)
  function streak(d, a, b, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const hp = easeOut(clamp(p / 0.5)), tp = easeIn(clamp((p - 0.25) / 0.75));
    const h = K.mix(a, b, hp), t0 = K.mix(a, b, tp);
    const pts = resample([t0, h], 10);
    if (pts.length < 2) return;
    const op = 1 - smooth((p - 0.6) / 0.4);
    const dD = ribbonD(pts, o.w || 10, { seed: o.seed || 3, taperIn: K.dist(t0, h) * 0.9, taperOut: 4 });
    d.add('<path d="' + dD + '" fill="' + (o.color || R.pal.gold) + '" opacity="' + (0.85 * op).toFixed(3) + '" filter="url(#blur8)"/>');
    d.add('<path d="' + dD + '" fill="' + (o.core || '#fff8e6') + '" opacity="' + op.toFixed(3) + '"/>');
  }

  function burst(d, c, r, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const n = o.n || 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n + rnd(o.seed || 5, i) * 0.04) * TAU;
      const r0 = r * lerp(0.15, 0.75, easeOut(p)) * rrange(o.seed || 5, i + 20, 0.8, 1.1);
      const r1 = r * lerp(0.35, 1.05, easeOut(p)) * rrange(o.seed || 5, i + 40, 0.8, 1.15);
      stroke(d, [add(c, K.polar(a, r0)), add(c, K.polar(a, r1))], { w: (o.w || 4) * (1 - p * 0.7), color: o.color || R.pal.gold, opacity: 1 - smooth((p - 0.5) / 0.5), seed: (o.seed || 5) * 50 + i });
    }
    if (o.flash !== false) halo(d, c, r * 1.2 * (0.6 + p), 'gold', (1 - p) * 0.9);
  }

  function ring(d, c, r, p, o = {}) {
    if (p <= 0 || p >= 1) return;
    const rr = r * easeOut(p);
    stroke(d, ellipse(c, rr, rr * (o.ry || 1), 0, 48).concat([add(c, [rr, 0])]), { w: (o.w || 4) * (1 - p), color: o.color || R.pal.line, opacity: 1 - p, seed: o.seed || 7, brush: false });
  }

  function sparks(d, c, t0, t, o = {}) {
    const age = t - t0, life = o.life || 0.9;
    if (age < 0 || age > life) return;
    const n = o.n || 16;
    for (let i = 0; i < n; i++) {
      const a = ((o.a0 === undefined ? 0 : o.a0) + rnd(o.seed || 11, i) * (o.spread === undefined ? 360 : o.spread)) * DEG;
      const sp = rrange(o.seed || 11, i + 30, 0.4, 1) * (o.speed || 700);
      const g = o.gravity === undefined ? 900 : o.gravity;
      const pos = (tt) => [c[0] + Math.cos(a) * sp * tt, c[1] + Math.sin(a) * sp * tt + 0.5 * g * tt * tt];
      const a1 = pos(age), a0 = pos(Math.max(0, age - 0.05));
      stroke(d, [a0, a1], { w: 2.4 * (1 - age / life) + 0.5, color: o.color || R.pal.gold, seed: (o.seed || 11) * 40 + i, brush: false, amp: 0 });
    }
  }

  // dust / debris puffs
  function dust(d, c, t0, t, o = {}) {
    const age = t - t0, life = o.life || 1.6;
    if (age < 0 || age > life) return;
    const u = age / life, n = o.n || 7;
    for (let i = 0; i < n; i++) {
      const a = ((o.a0 === undefined ? 180 : o.a0) + (i / (n - 1) - 0.5) * (o.spread || 160)) * DEG;
      const dd = easeOut(u) * (o.dist || 160) * rrange(o.seed || 13, i, 0.6, 1.1);
      const cc = [c[0] + Math.cos(a) * dd, c[1] + Math.sin(a) * dd * 0.45 - u * 30];
      const r = lerp(10, o.size || 40, easeOut(u)) * rrange(o.seed || 13, i + 9, 0.7, 1.2);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const ang = k / 16 * TAU * 0.85 + i;
        const rr = r * (1 - k / 16 * 0.6);
        pts.push([cc[0] + Math.cos(ang) * rr, cc[1] + Math.sin(ang) * rr * 0.8]);
      }
      stroke(d, pts, { w: 2.4, color: o.color || R.pal.soft, opacity: 1 - u, seed: (o.seed || 13) * 30 + i });
    }
  }

  // swirling energy lines gathering around c
  function qiSwirl(d, c, r, t, o = {}) {
    const n = o.n || 5, p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    for (let i = 0; i < n; i++) {
      const a0 = t * (o.speed || 3) * (i % 2 ? -1 : 1) + i * TAU / n;
      const pts = [];
      for (let k = 0; k <= 14; k++) {
        const u = k / 14, a = a0 + u * 2.2;
        const rr = r * (0.55 + 0.45 * Math.sin(u * Math.PI)) * (1 - 0.3 * i / n);
        pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * (o.ry || 0.75)]);
      }
      stroke(d, pts, { w: 2.6, color: o.color || R.pal.gold, opacity: p * (0.5 + 0.5 * Math.sin(t * 6 + i)), seed: 1200 + i });
    }
  }

  function speedLines(d, area, dir, t, o = {}) {
    const n = o.n || 14, [x0, y0, x1, y1] = area;
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, rnd(o.seed || 17, i));
      const L = rrange(o.seed || 17, i + 20, 80, 240);
      const span = x1 - x0 + L;
      const x = x0 - L + ((t * (o.speed || 1600) * rrange(o.seed || 17, i + 40, 0.7, 1.3) + rnd(o.seed || 17, i + 60) * span) % span);
      const a = [x, y], b = [x + L * dir, y];
      stroke(d, dir > 0 ? [a, b] : [b, a], { w: o.w || 2.2, color: o.color || R.pal.soft, opacity: o.opacity === undefined ? 0.8 : o.opacity, seed: (o.seed || 17) * 9 + i, brush: false });
    }
  }

  // Irregular wash blob (darker paper tone) behind titles.
  function washBlob(d, c, rx, ry, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const n = 40, pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const k = 1 + 0.18 * noise1(i * 0.45, o.seed || 19) + 0.08 * noise1(i * 1.7, (o.seed || 19) + 1);
      pts.push([c[0] + Math.cos(a) * rx * k * lerp(0.6, 1, easeOut(p)), c[1] + Math.sin(a) * ry * k * lerp(0.6, 1, easeOut(p))]);
    }
    shape(d, pts, { fill: o.color || R.pal.shade, fillOpacity: (o.opacity === undefined ? 0.6 : o.opacity) * easeOut(p), noStroke: true, fillP: 1, amp: 2 });
  }

  // Calligraphy reveal: each character is wiped in from top to bottom.
  // o: {size, color, weight, spacing, vertical, stagger, glow, font}
  function revealText(d, str, x, y, p, o = {}) {
    const chars = Array.from(str);
    const size = o.size || 80, adv = size * (1 + (o.spacing === undefined ? 0.08 : o.spacing));
    const n = chars.length;
    const total = o.vertical ? adv * n : adv * n - (adv - size);
    const anchor = o.anchor || 'middle';
    const sx = o.vertical ? x : (anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x);
    const sy = o.vertical ? (anchor === 'middle' ? y - total / 2 : y) : y;
    const stag = o.stagger === undefined ? 0.6 : o.stagger;
    const fam = o.font || "'LXGW WenKai TC', 'Noto Serif CJK TC', serif";
    chars.forEach((ch, i) => {
      if (ch === ' ') return;
      const span = 1 / (n - (n - 1) * stag);
      const cp = clamp((p - i * span * (1 - stag)) / span);
      if (cp <= 0) return;
      const cx = o.vertical ? sx : sx + i * adv + size / 2;
      const cy = o.vertical ? sy + i * adv + size * 0.5 : sy;
      const top = cy - size * 0.95, h = size * 1.3;
      const id = d.id('rv');
      const wipe = easeInOut(cp);
      d.add('<defs><clipPath id="' + id + '"><rect x="' + f1(cx - size * 0.7) + '" y="' + f1(top) + '" width="' + f1(size * 1.4) + '" height="' + f1(h * wipe) + '"/></clipPath></defs>');
      const ty = o.vertical ? cy + size * 0.36 : cy;
      if (o.glow) d.add('<text x="' + f1(cx) + '" y="' + f1(ty) + '" font-family="' + fam + '" font-size="' + size + '" font-weight="' + (o.weight || 700) + '" fill="' + (o.glowColor || R.pal.gold) + '" text-anchor="middle" clip-path="url(#' + id + ')" filter="url(#blur8)" opacity="' + (o.glow * (1 - 0.5 * cp)).toFixed(3) + '">' + esc(ch) + '</text>');
      d.add('<text x="' + f1(cx) + '" y="' + f1(ty) + '" font-family="' + fam + '" font-size="' + size + '" font-weight="' + (o.weight || 700) + '" fill="' + (o.color || R.pal.line) + '" text-anchor="middle" clip-path="url(#' + id + ')"' + (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.strokeW || 6) + '" paint-order="stroke"' : '') + '>' + esc(ch) + '</text>');
      // brush tip following the wipe edge
      if (cp < 1 && o.tip !== false) halo(d, [cx, top + h * wipe], size * 0.25, 'gold', 0.5 * (1 - cp));
    });
  }

  // vertical label with a seal, used for the "form" title cards (第一式…)
  function formLabel(d, x, y, p, o) {
    if (p <= 0) return;
    const op = smooth(p / 0.3) * (o.out === undefined ? 1 : o.out);
    d.open('opacity="' + op.toFixed(3) + '"');
    revealText(d, o.num, x, y, clamp(p / 0.5), { size: o.size1 || 44, vertical: true, anchor: 'start', color: R.pal.gold, spacing: 0.05 });
    revealText(d, o.name, x - (o.size2 || 92) * 1.05, y, clamp((p - 0.2) / 0.6), { size: o.size2 || 92, vertical: true, anchor: 'start', spacing: 0.02, glow: 0.45 });
    if (o.skill) G.PROPS.seal(d, [x - (o.size2 || 92) * 0.55, y + Array.from(o.name).length * (o.size2 || 92) * 1.02 + 70], 76, o.skill, { p: clamp((p - 0.55) / 0.3), fill: R.pal.line, ink: R.pal.bg, seed: 1300 });
    d.close();
  }

  G.FX = { brushWipeMask, slashArc, streak, burst, ring, sparks, dust, qiSwirl, speedLines, washBlob, revealText, formLabel };
})(typeof window !== 'undefined' ? window : globalThis);
