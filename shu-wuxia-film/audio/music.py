#!/usr/bin/env python3
"""Original wuxia-style score, arranged to the edit timeline.

A minor pentatonic (羽調: A C D E G) for the action, C major pentatonic (宮調,
same five notes) for the uplifting ending. 132 BPM on a continuous beat grid;
each scene gets its own arrangement (calm opening, title hit, heroic march,
playful motto, rooftop chase, battles, solemn night, emotional finale,
resolution) and big accents land exactly on the visual hits.

    python music.py <timeline.json> <cues.json> <out.wav>
"""
import json
import sys

import numpy as np

import synth as S

SR = S.SR
BPM = 132.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(70)

# theme phrases: (midi, beats); None = rest
PHRASE_A = [(69, 1), (72, .5), (74, .5), (76, 1.5), (79, .5), (76, .5), (74, .5), (72, 1), (69, 2),
            (67, .5), (69, .5), (72, 1), (74, .5), (76, .5), (74, .5), (72, .5), (69, 3), (None, 1)]
PHRASE_B = [(76, 1), (79, .5), (81, .5), (79, 1.5), (76, .5), (74, .5), (76, .5), (74, .5), (72, .5), (69, 2),
            (72, .5), (74, .5), (76, 1), (79, .5), (76, .5), (74, 1), (76, 3), (None, 1)]
PHRASE_C = [(72, 1), (74, .5), (76, .5), (79, 1.5), (81, .5), (79, .5), (76, .5), (74, 1), (72, 2),
            (69, .5), (72, .5), (74, 1), (76, .5), (79, .5), (76, .5), (74, .5), (72, 4)]
PROG_MINOR = [45, 43, 48, 50]    # A G C D (power chords)
PROG_MAJOR = [48, 43, 45, 48]    # C G Am C

HIT_CUES = {"palmStrike": 1.0, "titleHit": 0.5, "doorCrash": 1.0, "swordStab": 0.9, "waveCrash": 0.5,
            "bowRelease": 0.6, "burstBell": 0.8, "sealStamp": 0.35}


class Score:
    def __init__(self, dur):
        self.n = int((dur + 6) * SR)
        self.bus = {k: np.zeros((self.n, 2)) for k in ("pluck", "wind", "string", "drum", "metal")}

    def add(self, bus, t, mono, p=0.0, gain=1.0):
        if t < 0:
            mono = mono[int(-t * SR):]
            t = 0
        i = int(t * SR)
        if i >= self.n or len(mono) == 0:
            return
        x = S.pan(mono * gain, p)
        m = min(len(x), self.n - i)
        self.bus[bus][i:i + m] += x[:m]


def q(v):
    return round(float(v), 2)


def hum(t, amt=0.008):
    return t + rng.uniform(-amt, amt)


def play_phrase(sc, phrase, t0, t_end, inst, octave=0, speed=1.0, vel=0.8, p=0.1):
    t = t0
    notes = []
    for m, b in phrase:
        d = b * BEAT * speed
        if t >= t_end:
            break
        if m is not None:
            notes.append((t, min(d, t_end - t), m + 12 * octave))
        t += d
    if inst == "dizi":
        for (s, d, m) in notes:
            sc.add("wind", hum(s, 0.004), S.dizi(S.midi_hz(m), d * 0.98 + 0.08, vel * rng.uniform(0.9, 1.0)), p)
            if d >= BEAT * 1.4 and rng.random() < 0.5:  # grace note ornament
                sc.add("wind", s - 0.06, S.dizi(S.midi_hz(m + 2), 0.07, vel * 0.5, vib=0, scoop=False), p)
    elif inst == "erhu":
        if notes:
            base = notes[0][0]
            x = S.erhu([(s - base, d * 0.99, m) for s, d, m in notes], vel)
            sc.add("string", base, x, p, 0.9)
    elif inst == "pipa":
        for (s, d, m) in notes:
            sc.add("pluck", s, S.tremolo_pluck(S.midi_hz(m), d * 0.95, vel), p)
    elif inst == "zheng":
        for (s, d, m) in notes:
            sc.add("pluck", hum(s), S.pluck(S.midi_hz(m), max(1.2, d + 0.8), vel), p)
    return t


