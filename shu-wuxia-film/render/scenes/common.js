/* Shared helpers for scene choreography.
 * A scene registers {draw(d, ts, S), cues(S)} in window.SCENES.
 *  ts = seconds since the scene started, S = scene entry from the timeline
 *  (dur, lines with t0/t1 relative to the scene start, variant).
 * cues(S) returns sound-effect cues [{t, sfx, gain, pan}] relative to the
 * scene start; the audio mixer places them on the same clock as the frames.
 */
(function (G) {
  'use strict';
  const K = G.K;
  const { clamp, lerp, easeInOut, smooth, inv, noise1 } = K;
  G.SCENES = G.SCENES || {};

  const SC = G.SC = {};
  SC.line = (S, id) => S.lines.find((l) => l.id === id) || null;
  SC.has = (S, id) => !!SC.line(S, id);
  SC.first = (S) => S.lines[0];
  SC.last = (S) => S.lines[S.lines.length - 1];
  // time after line `id` ends (falls back to the last line)
  SC.after = (S, id, dt = 0) => (SC.line(S, id) || SC.last(S)).t1 + dt;
  SC.before = (S, id, dt = 0) => (SC.line(S, id) || SC.first(S)).t0 - dt;
  // draw-on progress between a and b seconds
  SC.dp = (ts, a, b, ez = smooth) => ez(inv(a, b, ts));
  // camera keyframes: [[t, {x, y, z}], ...]
  SC.cam = (keys, t) => {
    if (t <= keys[0][0]) return Object.assign({}, keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, a] = keys[i], [t1, b, ez] = keys[i + 1];
      if (t <= t1) {
        const u = (ez || easeInOut)(inv(t0, t1, t));
        return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) };
      }
    }
    return Object.assign({}, keys[keys.length - 1][1]);
  };
  // decaying camera shake
  SC.shake = (cam, t, t0, amp = 14, dur = 0.5) => {
    const a = t - t0;
    if (a < 0 || a > dur) return cam;
    const k = (1 - a / dur) * amp;
    return { x: cam.x + noise1(a * 40, 7) * k, y: cam.y + noise1(a * 40, 9) * k, z: cam.z };
  };
  // fade the form label out near the scene end
  SC.labelOut = (S, ts) => 1 - smooth((ts - (S.dur - 0.9)) / 0.7);
  // a repeating cue helper
  SC.repeat = (sfx, t0, t1, every, gain = 1, pan = 0) => {
    const out = [];
    for (let t = t0; t < t1; t += every) out.push({ t, sfx, gain, pan });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
