(() => {
document.documentElement.lang = 'zh-Hant';
const root = document.documentElement;
const stage = document.getElementById('stage');
const slides = [...document.querySelectorAll('.slide')];
const N = slides.length;
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
let cur = 0, stageScale = 1;

/* ---------- text splitting (CJK punctuation stays attached, Latin words stay whole) ---------- */
const OPEN = '「『（(《〈“‘【', CLOSE = '，。、：；？！」』）)》〉”’…,.:;?!%】';
function split(el, i = 0) {
  for (const node of [...el.childNodes]) {
    if (node.nodeType === 3) {
      const toks = node.textContent.match(/[A-Za-z0-9][A-Za-z0-9.'’\-+\/&–—]*|\s+|./gu) || [];
      const out = []; let open = '';
      for (const t of toks) {
        if (/^\s+$/.test(t)) { if (open) { out.push(open); open = ''; } out.push(t); continue; }
        if (OPEN.includes(t)) { open += t; continue; }
        if (CLOSE.includes(t) && out.length && !/^\s+$/.test(out[out.length - 1])) { out[out.length - 1] += t; continue; }
        out.push(open + t); open = '';
      }
      if (open) out.push(open);
      const frag = document.createDocumentFragment();
      for (const t of out) {
        if (/^\s+$/.test(t) && !el.closest('.type')) { frag.appendChild(document.createTextNode(t)); continue; }
        const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = t; frag.appendChild(s);
      }
      node.replaceWith(frag);
    } else if (node.nodeType === 1 && node.tagName !== 'BR' && !node.hasAttribute('data-to')) {
      i = split(node, i);
    }
  }
  return i;
}
document.querySelectorAll('.split,.type').forEach(el => { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); split(el); });

/* ---------- episode chyron on every sheet ---------- */
slides.forEach((s, i) => {
  const c = document.createElement('div');
  c.className = 'chyron'; c.setAttribute('aria-hidden', 'true');
  c.innerHTML = `<span class="rec"><i></i>REC</span><span>解剖爆款 · ${s.dataset.part || ''}</span><span>${s.dataset.title || ''}</span><b>EP ${pad(i + 1)} / ${pad(N)}</b>`;
  s.appendChild(c);
});

/* ---------- count-up ---------- */
function fmt(v, dec, sep) {
  const s = v.toFixed(dec);
  if (!sep) return s;
  const [a, b] = s.split('.');
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '');
}
function countUp(el) {
  const to = +el.dataset.to, dec = +(el.dataset.dec || 0), sep = el.dataset.sep !== '0';
  const from = +(el.dataset.from || 0);
  const delay = +(el.dataset.delay || 900), dur = +(el.dataset.dur || 1500);
  const tok = el._tok = (el._tok || 0) + 1;
  el.textContent = fmt(to, dec, sep);
  if (!MOTION) return;
  const t0 = performance.now() + delay;
  el.textContent = fmt(from, dec, sep);
  const tick = now => {
    if (el._tok !== tok) return;
    if (!el.closest('.slide').classList.contains('is-active')) { el.textContent = fmt(to, dec, sep); return; }
    const k = clamp((now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e, dec, sep);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- generated pieces: coins, tiles, cells, survivors, gears, boxes ---------- */
let coinIdx = 0;
document.querySelectorAll('.stack[data-coins]').forEach(st => {
  for (let i = 0; i < +st.dataset.coins; i++) {
    const c = document.createElement('i'); c.className = 'coin';
    c.style.bottom = (i * 12) + 'px'; c.style.setProperty('--c', coinIdx++);
    st.appendChild(c);
  }
});
document.querySelectorAll('[data-waffle]').forEach(pl => {
  const [a, m, h] = pl.dataset.waffle.split(',').map(Number);
  for (let i = 0; i < a + m + h; i++) {
    const t = document.createElement('i'); t.className = 't' + (i < a ? ' a' : i < a + m ? ' m' : '');
    t.style.setProperty('--i', i); pl.appendChild(t);
  }
});
document.querySelectorAll('[data-cells]').forEach(g => {
  for (let i = 0; i < +g.dataset.cells; i++) { const c = document.createElement('i'); c.style.setProperty('--i', i); g.appendChild(c); }
});
let seed = 20260817;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
document.querySelectorAll('[data-survive]').forEach(pl => {
  const [n, s] = pl.dataset.survive.split(',').map(Number);
  const keep = new Set();
  while (keep.size < s) keep.add(Math.floor(rnd() * n));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    if (keep.has(i)) c.className = 's';
    else c.style.setProperty('--dl', (1.3 + rnd() * 3.1).toFixed(2) + 's');
    pl.appendChild(c);
  }
});
function gearPath(n) {
  const R = 48, r = 39, w1 = Math.PI / n * .62, w2 = Math.PI / n * .36, P = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n;
    [[a - w1, r], [a - w2, R], [a + w2, R], [a + w1, r]].forEach(([b, rr]) => P.push((Math.cos(b) * rr).toFixed(2) + ' ' + (Math.sin(b) * rr).toFixed(2)));
  }
  let d = 'M' + P.join('L') + 'Z';
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = Math.cos(a) * 25, y = Math.sin(a) * 25; d += `M${(x + 6.5).toFixed(2)} ${y.toFixed(2)}a6.5 6.5 0 1 0-13 0a6.5 6.5 0 1 0 13 0Z`; }
  return d;
}
document.querySelectorAll('[data-gear]').forEach(g => {
  const n = +g.dataset.gear, d = gearPath(n), per = (n * .6).toFixed(1) + 's', dir = g.style.getPropertyValue('--ccw') ? 'reverse' : 'normal';
  ['l2', 'l1', ''].forEach(cls => {
    g.insertAdjacentHTML('beforeend', `<svg class="${cls}" viewBox="-50 -50 100 100" aria-hidden="true"><path fill-rule="evenodd" d="${d}"/></svg>`);
  });
  g.querySelectorAll('svg').forEach(s => { s.style.animation = MOTION ? `gspin ${per} linear infinite ${dir}` : 'none'; s.style.animationPlayState = 'paused'; });
  g.insertAdjacentHTML('beforeend', '<i class="ax"></i>');
});
const gs = document.createElement('style'); gs.textContent = '@keyframes gspin{to{rotate:360deg}}.slide.is-active .gear svg{animation-play-state:running!important}'; document.head.appendChild(gs);
function buildBox(el) {
  const w = +el.dataset.w, h = +el.dataset.h, d = +el.dataset.d;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  [['front', w, h, `translateZ(${d / 2}px)`, 0], ['back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`, .3],
   ['right', d, h, `rotateY(90deg) translateZ(${w / 2}px)`, .2], ['left', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, .1],
   ['top', w, d, `rotateX(90deg) translateZ(${h / 2}px)`, .06], ['bottom', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, .26]
  ].forEach(([n, fw, fh, tf, sh]) => {
    const f = document.createElement('i'); f.className = 'face f-' + n;
    f.style.cssText = `width:${fw}px;height:${fh}px;left:${(w - fw) / 2}px;top:${(h - fh) / 2}px;transform:${tf};--sh:${sh}`;
    el.appendChild(f);
  });
}
document.querySelectorAll('.box3d').forEach(buildBox);

/* ---------- canvas scenes ---------- */
const GL = {
  pie(cv, o, el) { // extruded 3D pie / donut, swept in then slowly turning; labels ride the top face
    const ctx = cv.getContext('2d');
    const segs = o.segs, tot = segs.reduce((a, s) => a + s.v, 0);
    const labs = segs.map((s, i) => {
      const d = document.createElement('div'); d.className = o.labelClass || 'plab';
      const num = `<span class="num" data-to="${s.v}" data-dec="${s.dec || 0}" data-delay="${Math.round((o.delay + .5 + i * .5) * 1000)}" data-dur="1200">${fmt(s.v, s.dec || 0, true)}</span>%`;
      d.innerHTML = o.labelClass === 'dl' ? `<span>${s.lab}</span><b>${num}</b>` : `<b class="big">${num}</b><span>${s.lab}</span>`;
      el.appendChild(d); return d;
    });
    return t => {
      const W = cv.width, H = cv.height, k = W / Math.max(1, el.offsetWidth);
      ctx.clearRect(0, 0, W, H);
      const tilt = o.tilt, dep = o.depth;
      const R = Math.min(W * .45, H * .84 / (2 * tilt + dep)), ri = R * (o.inner || 0), dz = R * dep;
      const cx = W / 2, cy = H / 2 - dz / 2;
      const p = MOTION ? clamp((t - o.delay) / 1.8) : 1, e = 1 - Math.pow(1 - p, 3);
      const rot = o.rot + (MOTION ? t * (o.spin || 0) : 0), lim = rot + e * Math.PI * 2;
      const P = (a, r, z) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * tilt + z];
      let acc = rot;
      const parts = segs.map((s, i) => { const a0 = acc; acc += s.v / tot * Math.PI * 2; return { s, i, a0, a1: acc, e1: Math.min(acc, lim) }; });
      const samples = (a0, a1) => { const n = Math.max(2, Math.ceil((a1 - a0) / .02)); return Array.from({ length: n + 1 }, (_, j) => a0 + (a1 - a0) * j / n); };
      const runs = (a0, a1, cond, fn) => { let r = []; for (const a of samples(a0, a1)) { if (cond(a)) r.push(a); else { if (r.length > 1) fn(r); r = []; } } if (r.length > 1) fn(r); };
      ctx.lineJoin = 'round'; ctx.lineWidth = 2 * k; ctx.strokeStyle = o.ink || 'rgba(8,6,12,.6)';
      const wall = (pts, r, fill) => { ctx.beginPath(); pts.forEach((a, j) => { const [x, y] = P(a, r, 0); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); for (let j = pts.length - 1; j >= 0; j--) { const [x, y] = P(pts[j], r, dz); ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
      const live = parts.filter(q => q.e1 > q.a0 + 1e-4);
      if (ri > 0) live.forEach(q => runs(q.a0, q.e1, a => Math.sin(a) < 0, pts => wall(pts, ri, q.s.s)));
      live.forEach(q => runs(q.a0, q.e1, a => Math.sin(a) > 0, pts => wall(pts, R, q.s.s)));
      live.forEach(q => {
        ctx.beginPath();
        samples(q.a0, q.e1).forEach((a, j) => { const [x, y] = P(a, R, 0); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        if (ri > 0) samples(q.a0, q.e1).reverse().forEach(a => { const [x, y] = P(a, ri, 0); ctx.lineTo(x, y); });
        else ctx.lineTo(cx, cy);
        ctx.closePath(); ctx.fillStyle = q.s.c; ctx.fill(); ctx.stroke();
      });
      parts.forEach((q, i) => {
        const am = (q.a0 + q.a1) / 2, rl = ri > 0 ? (R + ri) / 2 : R * .6, [x, y] = P(am, rl, 0);
        labs[i].style.transform = `translate(${(x / k).toFixed(1)}px,${(y / k).toFixed(1)}px) translate(-50%,-50%)`;
        labs[i].style.opacity = clamp((lim - q.a0) / ((q.a1 - q.a0) * .7)).toFixed(2);
      });
    };
  },
  drops(cv, o, el) { // paper slips fall from the three sampling dates into the funnel
    const ctx = cv.getContext('2d'); let P = [], acc = 0;
    return (t, dt) => {
      const W = cv.width, H = cv.height, k = W / Math.max(1, el.offsetWidth);
      ctx.clearRect(0, 0, W, H);
      if (!MOTION) return;
      if (t < .03) { P = []; acc = 0; }
      const rate = t < 1.1 ? 0 : t < 4.4 ? 26 : 7;
      acc += rate * dt;
      while (acc >= 1) {
        acc--;
        const sx = o.src[Math.floor(Math.random() * o.src.length)];
        P.push({ x: sx * W + (Math.random() - .5) * 70 * k, y: 26 * k, vx: 0, vy: (30 + Math.random() * 50) * k, a: Math.random() * 6, va: (Math.random() - .5) * 8, c: Math.random() < .32 ? '#C9372A' : '#FCFAF4' });
      }
      const tx = o.to[0] * W, mouth = o.to[1] * H;
      ctx.lineWidth = 1.6 * k; ctx.strokeStyle = '#1F1D1A';
      P = P.filter(p => {
        p.vy += 700 * k * dt;
        const pull = p.y < mouth ? 2.4 : 6;
        p.vx += ((tx + Math.sin(p.a) * 40 * k) - p.x) * pull * dt; p.vx *= .92;
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        if (p.y > H + 20 * k) return false;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-7 * k, -9 * k, 14 * k, 18 * k); ctx.strokeRect(-7 * k, -9 * k, 14 * k, 18 * k);
        ctx.restore();
        return true;
      });
    };
  }
};
const loops = [];
document.querySelectorAll('[data-gl]').forEach(el => {
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); el.appendChild(cv);
  const o = el.dataset.glOpts ? JSON.parse(el.dataset.glOpts) : {};
  const size = () => { const r = Math.min(2.5, Math.max(1, (devicePixelRatio || 1) * stageScale)); cv.width = Math.max(2, el.offsetWidth * r); cv.height = Math.max(2, el.offsetHeight * r); };
  loops.push({ el, slide: el.closest('.slide'), draw: GL[el.dataset.gl](cv, o, el), size, t: 0 });
});

/* ---------- navigation ---------- */
const bar = document.getElementById('bar'), counter = document.getElementById('counter');
function activate(s) {
  s.querySelectorAll('[data-to]').forEach(countUp);
  loops.forEach(l => { if (l.slide === s) { l.size(); l.t = 0; } });
}
function go(n, replay) {
  n = Math.max(0, Math.min(N - 1, n));
  if (n === cur && !replay) return;
  const prev = slides[cur], next = slides[n];
  const dir = n >= cur ? 'f' : 'b';
  slides.forEach(s => { if (s !== prev) s.classList.remove('is-leaving'); });
  if (prev !== next) {
    prev.classList.remove('is-active'); prev.classList.add('is-leaving'); prev.dataset.dir = dir;
    clearTimeout(prev._lt); prev._lt = setTimeout(() => prev.classList.remove('is-leaving'), 760);
  } else { next.classList.remove('is-active'); next.dataset.dir = 'none'; void next.offsetWidth; }
  next.classList.remove('is-leaving');
  if (prev !== next) next.dataset.dir = dir;
  next.classList.add('is-active');
  cur = n; activate(next);
  slides.forEach((s, i) => s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'));
  bar.style.width = ((n + 1) / N * 100) + '%';
  counter.textContent = `${pad(n + 1)} / ${pad(N)}`;
  try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) {}
}
document.getElementById('prev').onclick = e => { e.stopPropagation(); go(cur - 1); };
document.getElementById('next').onclick = e => { e.stopPropagation(); go(cur + 1); };
document.getElementById('replay').onclick = e => { e.stopPropagation(); go(cur, true); };
document.getElementById('fs').onclick = e => { e.stopPropagation(); toggleFS(); };
function toggleFS() { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else root.requestFullscreen?.().catch(() => {}); }
document.addEventListener('fullscreenchange', fit);
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' ', 'Enter', 'ArrowDown'].includes(k)) { e.preventDefault(); go(cur + 1); }
  else if (['ArrowLeft', 'PageUp', 'Backspace', 'ArrowUp'].includes(k)) { e.preventDefault(); go(cur - 1); }
  else if (k === 'Home') go(0); else if (k === 'End') go(N - 1);
  else if (k === 'r' || k === 'R') go(cur, true);
  else if (k === 'f' || k === 'F') toggleFS();
});
document.getElementById('viewport').addEventListener('click', e => { if (e.target.closest('#controls,a,button')) return; const x = e.clientX / innerWidth; go(cur + (x < .25 ? -1 : 1)); });
let tx = null, ty = 0;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(cur + (dx < 0 ? 1 : -1)); tx = null; });