def beats(a, b, step=1.0):
    """global beat times in [a, b)."""
    k = int(np.ceil(a / (BEAT * step) - 1e-9))
    out = []
    while k * BEAT * step < b - 1e-6:
        out.append(k * BEAT * step)
        k += 1
    return out


# ------------------------------------------------------------ elements
def pad_prog(sc, a, b, prog, vel=0.35, minor=True, voicing=None):
    for i, t in enumerate(beats(a, b, 4)):
        root = prog[(i) % len(prog)]
        v = voicing or [0, 7, 12, 19]
        dur = min(BAR, b - t) + 0.1
        sc.add("string", t, S.strings([root + x for x in v], dur, vel, attack=0.35, release=0.9), 0.0)


def drone(sc, a, b, midis, vel=0.3):
    sc.add("string", a, S.drone(midis, b - a, vel), 0.0)


def zheng_arp(sc, a, b, prog, pattern=(0, 7, 12, 16, 19, 16, 12, 7), step=0.5, vel=0.5, p=-0.3, octave=12):
    for i, t in enumerate(beats(a, b, step)):
        bar = int(t / BAR)
        root = prog[bar % len(prog)] + octave
        m = root + pattern[i % len(pattern)]
        sc.add("pluck", hum(t), S.pluck(S.midi_hz(m), 1.3, vel * (1.0 if i % 4 == 0 else 0.8)), p)


def gliss(sc, t, lo, hi, n=14, span=0.45, vel=0.45, up=True, p=-0.2):
    scale = [x for x in range(lo, hi + 1) if x % 12 in (9, 0, 2, 4, 7)]
    if not up:
        scale = scale[::-1]
    for i, m in enumerate(scale[:n]):
        sc.add("pluck", t + i * span / n, S.pluck(S.midi_hz(m), 1.4, vel * (0.7 + 0.3 * i / n)), p)


def drums_march(sc, a, b, vel=0.8):
    for t in beats(a, b, 1):
        bt = round(t / BEAT) % 4
        if bt in (0, 2):
            sc.add("drum", hum(t, 0.004), S.big_drum(vel * (1 if bt == 0 else 0.8)), 0.0)
    for i, t in enumerate(beats(a, b, 0.5)):
        pat = [1, 0, .6, .7, 1, 0, .6, 0]
        v = pat[i % 8]
        if v:
            sc.add("drum", hum(t, 0.006), S.tang_drum(vel * 0.55 * v, pitch=180 + (i % 3) * 12), 0.25)


def drums_run(sc, a, b, vel=0.8):
    for i, t in enumerate(beats(a, b, 0.25)):
        acc = 1.0 if i % 4 == 0 else (0.7 if i % 2 == 0 else 0.45)
        sc.add("drum", hum(t, 0.005), S.tang_drum(vel * 0.42 * acc, pitch=200 - (i % 2) * 25, dur=0.3), 0.2 * (1 if i % 2 else -1))
    for t in beats(a, b, 1):
        bt = round(t / BEAT) % 4
        if bt == 0 or bt == 2:
            sc.add("drum", hum(t, 0.003), S.big_drum(vel * 0.9, pitch=58), 0.0)


def drums_taiko(sc, a, b, vel=1.0):
    pat = [1, 0, .7, .8, 0, .9, 0, .7]
    for i, t in enumerate(beats(a, b, 0.5)):
        v = pat[i % 8]
        if v:
            sc.add("drum", hum(t, 0.006), S.big_drum(vel * v, pitch=52 + 6 * (i % 2)), 0.1 * (1 if i % 2 else -1))


def drums_tense(sc, a, b, vel=0.8):
    pat = [1, 0, 0, 1, 0, 0, 1, 0]  # 3-3-2
    for i, t in enumerate(beats(a, b, 0.5)):
        if pat[i % 8]:
            sc.add("drum", hum(t, 0.004), S.big_drum(vel * 0.8, pitch=70 + (i % 8) * 2, dur=0.9), 0.0)
        if i % 2 == 1:
            sc.add("drum", hum(t, 0.004), S.tang_drum(vel * 0.25, pitch=260, dur=0.25), 0.35)


