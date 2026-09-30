/* Props: department emblem, corner bug, secret manual, scroll, newspaper,
 * lead type, phone, camera, brush, seal, weapons. */
(function (G) {
  'use strict';
  const K = G.K;
  const { R, lerp, clamp, smooth, prog, rnd, rrange, stroke, shape, add, sub, mul, rot, norm, perp, ellipse, arc,
    rectPts, TAU, DEG, f1, halo, text, noise1, easeOut, inv, transformPts, spline, pointAt } = K;

  // ------------------------------------------------------------- emblem
  // The SHU Journalism department logo, traced from the official artwork
  // (assets/logo/trace_logo.py -> lib/logo_data.js): a journalist whose head
  // is a disc and whose body is a writing brush curling round the globe, an
  // orbit band carrying "SHU", and the 世新 / 新聞 calligraphy.
  // It draws itself: the outlines are traced first, then the white shapes
  // flood in and the calligraphy is brushed on character by character.
  // c: centre of the logo, r: px per logo unit (1 unit = half the mark width;
  // the whole logo is about 2r x 2r). o: {p, color, text, glow, seed}
  const logoLoop = (lp, o0, r) => lp.map((q) => [o0[0] + q[0] * r, o0[1] + q[1] * r]);
  function logoD(loops, o0, r) {
    // keep roughly one point per screen pixel
    const k = Math.max(1, Math.floor(0.9 / (0.0032 * r)));
    let s = '';
    for (const lp of loops) {
      s += 'M' + f1(o0[0] + lp[0][0] * r) + ' ' + f1(o0[1] + lp[0][1] * r);
      for (let i = k; i < lp.length; i += k) s += 'L' + f1(o0[0] + lp[i][0] * r) + ' ' + f1(o0[1] + lp[i][1] * r);
      s += 'Z';
    }
    return s;
  }
  function logoBox(loops, o0, r) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const lp of loops) for (const q of lp) {
      x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
    }
    return [o0[0] + x0 * r, o0[1] + y0 * r, o0[0] + x1 * r, o0[1] + y1 * r];
  }

  function emblem(d, c, r, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const L = G.LOGO;
    const col = o.color || R.pal.line;
    const seed = o.seed || 500;
    const b = L.bounds;
    const o0 = [c[0] - (b[0] + b[2]) / 2 * r, c[1] - (b[1] + b[3]) / 2 * r];
    const body = L.mark.concat(L.head);
    if (o.glow) halo(d, [c[0] + 0.1 * r, c[1] + 0.1 * r], r * 1.25, 'gold', o.glow);
    // 1. outlines trace themselves, then give way to the solid shapes
    const lineP = clamp(p / 0.55), fillP = smooth(inv(0.35, 0.75, p));
    if (fillP < 1) {
      const lw = Math.max(1.1, r * 0.01);
      body.forEach((lp, i) => {
        const pts = logoLoop(lp, o0, r);
        pts.push(pts[0]);
        stroke(d, pts, { p: lineP, w: lw, color: col, brush: false, amp: Math.min(1.2, r * 0.006), step: 2.5, seed: seed + i, opacity: 1 - fillP });
      });
    }
    if (fillP > 0) d.add('<path d="' + logoD(body, o0, r) + '" fill="' + col + '" fill-rule="evenodd"' + (fillP < 1 ? ' fill-opacity="' + fillP.toFixed(3) + '"' : '') + '/>');
    // 2. calligraphy: 世 新 (right column), then 新 聞, each wiped in top-down
    if (o.text !== false) {
      L.text.forEach((ch, i) => {
        const cp = clamp((p - 0.5 - i * 0.1) / 0.22);
        if (cp <= 0) return;
        const bx = logoBox(ch.loops, o0, r);
        const dD = logoD(ch.loops, o0, r);
        if (cp >= 1) { d.add('<path d="' + dD + '" fill="' + col + '" fill-rule="evenodd"/>'); return; }
        const id = d.id('lg');
        const wipe = easeOut(cp), h = (bx[3] - bx[1] + 4) * wipe;
        d.add('<defs><clipPath id="' + id + '"><rect x="' + f1(bx[0] - 2) + '" y="' + f1(bx[1] - 2) + '" width="' + f1(bx[2] - bx[0] + 4) + '" height="' + f1(h) + '"/></clipPath></defs>');
        d.add('<path d="' + dD + '" fill="' + col + '" fill-rule="evenodd" clip-path="url(#' + id + ')"/>');
        halo(d, [(bx[0] + bx[2]) / 2, bx[1] - 2 + h], (bx[2] - bx[0]) * 0.45, 'gold', 0.5 * (1 - cp));
      });
    }
  }

  // department wordmark under/beside the emblem
  function wordmark(d, x, y, o = {}) {
    const op = o.opacity === undefined ? 1 : o.opacity;
    if (op <= 0) return;
    text(d, o.zh || '世新大學新聞學系', x, y, { size: o.size || 44, weight: 700, color: o.color || R.pal.line, anchor: o.anchor || 'middle', spacing: (o.size || 44) * 0.12, opacity: op });
    text(d, o.en || 'Department of Journalism · Shih Hsin University', x, y + (o.size || 44) * 0.95, { font: "'Cormorant Garamond', serif", italic: true, weight: 500, size: (o.size || 44) * 0.55, color: o.color || R.pal.line, anchor: o.anchor || 'middle', opacity: op * 0.9 });
  }

  // Top-left corner bug shown in every narrative scene.
  function cornerBug(d, t, act) {
    const isCard = (s) => s.kind === 'title' || s.kind === 'endcard';
    const top = act[act.length - 1];
    let vis;
    if (act.length > 1) {
      // cross-fade the bug with the brush wipe between two scenes
      const a = isCard(act[0]) ? 0 : 1, b = isCard(top) ? 0 : 1;
      vis = lerp(a, b, smooth((t - top.start) / (top.tin || 0.8)));
    } else {
      vis = isCard(top) ? 0 : 1;
    }
    if (vis <= 0.001) return;
    const col = R.pal.name === 'night' ? R.pal.gold : R.pal.line;
    d.open('opacity="' + (0.92 * vis).toFixed(3) + '"');
    emblem(d, [88, 84], 68, { color: col, seed: 540 });
    d.close();
  }

  // ------------------------------------------------------------- book
  // Thread-bound secret manual seen from above, with page flips.
  // o: {open (0..1 cover opening), flip (float: number of pages flipped),
  //     title, pageText: fn(pageIndex) -> [lines], blankLast}
  function book(d, c, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const op = clamp(o.open === undefined ? 0 : o.open);
    const hw = w / 2;
    const left = [c[0] - hw, c[1] - h / 2];
    // closed: single cover of width hw on the right half; open: two pages.
    const pageFill = o.pageFill || R.pal.fill;
    // right page (always visible under cover)
    const rp = rectPts(c[0], c[1] - h / 2, hw, h);
    shape(d, rp, { p, w: 3, seed: 601, fill: pageFill });
    // left page appears as the cover swings open
    if (op > 0) {
      const lw = hw * op;
      shape(d, rectPts(c[0] - lw, c[1] - h / 2, lw, h), { p, w: 3, seed: 602, fill: pageFill });
    }
    // page content (lines of text) on the right page
    const flips = o.flip || 0;
    const pageIdx = Math.floor(flips);
    if (o.pageText && op > 0.9) {
      const lines = o.pageText(pageIdx) || [];
      lines.forEach((ln, i) => {
        text(d, ln.t, c[0] + hw * (ln.x || 0.5), c[1] - h / 2 + h * (ln.y || (0.2 + i * 0.12)), { size: ln.size || h * 0.07, color: ln.color || R.pal.line, weight: ln.weight || 400, opacity: (ln.op === undefined ? 1 : ln.op) * smooth((op - 0.9) / 0.1), font: ln.font });
      });
      const ll = o.pageText(pageIdx - 1, 'left') || [];
      ll.forEach((ln, i) => {
        text(d, ln.t, c[0] - hw * (1 - (ln.x || 0.5)), c[1] - h / 2 + h * (ln.y || (0.2 + i * 0.12)), { size: ln.size || h * 0.07, color: ln.color || R.pal.line, weight: ln.weight || 400, opacity: (ln.op === undefined ? 1 : ln.op), font: ln.font });
      });
    }
    // binding stitches on the spine side (left edge of the left page when open)
    const spineX = op > 0 ? c[0] - hw * op + 14 : c[0] + 14;
    for (let i = 0; i < 4; i++) {
      const y = c[1] - h / 2 + h * (0.15 + i * 0.233);
      stroke(d, [[spineX - 14, y], [spineX + 4, y]], { p: clamp((p - 0.3) / 0.7), w: 2, seed: 610 + i, brush: false });
    }
    stroke(d, [[spineX + 4, c[1] - h / 2 + 6], [spineX + 4, c[1] + h / 2 - 6]], { p, w: 1.6, seed: 615, brush: false, color: R.pal.soft });
    // turning page (flip in progress): a sheet rotating around the spine x=c[0]
    const fr = flips - pageIdx;
    if (op >= 1 && fr > 0.001 && fr < 0.999 && o.flip !== undefined) {
      const ang = fr * Math.PI; // 0: lying on right, PI: on left
      const x1 = c[0] + Math.cos(ang) * hw;
      const lift = Math.sin(ang) * h * 0.06;
      const pts = [[c[0], c[1] - h / 2], [x1, c[1] - h / 2 - lift], [x1, c[1] + h / 2 - lift * 0.4], [c[0], c[1] + h / 2]];
      shape(d, pts, { w: 2.6, seed: 620 + pageIdx, fill: R.pal.fillMid, amp: 0.8 });
    }
    // cover (closing flap) — rotates from right side over to the left
    if (op < 1) {
      const ang = op * Math.PI;
      const x1 = c[0] + Math.cos(ang) * hw;
      const pts = [[c[0], c[1] - h / 2], [x1, c[1] - h / 2 - Math.sin(ang) * 18], [x1, c[1] + h / 2 - Math.sin(ang) * 8], [c[0], c[1] + h / 2]];
      shape(d, pts, { p, w: 3.4, seed: 630, fill: R.pal.fillNear });
      if (op < 0.5 && o.title) {
        // title label on the cover (vertical)
        const lx = lerp(c[0] + hw * 0.62, c[0], op * 2);
        const lw = hw * 0.26 * (1 - op * 2);
        if (lw > 2) {
          shape(d, rectPts(lx - lw / 2, c[1] - h * 0.38, lw, h * 0.6), { p: clamp((p - 0.3) / 0.7), w: 2, seed: 631, fill: R.pal.fill });
          const chars = Array.from(o.title);
          chars.forEach((ch, i) => text(d, ch, lx, c[1] - h * 0.38 + h * 0.6 * (i + 0.8) / chars.length, { size: Math.min(lw * 0.8, h * 0.6 / chars.length * 0.82), weight: 700, opacity: clamp((p - 0.5) / 0.5) * (1 - op * 2) }));
        }
      }
    }
  }

  // ------------------------------------------------------------- scroll
  // Hanging scroll unrolling downward; text columns revealed as it opens.
  function scroll(d, x, y, w, h, p, o = {}) {
    if (p <= 0) return;
    const open = smooth(p);
    const cur = h * open;
    shape(d, rectPts(x - w / 2, y, w, Math.max(4, cur)), { w: 2.8, seed: 650, fill: o.fill || R.pal.fillMid, fillP: 1 });
    stroke(d, [[x - w / 2 - 18, y], [x + w / 2 + 18, y]], { w: 9, seed: 651 });
    // bottom roller follows
    stroke(d, [[x - w / 2 - 22, y + cur], [x + w / 2 + 22, y + cur]], { w: 12, seed: 652 });
    if (o.draw) o.draw(d, cur);
  }

  // --------------------------------------------------------- newspaper
  // sheet centred at c, w x h, rotation ang; bend 0..1 flaps it like wings
  function newspaper(d, c, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const ang = (o.ang || 0) * DEG, bend = o.bend || 0;
    const T = (q) => add(c, rot([q[0], q[1] + Math.abs(q[0]) / (w / 2) * bend * h * 0.35], ang));
    const outline = [[-w / 2, -h / 2], [0, -h / 2 - bend * h * 0.1], [w / 2, -h / 2], [w / 2, h / 2], [0, h / 2 - bend * h * 0.1], [-w / 2, h / 2]].map(T);
    shape(d, outline, { p, w: o.lw || 2.4, seed: o.seed || 700, fill: o.fill || R.pal.fill });
    const dp = clamp((p - 0.3) / 0.7);
    if (dp <= 0) return;
    // masthead
    if (o.title && w > 60) {
      const mc = T([0, -h * 0.32]);
      const fs = Math.min(h * 0.16, w * 0.22);
      text(d, o.title, mc[0], mc[1] + fs * 0.35, { size: fs, weight: 700, opacity: dp, transform: 'rotate(' + f1(o.ang || 0) + ' ' + f1(mc[0]) + ' ' + f1(mc[1]) + ')', color: o.titleColor });
    }
    stroke(d, [T([-w * 0.42, -h * 0.2]), T([w * 0.42, -h * 0.2])], { p: dp, w: 1.8, seed: (o.seed || 700) + 1, brush: false });
    // columns of text lines
    const cols = o.cols || 3;
    for (let ci = 0; ci < cols; ci++) {
      const x0 = -w * 0.42 + ci * (w * 0.84 / cols) + 4, x1 = x0 + w * 0.84 / cols - 10;
      for (let li = 0; li < (o.rows || 5); li++) {
        const yy = -h * 0.12 + li * h * 0.11;
        if (yy > h * 0.42) break;
        const e = x1 - (li === (o.rows || 5) - 1 ? (x1 - x0) * 0.4 : 0);
        stroke(d, [T([x0, yy]), T([e, yy])], { p: clamp((dp - li * 0.08) / 0.6), w: 1.4, color: R.pal.soft, seed: (o.seed || 700) + 10 + ci * 10 + li, brush: false, amp: 0.5 });
      }
    }
    if (o.photo) {
      const pc = [w * 0.18, h * 0.05];
      shape(d, [[pc[0] - w * 0.2, pc[1] - h * 0.13], [pc[0] + w * 0.22, pc[1] - h * 0.13], [pc[0] + w * 0.22, pc[1] + h * 0.18], [pc[0] - w * 0.2, pc[1] + h * 0.18]].map(T), { p: dp, w: 1.8, seed: (o.seed || 700) + 90 });
      stroke(d, [T([pc[0] - w * 0.16, pc[1] + h * 0.14]), T([pc[0] - w * 0.02, pc[1] - h * 0.02]), T([pc[0] + w * 0.06, pc[1] + h * 0.08]), T([pc[0] + w * 0.12, pc[1] + h * 0.01]), T([pc[0] + w * 0.19, pc[1] + h * 0.14])], { p: dp, w: 1.6, seed: (o.seed || 700) + 91, brush: false });
    }
    if (o.date) {
      const dc = T([w * 0.38, -h * 0.4]);
      text(d, o.date, dc[0], dc[1], { size: Math.max(10, h * 0.06), anchor: 'end', opacity: dp, font: "'Cormorant Garamond', serif", weight: 600, transform: 'rotate(' + f1(o.ang || 0) + ' ' + f1(dc[0]) + ' ' + f1(dc[1]) + ')' });
    }
  }

  // ------------------------------------------------------------ lead type
  function leadType(d, c, s, ch, o = {}) {
    const ang = (o.ang || 0) * DEG;
    const T = (q) => add(c, rot(mul(q, s), ang));
    const top = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    const side = [[0.5, -0.5], [0.72, -0.3], [0.72, 0.7], [0.5, 0.5]];
    const bot = [[-0.5, 0.5], [0.5, 0.5], [0.72, 0.7], [-0.28, 0.7]];
    shape(d, side.map(T), { w: 2, seed: (o.seed || 750) + 1, fill: R.pal.shade, p: o.p });
    shape(d, bot.map(T), { w: 2, seed: (o.seed || 750) + 2, fill: R.pal.fillMid, p: o.p });
    shape(d, top.map(T), { w: 2.4, seed: (o.seed || 750), fill: R.pal.fill, p: o.p });
    if (ch) {
      const tc = T([0, 0.02]);
      // real type faces are mirror images, but on screen the characters must
      // read correctly (they spell the masthead 小世界), so mirroring is opt-in
      text(d, ch, 0, 0, { size: s * 0.72, weight: 700, color: o.color || R.pal.line, opacity: o.p === undefined ? 1 : clamp(o.p * 2 - 1), transform: 'translate(' + f1(tc[0]) + ' ' + f1(tc[1] + s * 0.25) + ') rotate(' + f1(o.ang || 0) + ')' + (o.mirror ? ' scale(-1 1)' : '') });
    }
  }

  function photoCard(d, c, w, h, o = {}) {
    const ang = (o.ang || 0) * DEG;
    const T = (q) => add(c, rot(q, ang));
    shape(d, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(T), { w: 2.4, seed: o.seed || 760, p: o.p });
    shape(d, [[-w * 0.4, -h * 0.4], [w * 0.4, -h * 0.4], [w * 0.4, h * 0.25], [-w * 0.4, h * 0.25]].map(T), { w: 1.6, seed: (o.seed || 760) + 1, p: o.p, fill: R.pal.fillMid });
    stroke(d, [[-w * 0.36, h * 0.2], [-w * 0.1, -h * 0.12], [w * 0.04, h * 0.04], [w * 0.16, -h * 0.06], [w * 0.36, h * 0.2]].map(T), { w: 1.6, seed: (o.seed || 760) + 2, p: o.p, brush: false });
    shape(d, ellipse(T([w * 0.22, -h * 0.22]), w * 0.06, w * 0.06, 0, 12), { w: 1.4, seed: (o.seed || 760) + 3, p: o.p, color: R.pal.gold });
  }

  function phone(d, c, w, h, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    const r = w * 0.12;
    const pts = [];
    const corners = [[c[0] + w / 2 - r, c[1] - h / 2 + r, -90, 0], [c[0] + w / 2 - r, c[1] + h / 2 - r, 0, 90], [c[0] - w / 2 + r, c[1] + h / 2 - r, 90, 180], [c[0] - w / 2 + r, c[1] - h / 2 + r, 180, 270]];
    for (const [x, y, a0, a1] of corners) for (let a = a0; a <= a1; a += 15) pts.push([x + Math.cos(a * DEG) * r, y + Math.sin(a * DEG) * r]);
    shape(d, pts, { p, w: 3.4, seed: o.seed || 780, fill: o.fill === undefined ? 'none' : o.fill, start: 0.1 });
    stroke(d, [[c[0] - w * 0.12, c[1] - h / 2 + r * 0.6], [c[0] + w * 0.12, c[1] - h / 2 + r * 0.6]], { p, w: 3, seed: (o.seed || 780) + 1 });
    shape(d, ellipse([c[0], c[1] + h / 2 - r * 0.7], r * 0.28, r * 0.28, 0, 12), { p, w: 2, seed: (o.seed || 780) + 2, fill: 'none' });
  }

  function camera(d, c, s, o = {}) {
    const T = (q) => [c[0] + q[0] * s, c[1] + q[1] * s];
    shape(d, [[-0.5, -0.3], [-0.2, -0.3], [-0.12, -0.45], [0.18, -0.45], [0.26, -0.3], [0.5, -0.3], [0.5, 0.35], [-0.5, 0.35]].map(T), { w: 2.4, seed: o.seed || 790, p: o.p });
    shape(d, ellipse(T([0.03, 0.02]), s * 0.22, s * 0.22, 0, 20), { w: 2.4, seed: (o.seed || 790) + 1, p: o.p });
    shape(d, ellipse(T([0.03, 0.02]), s * 0.11, s * 0.11, 0, 14), { w: 1.8, seed: (o.seed || 790) + 2, p: o.p, color: R.pal.gold });
  }

  function mic(d, c, s, o = {}) {
    const T = (q) => [c[0] + q[0] * s, c[1] + q[1] * s];
    shape(d, ellipse(T([0, -0.3]), s * 0.18, s * 0.24, 0, 20), { w: 2.4, seed: o.seed || 795, p: o.p });
    stroke(d, [T([-0.14, -0.35]), T([0.14, -0.35])], { w: 1.4, seed: (o.seed || 795) + 1, p: o.p, brush: false });
    stroke(d, [T([-0.14, -0.25]), T([0.14, -0.25])], { w: 1.4, seed: (o.seed || 795) + 2, p: o.p, brush: false });
    shape(d, [T([-0.06, -0.06]), T([0.06, -0.06]), T([0.04, 0.5]), T([-0.04, 0.5])], { w: 2.2, seed: (o.seed || 795) + 3, p: o.p });
  }

  // writing brush (毛筆): tip at `tip`, handle pointing along ang (deg)
  function writingBrush(d, tip, ang, L, o = {}) {
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(tip, mul(dir, u * L)), mul(n, off));
    const head = [at(0, 0), at(0.12, L * 0.045), at(0.2, L * 0.05), at(0.22, -L * 0.05), at(0.12, -L * 0.045)];
    shape(d, head, { w: 2.2, seed: o.seed || 800, fill: o.inkFill || R.pal.line, p: o.p });
    shape(d, [at(0.2, L * 0.03), at(1, L * 0.024), at(1, -L * 0.024), at(0.2, -L * 0.03)], { w: 2.2, seed: (o.seed || 800) + 1, p: o.p });
    for (let k = 1; k < 4; k++) stroke(d, [at(0.2 + k * 0.2, L * 0.026), at(0.2 + k * 0.2, -L * 0.026)], { w: 1.4, seed: (o.seed || 800) + 2 + k, p: o.p, brush: false });
    stroke(d, [at(1, 0), at(1.08, 0)], { w: 2.2, seed: (o.seed || 800) + 9, p: o.p });
  }

  // square seal stamp
  function seal(d, c, s, str, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const sc = lerp(1.6, 1, K.easeOutBack(p));
    const w = s * sc;
    const fill = o.fill || R.pal.line, ink = o.ink || R.pal.bg;
    d.open('opacity="' + clamp(p * 3).toFixed(3) + '"');
    shape(d, [[c[0] - w / 2, c[1] - w / 2], [c[0] + w / 2, c[1] - w / 2], [c[0] + w / 2, c[1] + w / 2], [c[0] - w / 2, c[1] + w / 2]], { w: 2, fill, color: fill, seed: o.seed || 820, amp: 1.5 });
    const chars = Array.from(str);
    if (chars.length === 4) {
      [[1, 0], [1, 1], [0, 0], [0, 1]].forEach((cr, i) => text(d, chars[i], c[0] + (cr[0] - 0.5) * w * 0.46, c[1] + (cr[1] - 0.5) * w * 0.46 + w * 0.17, { size: w * 0.42, weight: 700, color: ink }));
    } else if (chars.length === 2) {
      chars.forEach((ch, i) => text(d, ch, c[0], c[1] + (i - 0.5) * w * 0.44 + w * 0.16, { size: w * 0.42, weight: 700, color: ink }));
    } else {
      text(d, str, c[0], c[1] + w * 0.28, { size: w * 0.7, weight: 700, color: ink });
    }
    d.close();
  }

  // ------------------------------------------------------------- weapons
  // straight sword (jian): grip at hand, blade along ang (deg)
  function sword(d, hand, ang, L, o = {}, t = 0) {
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0) return;
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(hand, mul(dir, u * L)), mul(n, off));
    const bw = o.width || L * 0.028;
    const col = o.color || R.pal.line;
    // grip & pommel behind the hand
    stroke(d, [at(-0.16, 0), at(0.02, 0)], { w: bw * 1.3, seed: (o.seed || 850), color: col, p });
    // guard
    stroke(d, [at(0.05, -bw * 2.3), at(0.05, bw * 2.3)], { w: bw * 1.1, seed: (o.seed || 850) + 1, color: o.gold || R.pal.gold, p });
    // blade
    const blade = [at(0.07, -bw), at(0.93, -bw * 0.8), at(1, 0), at(0.93, bw * 0.8), at(0.07, bw)];
    shape(d, blade, { w: 2.2, seed: (o.seed || 850) + 2, color: col, fill: o.fill || R.pal.fill, p, amp: 0.6 });
    stroke(d, [at(0.1, 0), at(0.9, 0)], { w: 1.2, seed: (o.seed || 850) + 3, color: R.pal.soft, brush: false, p, amp: 0.4 });
    // tassel from the pommel
    if (o.tassel !== false) {
      const base = at(-0.17, 0);
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push([base[0] - dir[0] * u * L * 0.1 + Math.sin(t * 5 + u * 4) * 6 * u, base[1] + u * L * 0.18]);
      }
      stroke(d, pts, { w: 3, seed: (o.seed || 850) + 4, color: o.gold || R.pal.gold, p });
    }
    if (o.gleam) halo(d, at(0.98, 0), L * 0.25 * o.gleam, 'gold', o.gleam);
  }

  // heavy iron sword (玄鐵重劍): broad, blunt, dark
  function heavySword(d, hand, ang, L, o = {}) {
    const p = o.p === undefined ? 1 : o.p;
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(hand, mul(dir, u * L)), mul(n, off));
    const bw = L * 0.07;
    stroke(d, [at(-0.17, 0), at(0.02, 0)], { w: bw * 0.8, seed: 870, p });
    stroke(d, [at(0.05, -bw * 1.5), at(0.05, bw * 1.5)], { w: bw * 0.5, seed: 871, p, color: R.pal.gold });
    const blade = [at(0.07, -bw), at(0.97, -bw * 0.95), at(1, -bw * 0.5), at(1, bw * 0.5), at(0.97, bw * 0.95), at(0.07, bw)];
    shape(d, blade, { w: 3.2, seed: 872, p, fill: R.pal.dark, color: R.pal.gold });
    stroke(d, [at(0.12, -bw * 0.45), at(0.9, -bw * 0.45)], { w: 1.6, seed: 873, p, color: R.pal.goldSoft, brush: false });
    stroke(d, [at(0.12, bw * 0.45), at(0.9, bw * 0.45)], { w: 1.6, seed: 874, p, color: R.pal.goldSoft, brush: false });
  }

  // curved saber for the incoming blade swarm
  function saber(d, c, ang, L, o = {}) {
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(c, mul(dir, (u - 0.5) * L)), mul(n, off + Math.sin(u * Math.PI) * L * 0.06));
    const bw = L * 0.05;
    shape(d, [at(0.2, -bw * 0.4), at(0.95, -bw * 0.3), at(1.02, bw * 0.6), at(0.9, bw * 0.9), at(0.2, bw * 0.9)], { w: 2, seed: o.seed || 880, fill: R.pal.fill, p: o.p });
    stroke(d, [at(0.02, bw * 0.25), at(0.18, bw * 0.25)], { w: bw * 0.9, seed: (o.seed || 880) + 1, p: o.p });
    stroke(d, [at(0.19, -bw * 0.9), at(0.19, bw * 1.6)], { w: 2.6, seed: (o.seed || 880) + 2, p: o.p, color: R.pal.gold });
  }

  function bow(d, grip, ang, L, draw, o = {}) {
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(grip, mul(n, u * L / 2)), mul(dir, off));
    const bend = L * 0.16 + draw * L * 0.08;
    const limb = [];
    for (let i = 0; i <= 16; i++) { const u = -1 + 2 * i / 16; limb.push(at(u, bend * (1 - u * u) - bend * 0.35 + Math.abs(u) * 4)); }
    stroke(d, limb, { w: 5, seed: o.seed || 890, p: o.p });
    const top = limb[0], bot = limb[limb.length - 1];
    const pull = add(grip, mul(dir, -draw * L * 0.42));
    stroke(d, [top, pull, bot], { w: 1.4, seed: (o.seed || 890) + 1, brush: false, p: o.p, color: R.pal.soft });
    return { nock: pull, top, bot };
  }

  function arrowShape(d, tail, ang, L, o = {}) {
    const dir = K.polar(ang * DEG, 1), n = perp(dir);
    const at = (u, off) => add(add(tail, mul(dir, u * L)), mul(n, off));
    stroke(d, [at(0, 0), at(0.92, 0)], { w: 2.4, seed: o.seed || 895, p: o.p, color: o.color });
    shape(d, [at(0.9, -6), at(1.04, 0), at(0.9, 6)], { w: 2, seed: (o.seed || 895) + 1, p: o.p, color: o.color || R.pal.gold, fill: o.color || R.pal.gold });
    stroke(d, [at(0.02, 0), at(0.1, -8)], { w: 2, seed: (o.seed || 895) + 2, p: o.p, color: o.color });
    stroke(d, [at(0.02, 0), at(0.1, 8)], { w: 2, seed: (o.seed || 895) + 3, p: o.p, color: o.color });
  }

  function gourd(d, c, s, ang, o = {}) {
    const T = (q) => add(c, rot(mul(q, s), (ang || 0) * DEG));
    const body = ellipse([0, 0.35], 0.42, 0.45, 0, 24).concat([]);
    shape(d, ellipse([0, 0.38], 0.42, 0.44, 0, 24).map(T), { w: 2.2, seed: o.seed || 900, p: o.p });
    shape(d, ellipse([0, -0.2], 0.27, 0.28, 0, 20).map(T), { w: 2.2, seed: (o.seed || 900) + 1, p: o.p });
    stroke(d, [T([-0.2, 0.02]), T([0.2, 0.02])], { w: 2.6, seed: (o.seed || 900) + 2, p: o.p, color: R.pal.gold });
    stroke(d, [T([0, -0.48]), T([0, -0.62])], { w: 3, seed: (o.seed || 900) + 3, p: o.p });
  }

  G.PROPS = { emblem, wordmark, cornerBug, book, scroll, newspaper, leadType, photoCard, phone, camera, mic, writingBrush, seal, sword, heavySword, saber, bow, arrowShape, gourd };
})(typeof window !== 'undefined' ? window : globalThis);