/* idle controls + pointer parallax */
const sm = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9 };
let idleT;
const fine = matchMedia('(pointer: fine)').matches;
function wake() { document.body.classList.remove('idle'); clearTimeout(idleT); if (fine) idleT = setTimeout(() => document.body.classList.add('idle'), 2600); }
addEventListener('pointermove', e => {
  wake();
  if (e.pointerType === 'mouse') { sm.tx = e.clientX / innerWidth * 2 - 1; sm.ty = e.clientY / innerHeight * 2 - 1; sm.last = performance.now(); }
});
addEventListener('keydown', wake); wake();
document.getElementById('controls').addEventListener('focusin', wake);
setTimeout(() => document.getElementById('hint')?.classList.add('gone'), 5500);

/* ---------- fit the 1920×1080 sheet to the window ---------- */
function fit() {
  const W = innerWidth, H = innerHeight;
  stageScale = Math.max(.05, Math.min(W / 1920, H / 1080));
  stage.style.transform = `translate(${(W - 1920 * stageScale) / 2}px,${(H - 1080 * stageScale) / 2}px) scale(${stageScale})`;
  loops.forEach(l => { if (l.slide.classList.contains('is-active')) l.size(); else l.stale = true; });
}
addEventListener('resize', fit);

/* ---------- frame loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const s = slides[cur];
  if (MOTION) {
    const idle = clamp((now - sm.last - 2500) / 2500);
    const ax = idle * .6 * Math.sin(now / 1000 * .35), ay = idle * .3 * Math.sin(now / 1000 * .27);
    sm.x += ((1 - idle) * sm.tx + ax - sm.x) * Math.min(1, dt * 3);
    sm.y += ((1 - idle) * sm.ty + ay - sm.y) * Math.min(1, dt * 3);
    s.style.setProperty('--mx', sm.x.toFixed(3)); s.style.setProperty('--my', sm.y.toFixed(3));
  }
  for (const l of loops) {
    if (l.slide !== s && !l.slide.classList.contains('is-leaving')) continue;
    if (l.stale) { l.size(); l.stale = false; }
    l.t += dt; l.draw(MOTION ? l.t : 99, dt);
  }
  requestAnimationFrame(frame);
}

/* ---------- start ---------- */
fit();
const start = Math.max(0, Math.min(N - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
cur = start; slides[cur].dataset.dir = 'none'; slides[cur].classList.add('is-active');
slides.forEach((s, i) => s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'));
activate(slides[cur]);
bar.style.width = ((cur + 1) / N * 100) + '%'; counter.textContent = `${pad(cur + 1)} / ${pad(N)}`;
requestAnimationFrame(frame);
})();