def heartbeat(sc, a, b, vel=0.5):
    for t in beats(a, b, 4):
        sc.add("drum", t, S.big_drum(vel, pitch=48, dur=1.2), 0.0)
        sc.add("drum", t + BEAT * 0.75, S.big_drum(vel * 0.7, pitch=46, dur=1.2), 0.0)


def woodblocks(sc, a, b, vel=0.4):
    for i, t in enumerate(beats(a, b, 0.5)):
        if i % 2 == 1:
            sc.add("metal", hum(t, 0.004), S.woodblock(vel * (0.8 + 0.2 * (i % 4 == 3)), pitch=900 if i % 4 == 1 else 1150), 0.4)


def hit(sc, t, strength=1.0, gong=True):
    sc.add("drum", t, S.big_drum(1.0 * strength, pitch=55, dur=2.0), 0.0)
    sc.add("drum", t + 0.004, S.big_drum(0.8 * strength, pitch=43, dur=2.2), 0.0)
    sc.add("metal", t, S.cymbal(0.55 * strength, dur=2.4), 0.2)
    if gong:
        sc.add("metal", t + 0.01, S.gong(0.6 * strength, base=98, dur=4.5, bend=-0.035), -0.1)


def swell(sc, t_end, dur=1.6, vel=0.35):
    sc.add("metal", t_end - dur, S.cymbal(vel, dur=dur, swell=True), 0.0)


def roll(sc, t_end, dur=1.0, vel=0.5):
    n = int(dur / (BEAT / 4))
    for k in range(n):
        t = t_end - dur + k * dur / n
        sc.add("drum", t, S.tang_drum(vel * (0.3 + 0.7 * k / n), pitch=210, dur=0.25), 0.1)


