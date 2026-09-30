/* Landscape components: mountains, clouds, water, waves, trees, birds,
 * smoke, falling leaves, mist. Each draws its own occluding fill first. */
(function (G) {
  'use strict';
  const K = G.K;
  const { R, lerp, clamp, smooth, noise1, fbm, rnd, rrange, stroke, shape, add, sub, mul, rot, norm, perp,
    arc, ellipse, spline, resample, cutPts, dist, TAU, DEG, prog, halo, easeOut, inv, mix } = K;

  // ----------------------------------------------------------- mountains
  // peaks: [{x, h, w}] ; base: y of the bottom edge
  function ridgeAt(o, x) {
    let hmax = 0;
    for (const pk of o.peaks) {
      const u = (x - pk.x) / pk.w;
      if (Math.abs(u) < 1) hmax = Math.max(hmax, pk.h * Math.pow(1 - u * u, pk.sharp || 1.4));
    }
    return o.base - (o.floor || 0) - hmax + fbm(x / (o.rough || 90), o.seed || 1) * (o.roughAmp || 10) * (0.4 + hmax / 400);
  }
  function ridgePoints(o) {
    const pts = [];
    const x0 = o.x0 === undefined ? -300 : o.x0, x1 = o.x1 === undefined ? 2220 : o.x1;
    for (let x = x0; x <= x1; x += 10) pts.push([x, ridgeAt(o, x)]);
    return pts;
  }
  function mountains(d, o) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const ridge = ridgePoints(o);
    const bottom = o.bottom || 1300;
    const poly = ridge.concat([[ridge[ridge.length - 1][0], bottom], [ridge[0][0], bottom]]);
    // fill (no outline on the sides/bottom)
    shape(d, poly, { p: 1, fillP: smooth((p - 0.12) / 0.5), fill: o.fill || R.pal.fillFar, noStroke: true, amp: 0, seed: o.seed });
    stroke(d, ridge, { p: p, w: o.w || 3, color: o.color || R.pal.line, seed: (o.seed || 1) * 7, step: 6, opacity: o.opacity });
    // texture strokes (cun): short strokes falling down the slopes
    const n = o.texture === undefined ? 14 : o.texture;
    for (let i = 0; i < n; i++) {
      const u = rnd(o.seed || 1, i * 3 + 1);
      const idx = Math.floor(u * (ridge.length - 3)) + 1;
      const tp = clamp((p - u * 0.6) / 0.4);
      if (tp <= 0) continue;
      const a = ridge[idx - 1], b = ridge[idx + 1], top = ridge[idx];
      const slope = (b[1] - a[1]) / (b[0] - a[0]);
      const depth = o.base - top[1];
      if (depth < 60) continue;
      const lenS = rrange(o.seed || 1, i * 3 + 2, 0.18, 0.45) * depth;
      const sx = slope > 0 ? 1 : -1;
      const start = [top[0], top[1] + 14 + rnd(o.seed || 1, i) * 20];
      const pts = [start, [start[0] + sx * lenS * 0.25, start[1] + lenS * 0.45], [start[0] + sx * lenS * 0.35 + 8, start[1] + lenS]];
      stroke(d, K.spline(pts, 6), { p: tp, w: (o.w || 3) * 0.6, color: o.texColor || R.pal.soft, seed: 500 + i + (o.seed || 1) * 13 });
    }
  }

  // ---------------------------------------------------------------- mist
  function mist(d, o, t) {
    const y = o.y, x0 = o.x0 || -300, x1 = o.x1 || 2220, amp = o.amp || 10, op = o.opacity === undefined ? 1 : o.opacity;
    const drift = (o.speed || 12) * t;
    const top = [];
    for (let x = x0; x <= x1; x += 24) top.push([x, y + Math.sin((x + drift) / (o.wave || 140)) * amp + noise1((x + drift) / 200, o.seed || 3) * amp]);
    const poly = top.concat([[x1, y + (o.h || 60)], [x0, y + (o.h || 60)]]);
    shape(d, poly, { p: 1, fill: o.fill || R.pal.fillFar, noStroke: true, amp: 0 });
    // a few broken flowing lines
    for (let k = 0; k < (o.lines || 3); k++) {
      const yy = y + 12 + k * 14;
      const segs = [];
      for (let x = x0; x <= x1; x += 20) segs.push([x, yy + Math.sin((x - drift * (1 + k * 0.3)) / (o.wave || 140) + k) * amp * 0.6]);
      const a = ((k * 373 + drift * (0.7 + 0.2 * k)) % 900) + x0;
      for (let s = 0; s < 3; s++) {
        const xs = a + s * 900 - 900;
        const part = segs.filter((q) => q[0] > xs && q[0] < xs + 260 + k * 60);
        if (part.length > 2) stroke(d, part, { w: 2, color: R.pal.soft, seed: 900 + k * 7 + s, opacity: op * (o.lineOpacity || 1) });
      }
    }
  }

  // -------------------------------------------------------------- clouds
  // Chinese auspicious cloud: a row of lobes with spiral curls and a tail.
  function cloud(d, cx, cy, s, o = {}) {
    const seed = o.seed || 1, p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const nl = o.lobes || (3 + Math.floor(rnd(seed, 1) * 2));
    const lobes = [];
    let x = -nl * 0.5 * 52;
    for (let i = 0; i < nl; i++) {
      const r = (i === Math.floor(nl / 2) ? 46 : rrange(seed, i + 3, 28, 40));
      lobes.push({ x: x + r, y: -r * 0.55 - (i === Math.floor(nl / 2) ? 10 : 0), r });
      x += r * 1.45;
    }
    // outline around lobes (top arcs) and a flat-ish bottom
    const pts = [];
    for (const L of lobes) {
      for (let a = 200; a <= 340; a += 12) pts.push([L.x + Math.cos(a * DEG) * L.r, L.y + Math.sin(a * DEG) * L.r]);
    }
    const last = lobes[lobes.length - 1], first = lobes[0];
    pts.push([last.x + last.r * 0.9, 6], [last.x + last.r * 0.2, 16]);
    pts.push([first.x - first.r * 0.1, 16], [first.x - first.r * 0.95, 4]);
    const T = (q) => [cx + q[0] * s, cy + q[1] * s];
    const outline = pts.map(T);
    shape(d, outline, { p, fill: o.fill || R.pal.fill, w: (o.w || 3), seed: seed * 11, color: o.color, start: 0.9 });
    // spiral curls inside two lobes
    const cp = clamp((p - 0.35) / 0.65);
    for (let k = 0; k < 2; k++) {
      const L = lobes[(k * 2 + (seed % 2)) % nl];
      const sp = [];
      for (let a = 0; a <= 1; a += 0.04) {
        const ang = (200 + a * 300) * DEG, r = L.r * (0.7 - a * 0.55);
        sp.push(T([L.x + Math.cos(ang) * r, L.y + 4 + Math.sin(ang) * r]));
      }
      stroke(d, sp, { p: cp, w: (o.w || 3) * 0.8, seed: seed * 17 + k, color: o.color });
    }
    // tail
    if (o.tail !== false) {
      const dir = o.tailDir || -1;
      const tx = dir < 0 ? first.x - first.r * 0.95 : last.x + last.r * 0.9;
      const tail = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        tail.push(T([tx + dir * u * 120, 4 + Math.sin(u * Math.PI * 1.5) * 10 - u * 6]));
      }
      const end = tail[tail.length - 1];
      for (let a = 0; a <= 1; a += 0.1) {
        const ang = (dir < 0 ? 0 : 180) * DEG + a * 260 * DEG * -dir;
        tail.push([end[0] + Math.cos(ang) * 10 * s * (1 - a * 0.5) + dir * 10 * s, end[1] + Math.sin(ang) * 10 * s * (1 - a * 0.5)]);
      }
      stroke(d, tail, { p: clamp((p - 0.2) / 0.8), w: (o.w || 3) * 0.8, seed: seed * 19, color: o.color });
    }
  }

  // --------------------------------------------------------------- water
  // Flowing river: short wave strokes that travel with the current.
  function river(d, o, t) {
    const { x0, x1, y0, y1 } = o;
    const flow = (o.speed || 40) * t;
    const rows = o.rows || 8;
    const p = o.p === undefined ? 1 : o.p;
    shape(d, [[x0 - 40, y0], [x1 + 40, y0], [x1 + 40, y1], [x0 - 40, y1]], { p: 1, fill: o.fill || R.pal.fillNear, noStroke: true, amp: 0 });
    for (let r = 0; r < rows; r++) {
      const u = r / (rows - 1);
      const y = lerp(y0 + 10, y1 - 8, Math.pow(u, 1.25));
      const segLen = lerp(70, 180, u), gapL = lerp(90, 170, u);
      const period = segLen + gapL;
      const off = (flow * lerp(0.6, 1.3, u) + rnd(o.seed || 5, r) * period) % period;
      for (let x = x0 - period + off; x < x1; x += period) {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const xx = x + segLen * k / 10;
          pts.push([xx, y + Math.sin(xx / 38 + t * 2 + r) * lerp(1.5, 4, u)]);
        }
        const rp = clamp((p - rnd(o.seed || 5, r * 31 + Math.floor((x + 5000) / period)) * 0.5) / 0.5);
        stroke(d, pts, { p: rp, w: lerp(1.6, 3, u), color: u < 0.3 ? R.pal.soft : R.pal.line, seed: r * 50 + Math.floor((x + 9000) / period) });
      }
    }
  }

  // Big curling sea wave (Hokusai-like). Travels right. phase 0..1 grows the
  // curl; s = size in px (height).
  function bigWave(d, x, y, s, o = {}) {
    const ph = clamp(o.phase === undefined ? 1 : o.phase);
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const hk = lerp(0.55, 1, smooth(ph));
    const T = (q) => [x + q[0] * s, y + q[1] * s * hk];
    const sweep = lerp(120, 290, smooth(ph));
    const C = [0.5, -0.62], r0 = 0.36;
    const back = [[-1.6, 0.06], [-1.0, -0.05], [-0.55, -0.26], [-0.18, -0.58], [0.15, -0.86], [0.45, -0.98]];
    const curl = [];
    for (let a = 0; a <= 1.0001; a += 0.05) {
      const ang = (-95 + a * sweep) * DEG, r = r0 * (1 - 0.7 * a);
      curl.push([C[0] + Math.cos(ang) * r, C[1] + Math.sin(ang) * r]);
    }
    const lipEnd = curl[curl.length - 1];
    const front = [[0.84, -0.42], [0.86, -0.2], [0.98, 0.06]];
    const body = back.concat(curl.slice(0, Math.max(3, Math.floor(curl.length * 0.45)))).concat(front);
    const bodyPts = K.spline(body, 5).map(T).concat([T([1.1, 0.4]), T([-1.7, 0.4])]);
    shape(d, bodyPts, { p: 1, fillP: smooth(p / 0.3), fill: o.fill || R.pal.fillNear, noStroke: true, amp: 0 });
    const outer = K.spline(back.concat(curl), 5).map(T);
    stroke(d, outer, { p, w: o.w || 4, seed: o.seed || 3 });
    stroke(d, K.spline(front, 6).map(T), { p: clamp((p - 0.4) / 0.6), w: (o.w || 4) * 0.8, seed: (o.seed || 3) + 1 });
    // inner flow lines parallel to the surface
    for (let k = 1; k <= 3; k++) {
      const off = k * 0.085;
      const inner = back.slice(1).map((q, i) => [q[0] + off * 0.9, q[1] + off * (1.1 - i * 0.05)]);
      const ic = [];
      for (let a = 0; a <= 0.8; a += 0.08) {
        const ang = (-95 + a * sweep * 0.8) * DEG, r = (r0 - off * 0.8) * (1 - 0.6 * a);
        if (r > 0.04) ic.push([C[0] + Math.cos(ang) * r, C[1] + Math.sin(ang) * r]);
      }
      stroke(d, K.spline(inner.concat(ic), 5).map(T), { p: clamp((p - 0.15 * k) / 0.7), w: (o.w || 4) * 0.55, color: R.pal.soft, seed: (o.seed || 3) * 7 + k });
    }
    // foam claws along the lip
    const nClaw = 7;
    for (let i = 0; i < nClaw; i++) {
      const u = 0.35 + 0.6 * i / (nClaw - 1);
      if (u > sweep / 290) continue;
      const idx = Math.min(curl.length - 1, Math.floor(u * (curl.length - 1)));
      const q = curl[idx];
      const outward = K.norm(K.sub(q, C));
      const tip = [q[0] + outward[0] * 0.13 + 0.03, q[1] + outward[1] * 0.13 + 0.04];
      const mid = [q[0] + outward[0] * 0.08 + 0.05 * Math.sin(i), q[1] + outward[1] * 0.06];
      const cp = clamp((p - 0.5) / 0.5) * smooth((ph - 0.3) / 0.5);
      stroke(d, K.spline([q, mid, tip], 5).map(T), { p: cp, w: (o.w || 4) * 0.6, seed: (o.seed || 3) * 13 + i });
    }
    return { lip: T(lipEnd), crest: T([0.45, -0.98]) };
  }

  // Sea surface lines (horizontal swells) scrolling toward +x
  function sea(d, o, t) {
    const { x0, x1, y0, y1 } = o;
    shape(d, [[x0 - 40, y0], [x1 + 40, y0], [x1 + 40, y1 + 200], [x0 - 40, y1 + 200]], { p: 1, fill: o.fill || R.pal.fillMid, noStroke: true, amp: 0 });
    const rows = o.rows || 9;
    for (let r = 0; r < rows; r++) {
      const u = r / (rows - 1), y = lerp(y0 + 8, y1, Math.pow(u, 1.3));
      const pts = [];
      for (let x = x0 - 60; x <= x1 + 60; x += 18) {
        const ph = (x - t * (o.speed || 60) * lerp(0.5, 1.2, u)) / lerp(60, 150, u);
        pts.push([x, y + Math.sin(ph + r * 1.3) * lerp(2, 9, u) + Math.sin(ph * 0.37 + r) * lerp(1, 6, u)]);
      }
      // break the row into dashes
      const segs = [];
      let cur = [];
      pts.forEach((q, i) => {
        const on = noise1(i * 0.22 + r * 7.1 - t * 0.4 * (o.speed || 60) / 60, 77 + r) > -0.35;
        if (on) cur.push(q); else { if (cur.length > 2) segs.push(cur); cur = []; }
      });
      if (cur.length > 2) segs.push(cur);
      segs.forEach((sg, k) => stroke(d, sg, { p: o.p === undefined ? 1 : o.p, w: lerp(1.5, 3.2, u), color: u < 0.25 ? R.pal.soft : R.pal.line, seed: 300 + r * 17 + k }));
    }
  }

  // spray droplets burst: particles flying from c
  function spray(d, c, t0, t, o = {}) {
    const age = t - t0;
    if (age < 0 || age > (o.life || 1.2)) return;
    const n = o.n || 18;
    for (let i = 0; i < n; i++) {
      const a = (o.a0 === undefined ? -160 : o.a0) + rnd(o.seed || 9, i) * (o.spread || 140);
      const sp = rrange(o.seed || 9, i + 50, 0.5, 1) * (o.speed || 420);
      const vx = Math.cos(a * DEG) * sp, vy = Math.sin(a * DEG) * sp;
      const px = c[0] + vx * age, py = c[1] + vy * age + 0.5 * 900 * age * age;
      const r = rrange(o.seed || 9, i + 99, 2, 6) * (1 - age / (o.life || 1.2));
      if (r <= 0.3) continue;
      d.add('<circle cx="' + K.f1(px) + '" cy="' + K.f1(py) + '" r="' + K.f1(r) + '" fill="' + (o.color || R.pal.line) + '"/>');
    }
  }

  // ---------------------------------------------------------------- trees
  function pine(d, x, y, s, o = {}, t = 0) {
    const p = o.p === undefined ? 1 : o.p, seed = o.seed || 4;
    if (p <= 0) return;
    const sway = Math.sin(t * 1.3 + seed) * (o.sway === undefined ? 1.5 : o.sway);
    const T = (q) => [x + q[0] * s + sway * (-q[1] / 200) * s, y + q[1] * s];
    const lean = rrange(seed, 1, -18, 18);
    const trunk = [[0, 0], [lean * 0.3, -60], [lean * 0.8 - 10, -130], [lean + 6, -200], [lean - 4, -250]];
    const tl = trunk.map((q, i) => [q[0] - 9 + i * 1.3, q[1]]), tr = trunk.map((q, i) => [q[0] + 9 - i * 1.3, q[1]]);
    const tp = clamp(p / 0.4);
    shape(d, K.spline(tl, 5).concat(K.spline(tr, 5).reverse()).map(T), { p: tp, noStroke: true, amp: 0 });
    stroke(d, K.spline(tl, 5).map(T), { p: tp, w: 3, seed: seed * 3 });
    stroke(d, K.spline(tr, 5).map(T), { p: tp, w: 3, seed: seed * 3 + 1 });
    // bark marks
    for (let i = 0; i < 4; i++) {
      const q = trunk[1 + (i % 3)];
      stroke(d, [T([q[0] - 5, q[1] + i * 9]), T([q[0] + 3, q[1] + i * 9 - 4])], { p: clamp((p - 0.3) / 0.3), w: 1.8, seed: seed * 5 + i, color: R.pal.soft });
    }
    // needle clusters (flattened fans), drawn back to front
    const clusters = o.clusters || [[-70, -150, 70], [60, -190, 64], [-30, -225, 58], [20, -265, 48], [-95, -110, 46], [85, -125, 44]];
    clusters.forEach((c, i) => {
      const cp = clamp((p - 0.25 - i * 0.07) / 0.35);
      if (cp <= 0) return;
      const cc = [c[0] + lean * 0.6, c[1]];
      const w = c[2] * rrange(seed, i + 40, 0.85, 1.15), hgt = w * rrange(seed, i + 50, 0.3, 0.42);
      const tilt = rrange(seed, i + 60, -0.12, 0.12);
      const bump = [];
      for (let a = 0; a <= 1.0001; a += 0.0625) {
        const lobe = 1 + 0.12 * Math.sin(a * Math.PI * 5 + i) ;
        bump.push([cc[0] - w + a * 2 * w, cc[1] - Math.sin(a * Math.PI) * hgt * lobe + (a - 0.5) * tilt * w - noise1(a * 6, seed + i) * 3]);
      }
      const bottom = [[cc[0] + w * 0.92, cc[1] + 5 + tilt * w * 0.5], [cc[0] + w * 0.3, cc[1] + 9], [cc[0] - w * 0.4, cc[1] + 8], [cc[0] - w * 0.92, cc[1] + 4 - tilt * w * 0.5]];
      shape(d, bump.concat(bottom).map(T), { p: cp, w: 2.6, seed: seed * 11 + i, fill: o.fill || R.pal.fill });
      const hub = [cc[0], cc[1] + 6];
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI + (k + 0.5) / 7 * Math.PI;
        const tip = [hub[0] + Math.cos(ang) * w * 0.8, hub[1] + Math.sin(ang) * hgt * 0.85];
        stroke(d, [T(K.mix(hub, tip, 0.25)), T(tip)], { p: cp, w: 1.5, color: R.pal.soft, seed: seed * 13 + i * 7 + k });
      }
      // branch into the trunk
      stroke(d, [T([lean * 0.5, c[1] + 16]), T([cc[0] * 0.55, cc[1] + 12]), T(hub)], { p: cp, w: 2.6, seed: seed * 17 + i });
    });
  }

  function bamboo(d, x, y, h, o = {}, t = 0) {
    const p = o.p === undefined ? 1 : o.p, seed = o.seed || 6;
    if (p <= 0) return;
    const bend = Math.sin(t * 0.9 + seed) * (o.sway || 10) + (o.lean || 0);
    const wid = o.wid || 12;
    const n = 14;
    const spine = [];
    for (let i = 0; i <= n; i++) { const u = i / n; spine.push([x + bend * u * u, y - h * u]); }
    const L = spine.map((q) => [q[0] - wid / 2, q[1]]), Rr = spine.map((q) => [q[0] + wid / 2, q[1]]);
    shape(d, L.concat(Rr.slice().reverse()), { p: 1, fillP: smooth(p / 0.2), noStroke: true, amp: 0, fill: o.fill || R.pal.fill });
    stroke(d, L, { p, w: 2.4, seed: seed * 3 });
    stroke(d, Rr, { p, w: 2.4, seed: seed * 3 + 1 });
    const nodes = 5 + (seed % 3);
    for (let k = 1; k < nodes; k++) {
      const u = k / nodes;
      if (u > p) break;
      const c = K.pointAt(spine, u);
      stroke(d, [[c[0] - wid * 0.6, c[1] + 2], [c[0] + wid * 0.6, c[1] - 2]], { w: 2.2, seed: seed * 7 + k, brush: false });
      if (k % 2 === 1 && u > 0.35) {
        // leaf cluster
        const side = k % 4 === 1 ? 1 : -1;
        for (let j = 0; j < 3; j++) {
          const ang = (side > 0 ? -20 : 200) + (j - 1) * 22 + Math.sin(t * 1.8 + j + k) * 6;
          const l = 70 + j * 12;
          const tip = add(c, K.polar(ang * DEG, l));
          const mid = add(c, K.polar((ang + 8 * side) * DEG, l * 0.5));
          stroke(d, [c, mid, tip], { p: clamp((p - u) / 0.2), w: 7, seed: seed * 31 + k * 3 + j, taperIn: 20, taperOut: 40 });
        }
      }
    }
  }

  function rock(d, x, y, s, o = {}) {
    const seed = o.seed || 8, p = o.p === undefined ? 1 : o.p;
    const n = 9, pts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI + i / (n - 1) * Math.PI;
      const r = rrange(seed, i, 0.75, 1.05);
      pts.push([x + Math.cos(a) * s * (o.wide || 1.4) * r, y + Math.sin(a) * s * r * (o.tall || 0.9)]);
    }
    pts.push([x + s * (o.wide || 1.4), y + 4], [x - s * (o.wide || 1.4), y + 4]);
    shape(d, pts, { p, w: o.w || 3, seed: seed * 3, fill: o.fill });
    for (let i = 0; i < 3; i++) {
      const a = [x + rrange(seed, i + 20, -0.8, 0.5) * s, y - rrange(seed, i + 30, 0.3, 0.8) * s];
      stroke(d, [a, [a[0] + s * 0.3, a[1] + s * 0.25], [a[0] + s * 0.35, a[1] + s * 0.5]], { p: clamp((p - 0.5) / 0.5), w: 1.8, color: R.pal.soft, seed: seed * 7 + i });
    }
  }

  function grass(d, x, y, s, o = {}, t = 0) {
    const n = o.n || 5, seed = o.seed || 2;
    for (let i = 0; i < n; i++) {
      const ang = -90 + (i - (n - 1) / 2) * 16 + Math.sin(t * 2 + seed + i) * 5;
      const l = s * rrange(seed, i, 0.6, 1);
      const tip = [x + Math.cos(ang * DEG) * l, y + Math.sin(ang * DEG) * l];
      const mid = [x + Math.cos((ang + 6) * DEG) * l * 0.5, y + Math.sin((ang + 6) * DEG) * l * 0.5];
      stroke(d, [[x + (i - n / 2) * 2, y], mid, tip], { p: o.p, w: 3, seed: seed * 11 + i, taperIn: 2, taperOut: 20 });
    }
  }

  // --------------------------------------------------------------- birds
  function bird(d, x, y, s, t, o = {}) {
    const flap = Math.sin(t * (o.rate || 9) + (o.seed || 0));
    const wing = (dir) => {
      const tip = [x + dir * 22 * s, y - 10 * s * flap];
      const mid = [x + dir * 10 * s, y - 4 * s - 5 * s * flap];
      return [[x, y], mid, tip];
    };
    stroke(d, wing(1), { w: 2.4 * s, seed: (o.seed || 0) * 3 + 1, p: o.p, color: o.color });
    stroke(d, wing(-1), { w: 2.4 * s, seed: (o.seed || 0) * 3 + 2, p: o.p, color: o.color });
  }

  // Shared bird wing: leaf-shaped with a scalloped trailing edge and primary
  // feathers. S = shoulder, tipOff = vector shoulder->tip (its length shrinks
  // mid-flap, which reads as foreshortening), chord = wing depth (px).
  function birdWing(d, S, tipOff, chord, o = {}) {
    const L = Math.hypot(tipOff[0], tipOff[1]);
    if (L < 6) return;
    const u = [tipOff[0] / L, tipOff[1] / L];
    let v = perp(u);
    if (v[0] * (o.dirX || 1) > 0) v = [-v[0], -v[1]];
    const P = (a, b) => add(S, add(mul(u, a * L), mul(v, b * chord)));
    const lead = [P(0, 0), P(0.28, -0.12), P(0.58, -0.1), P(0.86, 0.0), P(1.0, 0.1)];
    const trail = [];
    const n = o.scallops || 7;
    for (let i = 0; i <= n; i++) {
      const a = lerp(0.97, 0.02, i / n);
      const base = 0.35 + 0.62 * Math.sin(Math.PI * Math.min(1, (1 - a) * 1.15)) ;
      trail.push(P(a, base + (i % 2 ? 0.07 : 0)));
    }
    shape(d, spline(lead.concat(trail), 3, true), { w: o.w || 2.4, seed: o.seed || 700, fill: o.fill || R.pal.fill, p: o.p, color: o.color });
    for (let k = 0; k < (o.fingers || 4); k++) {
      const b0 = P(0.8 + k * 0.045, 0.14 + k * 0.1);
      const tip = add(b0, add(mul(u, (0.2 - k * 0.03) * L), mul(v, (0.12 + k * 0.1) * chord)));
      stroke(d, [b0, tip], { w: (o.w || 2.4) * 0.8, seed: (o.seed || 700) + 10 + k, p: o.p, color: o.color, taperOut: 8 });
    }
    stroke(d, [P(0.08, 0.42), P(0.45, 0.5), P(0.78, 0.38)], { w: (o.w || 2.4) * 0.55, seed: (o.seed || 700) + 20, p: o.p, color: R.pal.soft });
  }

  // crane in flight, heading +x (dir)
  function crane(d, x, y, s, t, o = {}) {
    const dir = o.dir || 1, lift = Math.sin(t * (o.rate || 3.0) + (o.phase || 0));
    const T = (q) => [x + q[0] * s * dir, y + q[1] * s];
    const p = o.p;
    const L = 125 * s;
    birdWing(d, T([12, -12]), [-0.32 * L * dir, -L * (lift * 0.85 - 0.05)], 36 * s, { dirX: dir, seed: 781, p, fill: R.pal.fillMid, w: 2.2 });
    // legs trailing
    stroke(d, [T([-30, 5]), T([-104, 14])], { w: 2, seed: 75, p, brush: false });
    stroke(d, [T([-30, 9]), T([-100, 21])], { w: 2, seed: 76, p, brush: false });
    // body
    shape(d, spline([[40, -6], [20, -13], [-18, -12], [-42, -4], [-54, 4], [-40, 9], [-4, 11], [28, 6]].map(T), 3, true), { w: 2.6, seed: 71, p });
    stroke(d, [T([-40, -2]), T([-58, 2]), T([-48, 8])], { w: 2, seed: 77, p, color: R.pal.soft });
    // neck + head
    stroke(d, spline([[34, -4], [58, -12], [82, -10], [100, -8]], 5).map(T), { w: 3.2, seed: 72, p });
    shape(d, K.ellipse([103, -8], 7.5, 6, 0, 12).map(T), { w: 2, seed: 73, p });
    stroke(d, [T([110, -8]), T([134, -4])], { w: 2.4, seed: 74, p, color: R.pal.gold });
    d.add('<circle cx="' + K.f1(T([101, -13])[0]) + '" cy="' + K.f1(T([101, -13])[1]) + '" r="' + K.f1(3 * s) + '" fill="' + R.pal.gold + '"/>');
    birdWing(d, T([4, -6]), [-0.36 * L * dir, -L * lift], 42 * s, { dirX: dir, seed: 782, p, w: 2.4 });
  }

  // ---------------------------------------------------------- sun / moon
  function sun(d, c, r, o = {}, t = 0) {
    halo(d, c, r * 3.2, o.haloColor || 'gold', (o.glow === undefined ? 0.55 : o.glow));
    shape(d, ellipse(c, r, r, 0, 40), { p: o.p, fill: o.fill || R.pal.fill, w: o.w || 3.5, color: o.color || R.pal.gold, seed: 61 });
    if (o.rays) {
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + t * 0.05;
        const r0 = r * 1.25, r1 = r * (1.45 + 0.08 * Math.sin(t * 2 + i));
        stroke(d, [add(c, K.polar(a, r0)), add(c, K.polar(a, r1))], { p: o.p, w: 2.4, color: o.color || R.pal.gold, seed: 62 + i });
      }
    }
  }

  // --------------------------------------------------------------- smoke
  function smoke(d, x, y, t, o = {}) {
    const n = o.n || 4, life = o.life || 3.5, rise = o.rise || 45;
    for (let i = 0; i < n; i++) {
      const age = ((t + i * life / n) % life);
      const u = age / life;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const v = k / 12;
        const yy = y - (age * rise) - v * 60 * (0.6 + u);
        const xx = x + Math.sin(v * 5 + t * 1.6 + i) * (6 + v * 16) * (0.5 + u) + (o.wind || 8) * age;
        pts.push([xx, yy]);
      }
      stroke(d, pts, { w: (o.w || 2.4) * (1 - u * 0.5), color: o.color || R.pal.soft, opacity: Math.sin(u * Math.PI) * (o.opacity || 0.9), seed: 400 + i + Math.floor((t + i * life / n) / life) * 13 });
    }
  }

  // ------------------------------------------------------- falling leaves
  function leaves(d, t, o = {}) {
    const n = o.n || 12, seed = o.seed || 21;
    const area = o.area || [0, 1920, -80, 1150];
    for (let i = 0; i < n; i++) {
      const period = rrange(seed, i, 6, 10);
      const ph = (t / period + rnd(seed, i + 30)) % 1;
      const x0 = lerp(area[0], area[1], rnd(seed, i + 60));
      const x = x0 + ph * (o.drift || 260) + Math.sin(ph * 12 + i) * 30;
      const y = lerp(area[2], area[3], ph);
      const ang = ph * 720 * (rnd(seed, i + 90) > 0.5 ? 1 : -1) + i * 40;
      const sc = rrange(seed, i + 120, 0.6, 1.1) * (o.scale || 1);
      const q = ellipse([0, 0], 11 * sc, 4.5 * sc, 0, 10).map((pp) => add([x, y], rot(pp, ang * DEG)));
      shape(d, q, { w: 1.8, seed: seed * 7 + i, fill: o.fill || R.pal.fill, color: o.color || R.pal.line, amp: 0.4 });
      stroke(d, [add([x, y], rot([-11 * sc, 0], ang * DEG)), add([x, y], rot([11 * sc, 0], ang * DEG))], { w: 1.2, seed: seed * 9 + i, brush: false, color: o.color || R.pal.line, amp: 0.3 });
    }
  }

  // petals / sparks drifting upward (used for gold motes)
  function motes(d, t, o = {}) {
    const n = o.n || 16, seed = o.seed || 33;
    const area = o.area || [0, 1920, 0, 1080];
    for (let i = 0; i < n; i++) {
      const period = rrange(seed, i, 5, 9);
      const ph = (t / period + rnd(seed, i + 30)) % 1;
      const x = lerp(area[0], area[1], rnd(seed, i + 60)) + Math.sin(ph * 8 + i) * 24;
      const y = lerp(area[3], area[2], ph);
      const r = rrange(seed, i + 7, 1.5, 3.5) * Math.sin(ph * Math.PI);
      if (r > 0.2) d.add('<circle cx="' + K.f1(x) + '" cy="' + K.f1(y) + '" r="' + K.f1(r) + '" fill="' + (o.color || R.pal.gold) + '" opacity="' + (0.4 + 0.6 * Math.sin(ph * Math.PI)).toFixed(2) + '"/>');
    }
  }

  G.N = { birdWing, ridgeAt, ridgePoints, mountains, mist, cloud, river, bigWave, sea, spray, pine, bamboo, rock, grass, bird, crane, sun, smoke, leaves, motes };
})(typeof window !== 'undefined' ? window : globalThis);
