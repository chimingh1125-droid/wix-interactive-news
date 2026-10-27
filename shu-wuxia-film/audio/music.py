#!/usr/bin/env python3
"""Original wuxia-style score, arranged to the edit timeline.

A minor pentatonic (羽調: A C D E G) for the action, C major pentatonic (宮調,
same five notes) for the uplifting ending. 132 BPM on a continuous beat grid;
each scene gets its own arrangement (calm opening, title hit, heroic march,
playful motto, rooftop chase, battles, solemn night, emotional finale,
resolution) and big accents land exactly on the visual hits.

The 60-second cut runs at 133⅓ BPM (a 0.45 s beat) with beat 0 on its first
segment change, so each 9-second segment is exactly five bars and starts on a
downbeat; it has its own seven arrangements (p60_*).

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
GRID0 = 0.0   # time of beat 0
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


def set_grid(beat, t0=0.0):
    """Beat length in seconds and the time of beat 0."""
    global BPM, BEAT, BAR, GRID0
    BPM, BEAT, BAR, GRID0 = 60.0 / beat, beat, 4 * beat, t0


def at(b):
    """Time of grid beat b (fractions allowed)."""
    return GRID0 + b * BEAT


def beat_no(t):
    return round((t - GRID0) / BEAT)


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
    k = int(np.ceil((a - GRID0) / (BEAT * step) - 1e-9))
    out = []
    while GRID0 + k * BEAT * step < b - 1e-6:
        out.append(GRID0 + k * BEAT * step)
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
        bar = int(np.floor((t - GRID0) / BAR))
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
        bt = beat_no(t) % 4
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
        bt = beat_no(t) % 4
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


def timp_roll(sc, a, b, pitch=65.4, v0=0.15, v1=0.8, rate=12.0, p=-0.1):
    """Timpani roll from a to b, crescendo v0 -> v1."""
    n = max(1, int((b - a) * rate))
    for k in range(n):
        u = k / n
        sc.add("drum", a + (k + rng.uniform(-0.15, 0.15)) / rate, S.timpani(round(v0 + (v1 - v0) * u ** 1.5, 2), pitch, 1.2), p + 0.08 * (-1) ** k)


ARP = {45: (57, 60, 64, 67, 69, 67, 64, 60), 43: (55, 62, 64, 67, 69, 67, 64, 62),
       48: (60, 64, 67, 69, 72, 69, 67, 64), 50: (62, 64, 69, 72, 74, 72, 69, 64)}


def tech_arp(sc, a, b, roots, vel=(0.2, 0.45), bright=(0.3, 1.2), p=0.25):
    """Sixteenth-note saw arpeggio; level and brightness ramp across [a, b)."""
    for i, t in enumerate(beats(a, b, 0.25)):
        u = (t - a) / max(1e-6, b - a)
        root = roots[int(np.floor((t - a) / BAR + 1e-6)) % len(roots)]
        m = ARP[root][i % 8]
        v = (vel[0] + (vel[1] - vel[0]) * u) * (1.0 if i % 4 == 0 else 0.75)
        sc.add("pluck", t, S.synth_pluck(S.midi_hz(m), 0.32, round(v, 2), round(bright[0] + (bright[1] - bright[0]) * u, 1), 0.16), p * (1 if i % 2 else -1))


def spiccato(sc, a, b, roots, vel=0.4, pattern=(0, 0, 7, 0, 12, 0, 7, 0)):
    """Short, driving string eighths (the orchestral ostinato)."""
    for i, t in enumerate(beats(a, b, 0.5)):
        root = roots[int(np.floor((t - a) / BAR + 1e-6)) % len(roots)]
        acc = 1.0 if i % 4 == 0 else 0.7
        sc.add("string", hum(t, 0.004), S.strings([root + pattern[i % 8], root + pattern[i % 8] + 12], BEAT * 0.4, vel * acc, attack=0.015, release=0.12, bright=0.8), -0.15)


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
            sc.add("pluck", hum(t), S.pluck(S.midi_hz(45 if beat_no(t) % 4 == 0 else 40), 1.0, 0.5, pos=0.3, bright=0.6), -0.1)
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
            if beat_no(t) % 2 == 0:
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
    # ---------------------------------------- 60-second cut (beat 0 = 5.0 s)
    elif kind == "p60_open":
        # ink-wash drone and a brisk pipa: a sweep on the first picture, a run up
        # to the ink spreading, tremolos under the title, roll into segment one
        drone(sc, a, b + 0.6, [45, 52, 57], 0.24)
        for k, m in enumerate((45, 52, 57, 60, 64)):
            sc.add("pluck", 0.06 + k * 0.016, S.pluck(S.midi_hz(m), 1.8, 0.55, pos=0.12, bright=1.3, decay=1.0, body=False), -0.2 + 0.1 * k)
        line = [(-10.5, 69, .5), (-10, 72, .5), (-9.5, 74, .5), (-9, 76, .5), (-8.5, 79, .5), (-8, 81, 1, 1),
                (-7, 79, .5), (-6.5, 76, .5), (-6, 79, .5), (-5.5, 81, .5), (-5, 84, 1, 1),
                (-4, 81, .5), (-3.5, 79, .5), (-3, 76, .5), (-2.5, 74, .5), (-2, 76, 1.6, 1)]
        for nt in line:
            t, m, ln = at(nt[0]), nt[1], nt[2]
            if len(nt) > 3:
                sc.add("pluck", t, S.tremolo_pluck(S.midi_hz(m), ln * BEAT, 0.5, rate=16.0), 0.2)
            else:
                sc.add("pluck", hum(t, 0.004), S.pluck(S.midi_hz(m), 0.9, 0.5, pos=0.12, bright=1.2, decay=0.6, body=False), 0.2)
        zheng_arp(sc, at(-8), b, [45], pattern=(0, 7, 12, 15, 19, 15, 12, 7), step=0.5, vel=0.28, p=-0.3)
        for t in beats(at(-8), b - BEAT, 1):
            sc.add("metal", hum(t, 0.004), S.woodblock(0.3 if beat_no(t) % 2 else 0.4, pitch=1050 if beat_no(t) % 2 else 880), 0.35)
        roll(sc, b, BEAT * 2, 0.5)
        swell(sc, b, 1.4, 0.35)
    elif kind == "p60_qiao":
        # 重低音鼓點: a heartbeat while 喬峰 gathers his qi, a roll into the palm
        # strike, then a driving taiko groove over sub kicks and low power chords
        drone(sc, a, a + BAR + 0.6, [33, 40, 45], 0.3)
        for t in beats(a, a + BAR, 1):
            sc.add("drum", t, S.big_drum(0.55, pitch=50, dur=1.2), 0.0)
        roll(sc, at(3.5), BEAT * 1.5, 0.6)
        drums_taiko(sc, a + BAR, b - BEAT, 1.0)
        for t in beats(a + BAR, b - BEAT, 2):
            sc.add("drum", t, S.kick(0.75), 0.0)
        for i, t in enumerate(beats(a + BAR, b - BEAT, 0.5)):
            if i % 2:
                sc.add("drum", hum(t, 0.004), S.tang_drum(0.42 if i % 4 == 3 else 0.3, pitch=190), 0.25)
        for i, t in enumerate(beats(a + BAR, b, 4)):
            root = PROG_MINOR[i % 4] - 12
            sc.add("string", t, S.strings([root, root + 7, root + 12, root + 19, root + 24], BAR + 0.05, 0.45, attack=0.04, release=0.5, bright=0.8), 0.0)
            sc.add("drum", t, S.sub_bass(S.midi_hz(root), BAR * 0.95, 0.45), 0.0)
        play_phrase(sc, [(76, .5), (81, 1.5), (79, .5), (76, .5), (74, .5), (76, 2.5)], at(15.5), b - BEAT * 0.5, "dizi", vel=0.6, p=0.15)
        roll(sc, b, BEAT * 2, 0.55)
        swell(sc, b, 1.2, 0.35)
    elif kind == "p60_yang":
        # Tech Pulse: strings hold while the sword is drawn, a saw arpeggio fades
        # in and opens at the unlock, a four-on-the-floor kick and hats take over,
        # the zheng plays over the top; one beat of air before segment four
        bars = [45, 45, 48, 43, 45]
        sc.add("string", a, S.strings([45, 52, 57, 64], BAR * 2 + 0.2, 0.3, attack=0.3, release=1.0), 0.0)
        tech_arp(sc, a + BAR, a + BAR * 2, bars[1:2], vel=(0.12, 0.3), bright=(0.25, 0.6))
        tech_arp(sc, a + BAR * 2, b - BEAT, bars[2:], vel=(0.4, 0.5), bright=(1.0, 1.4))
        for t in beats(a + BAR * 2, b - BEAT, 1):
            sc.add("drum", t, S.kick(0.85), 0.0)
            sc.add("metal", hum(t + BEAT / 2, 0.003), S.hat(0.35, open_=beat_no(t) % 4 == 3), 0.3)
        for i, t in enumerate(beats(a + BAR * 2, b - BEAT, 0.5)):
            root = bars[2 + int((t - a - BAR * 2) // BAR) % 3]
            sc.add("drum", t, S.sub_bass(S.midi_hz(root - 12), BEAT * 0.45, 0.45 if i % 2 == 0 else 0.3), 0.0)
        pad_prog(sc, a + BAR * 2, b - BEAT, [48, 43, 45], 0.22)
        play_phrase(sc, PHRASE_B[:8], at(48.0), b - BEAT, "zheng", vel=0.48, p=-0.25)
        swell(sc, b, 1.0, 0.4)
    elif kind == "p60_linghu":
        # fast beat for the nine thrusts: running sixteenth drums, ticking hats,
        # a plucked bass ostinato, the pipa takes the theme after the landing
        drums_run(sc, a, b - BEAT, 0.8)
        for i, t in enumerate(beats(a, b - BEAT, 0.25)):
            sc.add("metal", hum(t, 0.003), S.hat(0.3 if i % 4 == 2 else 0.16), 0.35)
        bass = [45, 45, 57, 45, 48, 45, 50, 52]
        for i, t in enumerate(beats(a, b - BEAT, 0.5)):
            sc.add("pluck", hum(t, 0.004), S.pluck(S.midi_hz(bass[i % 8] - 12), 0.4, 0.45, pos=0.15, bright=0.8, decay=0.3), -0.2)
        pad_prog(sc, a, b, PROG_MINOR, 0.24)
        play_phrase(sc, PHRASE_B, a + BAR * 2, b - BEAT, "pipa", vel=0.5, p=0.3)
        roll(sc, b, BEAT * 2, 0.6)
        swell(sc, b, 1.2, 0.4)
    elif kind == "p60_zhang":
        # symphonic build: spiccato strings, brass swells and timpani over
        # Am-F-C-G, a timpani roll into the flare on the bar-five downbeat, then
        # the full orchestra on A minor with the erhu
        prog = [45, 41, 48, 43]
        spiccato(sc, a, a + BAR * 4, [r - 12 for r in prog], 0.36)
        for i, t in enumerate(beats(a, a + BAR * 4, 4)):
            r = prog[i]
            tri = [r, r + (3 if r == 45 else 4), r + 7]
            sc.add("string", t, S.strings([x - 12 for x in tri] + [x for x in tri], BAR + 0.1, 0.38, attack=0.25, release=0.5), 0.0)
            sc.add("drum", t, S.timpani(0.55 + 0.1 * i, S.midi_hz(r - 24), 1.8), -0.1)
            if i:
                sc.add("wind", t, S.brass([x for x in tri], BAR * 0.9, 0.3 + 0.1 * i, attack=BAR * 0.5, release=0.3), 0.1)
        play_phrase(sc, PHRASE_A[:9], a + BEAT * 2, a + BAR * 4, "erhu", vel=0.5, p=0.2)
        timp_roll(sc, a + BAR * 3, a + BAR * 4, pitch=S.midi_hz(33), v0=0.15, v1=0.85)
        swell(sc, a + BAR * 4, 1.6, 0.5)
        t = a + BAR * 4
        sc.add("string", t, S.strings([33, 40, 45, 52, 57, 60, 64, 69], b - t + 0.6, 0.6, attack=0.02, release=1.2, bright=0.8), 0.0)
        sc.add("wind", t, S.brass([45, 52, 57, 60, 64], b - t, 0.6, attack=0.05, release=0.8), 0.0)
        play_phrase(sc, [(76, .5), (79, .5), (81, 3)], t + BEAT * 0.5, b, "erhu", vel=0.7, p=0.15)
    elif kind == "p60_pass":
        # warm, soaring strings in C major; the erhu sings PHRASE_C; soft timpani
        # and a high string line lift into the night end card
        pad_prog(sc, a, b + 0.3, PROG_MAJOR, 0.4, voicing=[0, 7, 12, 16, 19])
        zheng_arp(sc, a, b, PROG_MAJOR, pattern=(0, 7, 12, 16, 19, 16, 12, 7), step=0.5, vel=0.28, p=-0.3)
        play_phrase(sc, PHRASE_C, a + BEAT, b, "erhu", vel=0.6, p=0.15)
        for i, t in enumerate(beats(a + BAR * 2, b, 4)):
            r = PROG_MAJOR[(i + 2) % 4]
            sc.add("string", t, S.strings([r + 24, r + 31], BAR + 0.2, 0.22 + 0.06 * i, attack=0.6, release=0.8, bright=0.7), 0.25)
            sc.add("drum", t, S.timpani(0.3 + 0.12 * i, S.midi_hz(r - 24), 1.8), -0.1)
        timp_roll(sc, b - BAR * 0.5, b, pitch=S.midi_hz(31), v0=0.1, v1=0.5)
        swell(sc, b, 1.6, 0.4)
    elif kind == "p60_end":
        # night: the temple bell (SFX) over a soft timpani roll and a held C chord,
        # the dizi under the narration, a timpani roll into the finale on bar five
        sc.add("string", a, S.strings([36, 43, 48, 52, 55, 60, 64], b - a + 1.0, 0.42, attack=0.5, release=2.0), 0.0)
        timp_roll(sc, a, a + BAR * 0.75, pitch=S.midi_hz(36), v0=0.45, v1=0.1)
        play_phrase(sc, [(72, 1), (74, .5), (76, .5), (79, 2), (76, 1), (74, 1), (72, 2)], a + BAR, a + BAR * 3.5, "dizi", vel=0.45, p=0.2)
        for t in (a + BAR, a + BAR * 2):
            sc.add("drum", t, S.timpani(0.3, S.midi_hz(36), 1.8), -0.1)
        timp_roll(sc, a + BAR * 3, a + BAR * 4, pitch=S.midi_hz(43), v0=0.15, v1=0.9)
        fin = a + BAR * 4
        sc.add("drum", fin, S.timpani(1.0, S.midi_hz(36), 2.4), 0.0)
        sc.add("string", fin, S.strings([36, 43, 48, 55, 60, 64, 67, 72], b - fin + 0.8, 0.6, attack=0.02, release=1.5, bright=0.75), 0.0)
        sc.add("wind", fin, S.brass([48, 55, 60, 64], b - fin, 0.5, attack=0.03, release=1.0), 0.0)
        gliss(sc, fin + 0.05, 60, 91, n=16, span=0.7, vel=0.4)


KIND = {"opening": "opening", "title": "title", "founding": "founding", "motto": "motto", "littleworld": "littleworld",
        "interview": "interview", "writing": "writing", "verify": "verify", "editing": "editing", "mission": "mission",
        "legacy": "legacy", "endcard": "endcard",
        "p60_open": "p60_open", "p60_qiao": "p60_qiao", "p60_yang": "p60_yang", "p60_linghu": "p60_linghu",
        "p60_zhang": "p60_zhang", "p60_pass": "p60_pass", "p60_end": "p60_end"}


def snap_beat(t):
    return GRID0 + round((t - GRID0) / BEAT) * BEAT


def main():
    tl = json.load(open(sys.argv[1]))
    cues = json.load(open(sys.argv[2]))
    out = sys.argv[3]
    dur = tl["duration"]
    short60 = tl.get("variant") == "60s"
    if short60:
        set_grid(0.45, tl["scenes"][1]["seg"][0])
    sc = Score(dur)
    scenes = tl["scenes"]
    bounds = []
    for i, s in enumerate(scenes):
        if short60:
            a = float(s["seg"][0])
        else:
            a = 0.0 if i == 0 else snap_beat(s["start"] + s["tin"] * 0.5)
        bounds.append(a)
    bounds.append(dur)
    for i, s in enumerate(scenes):
        a, b = bounds[i], bounds[i + 1]
        section(sc, KIND[s["id"]], a, b, s)
        print(f"  {s['id']:12s} {a:7.2f}-{b:7.2f}")
    # accents on the big visual hits (hits closer than 0.12 s merge into one)
    hits = []
    for c in cues:
        if c["sfx"] in HIT_CUES:
            h = [c["t"], HIT_CUES[c["sfx"]], c["sfx"] in ("palmStrike", "doorCrash", "burstBell")]
            near = [o for o in hits if abs(o[0] - h[0]) < 0.12]
            if near:
                near[0][1], near[0][2] = max(near[0][1], h[1]), near[0][2] or h[2]
            else:
                hits.append(h)
    for t, strength, gong in hits:
        hit(sc, t, strength, gong=gong)
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
    f = int((1.5 if short60 else 2.0) * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5
    mix /= np.abs(mix).max() + 1e-9
    mix *= 0.8
    import soundfile as sf
    sf.write(out, mix.astype(np.float32), SR, subtype="FLOAT")
    print("music ->", out, f"{n / SR:.2f}s")


if __name__ == "__main__":
    main()