# ------------------------------------------------------------ sections
def section(sc, kind, a, b, S_):
    """Arrange one scene section in [a, b)."""
    L = b - a
    if kind == "opening":
        drone(sc, a, b + 0.8, [45, 52, 57], 0.32)
        zheng_arp(sc, a + BEAT * 2, b - BAR, PROG_MINOR[:1] * 2 + [43, 45], pattern=(0, 7, 12, 15, 19, 15), step=1.0, vel=0.42)
        play_phrase(sc, PHRASE_A, a + BAR, b - BAR, "dizi", octave=0, speed=2.0, vel=0.55, p=0.2)
        sc.add("pluck", b - BAR * 1.1, S.tremolo_pluck(S.midi_hz(76), BAR * 1.1, 0.45), 0.25)
        swell(sc, b + 0.05, 1.8, 0.4)
        roll(sc, b, BEAT * 3, 0.55)
    elif kind == "title":
        hit(sc, a, 1.0)
        sc.add("string", a, S.strings([45, 52, 57, 60, 64, 69], L + 0.4, 0.45, attack=0.08, release=1.2), 0.0)
        gliss(sc, a + 0.05, 57, 88, n=16, span=0.5, vel=0.5)
        sc.add("pluck", a + BEAT * 2, S.tremolo_pluck(S.midi_hz(81), max(1.0, L - BEAT * 3), 0.35), 0.3)
        sc.add("wind", a + BEAT * 4, S.dizi(S.midi_hz(81), max(1.0, L - BEAT * 5), 0.45), -0.2)
        roll(sc, b, BEAT * 2, 0.5)
    elif kind == "founding":
        pad_prog(sc, a, b, PROG_MINOR, 0.33)
        drums_march(sc, a, b, 0.75)
        zheng_arp(sc, a, b, PROG_MINOR, vel=0.35, p=-0.35)
        t = play_phrase(sc, PHRASE_A, a + BAR, b, "dizi", vel=0.62, p=0.15)
        play_phrase(sc, PHRASE_B, t, b, "dizi", vel=0.62, p=0.15)
        roll(sc, b, BEAT * 2, 0.5)
    elif kind == "motto":
        woodblocks(sc, a, b, 0.42)
        for t in beats(a, b, 2):
            sc.add("pluck", hum(t), S.pluck(S.midi_hz(45 if round(t / BEAT) % 4 == 0 else 40), 1.0, 0.5, pos=0.3, bright=0.6), -0.1)
        motif = [69, 72, 74, 72, 76, 74, 72, 69, 67, 69, 72, 74, 76, 79, 76, 74]
        for i, t in enumerate(beats(a + BAR * 0.5, b - BEAT, 0.5)):
            if i % 16 in (7, 15):
                continue
            sc.add("pluck", hum(t), S.pluck(S.midi_hz(motif[i % 16]), 0.45, 0.42, decay=0.25), 0.3 * (1 if i % 2 else -1))
        for t in beats(a + BAR, b - BAR, 4):
            sc.add("wind", t, S.dizi(S.midi_hz(81), BEAT * 0.9, 0.35), 0.2)
            sc.add("wind", t + BEAT, S.dizi(S.midi_hz(79), BEAT * 0.45, 0.3), 0.2)
        swell(sc, b, 1.2, 0.3)
    elif kind == "littleworld":
        drums_run(sc, a, b, 0.75)
        zheng_arp(sc, a, b, PROG_MINOR, pattern=(0, 7, 12, 7, 15, 7, 12, 7), step=0.25, vel=0.3, p=-0.4)
        pad_prog(sc, a, b, PROG_MINOR, 0.25)
        play_phrase(sc, PHRASE_B, a + BAR, b, "pipa", octave=0, vel=0.5, p=0.3)
        roll(sc, b, BEAT * 2, 0.55)
    elif kind == "interview":
        drums_tense(sc, a, b, 0.8)
        drone(sc, a, b, [33, 45, 52], 0.32)
        for i, t in enumerate(beats(a, b, 0.5)):
            m = [45, 45, 48, 45, 50, 45, 52, 50][i % 8]
            sc.add("pluck", hum(t), S.pluck(S.midi_hz(m), 0.5, 0.36, pos=0.15, bright=0.8, decay=0.35), -0.2)
        mel = [(76, 1.5), (74, .5), (76, 1), (79, 1), (81, 2), (79, .5), (76, .5), (74, 1), (76, 4)]
        play_phrase(sc, mel, a + BAR, b, "erhu", vel=0.55, p=0.2)
    elif kind == "writing":
        drone(sc, a, b, [38, 45, 50], 0.34)
        drums_taiko(sc, a + BAR, b, 0.9)
        t = play_phrase(sc, PHRASE_A, a + BAR * 2.5, b, "dizi", octave=1, vel=0.55, p=0.15)
        pad_prog(sc, a + BAR * 2, b, [50, 48, 45, 43], 0.3)
    elif kind == "verify":
        for i, t in enumerate(beats(a, b, 0.25)):
            env = 0.35 + 0.35 * np.sin(np.pi * ((t - a) % (BAR * 2)) / (BAR * 2))
            sc.add("drum", hum(t, 0.004), S.tang_drum(env * 0.55, pitch=150, dur=0.3), 0.15 * (1 if i % 2 else -1))
        for i, t in enumerate(beats(a, b, 0.5)):
            m = [33, 33, 36, 38, 40, 38, 36, 33][i % 8]
            sc.add("pluck", hum(t), S.pluck(S.midi_hz(m + 12), 0.6, 0.5, pos=0.3, bright=0.5, decay=0.5), 0.0)
        pad_prog(sc, a, b, PROG_MINOR, 0.3)
        play_phrase(sc, PHRASE_A, a + BAR, b, "erhu", vel=0.6, p=-0.15)
    elif kind == "editing":
        for k, t in enumerate(beats(a, b, 2)):
            gliss(sc, t, 57 + (k % 2) * 5, 86, n=10, span=BEAT * 1.6, vel=0.32, p=-0.3 + 0.6 * (k % 2))
        woodblocks(sc, a, b, 0.3)
        for t in beats(a, b, 1):
            if round(t / BEAT) % 2 == 0:
                sc.add("drum", t, S.tang_drum(0.45, pitch=190), 0.1)
        pad_prog(sc, a, b, [45, 48, 43, 45], 0.28)
    elif kind == "mission":
        heartbeat(sc, a, b, 0.55)
        drone(sc, a, b + 0.5, [45, 52], 0.3)
        for i, t in enumerate(beats(a + BAR, b, 2)):
            m = [81, 76, 79, 74, 76, 72][i % 6]
            sc.add("pluck", t, S.pluck(S.midi_hz(m), 2.0, 0.22, pos=0.5, bright=0.7), 0.35)
        play_phrase(sc, PHRASE_A, a + BAR * 1.5, b, "erhu", octave=0, speed=1.6, vel=0.55, p=-0.1)
    elif kind == "legacy":
        pad_prog(sc, a, b + 0.5, PROG_MAJOR, 0.38, voicing=[0, 7, 12, 16, 21])
        zheng_arp(sc, a, b, PROG_MAJOR, pattern=(0, 7, 12, 14, 16, 19, 16, 12), step=0.5, vel=0.33, p=-0.3)
        play_phrase(sc, PHRASE_C, a + BAR, b, "dizi", octave=0, vel=0.65, p=0.15)
        for t in beats(a + BAR * 2, b, 4):
            sc.add("drum", t, S.big_drum(0.45 + 0.35 * (t - a) / L, pitch=55), 0.0)
        for i, t in enumerate(beats(a + BAR * 3, b, 0.5)):
            if i % 4 in (1, 3):
                sc.add("drum", t, S.tang_drum(0.3 + 0.3 * (t - a) / L, pitch=190), 0.2)
    elif kind == "endcard":
        sc.add("metal", a, S.gong(0.55, base=110, dur=5, bend=-0.02), 0.0)
        sc.add("string", a, S.strings([36, 43, 48, 52, 55, 57, 60, 64], L + 1.0, 0.5, attack=0.2, release=2.5), 0.0)
        gliss(sc, a + 0.1, 60, 91, n=16, span=0.9, vel=0.4, up=False)
        sc.add("wind", a + BEAT * 3, S.dizi(S.midi_hz(72), max(1.5, L - BEAT * 4), 0.45), 0.2)
        sc.add("pluck", a + L * 0.55, S.pluck(S.midi_hz(60), 3.0, 0.45), -0.2)
        sc.add("pluck", a + L * 0.55 + 0.12, S.pluck(S.midi_hz(67), 3.0, 0.4), 0.0)
        sc.add("pluck", a + L * 0.55 + 0.24, S.pluck(S.midi_hz(72), 3.0, 0.4), 0.2)


KIND = {"opening": "opening", "title": "title", "founding": "founding", "motto": "motto", "littleworld": "littleworld",
        "interview": "interview", "writing": "writing", "verify": "verify", "editing": "editing", "mission": "mission",
        "legacy": "legacy", "endcard": "endcard"}


def snap_beat(t):
    return round(t / BEAT) * BEAT


def main():
    tl = json.load(open(sys.argv[1]))
    cues = json.load(open(sys.argv[2]))
    out = sys.argv[3]
    dur = tl["duration"]
    sc = Score(dur)
    scenes = tl["scenes"]
    bounds = []
    for i, s in enumerate(scenes):
        a = 0.0 if i == 0 else snap_beat(s["start"] + s["tin"] * 0.5)
        bounds.append(a)
    bounds.append(dur)
    for i, s in enumerate(scenes):
        a, b = bounds[i], bounds[i + 1]
        section(sc, KIND[s["id"]], a, b, s)
        print(f"  {s['id']:12s} {a:7.2f}-{b:7.2f}")
    # accents on the big visual hits
    for c in cues:
        if c["sfx"] in HIT_CUES:
            hit(sc, c["t"], HIT_CUES[c["sfx"]], gong=c["sfx"] in ("palmStrike", "doorCrash", "burstBell"))
    # mix the buses with reverb
    ir = S.make_ir(2.3)
    mix = np.zeros((sc.n, 2))
    wet = {"pluck": 0.3, "wind": 0.35, "string": 0.32, "drum": 0.18, "metal": 0.28}
    gain = {"pluck": 0.9, "wind": 0.75, "string": 0.6, "drum": 0.85, "metal": 0.55}
    for k, x in sc.bus.items():
        mix += S.reverb(x, ir, wet[k]) * gain[k]
    n = int(dur * SR)
    mix = mix[:n]
    # fade the very end
    f = int(2.0 * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5
    mix /= np.abs(mix).max() + 1e-9
    mix *= 0.8
    import soundfile as sf
    sf.write(out, mix.astype(np.float32), SR, subtype="FLOAT")
    print("music ->", out, f"{n / SR:.2f}s")


if __name__ == "__main__":
    main()
