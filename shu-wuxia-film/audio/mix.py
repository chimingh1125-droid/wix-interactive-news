#!/usr/bin/env python3
"""Final mix: narration + score + sound effects.

 - every narration clip is loudness-matched and placed at its timeline slot,
 - music (and, gently, SFX) duck automatically while the narrator speaks,
 - the sum is normalised to -15 LUFS integrated (ITU-R BS.1770 / EBU R128)
   with a true-peak limiter at -1.5 dBTP,
 - a second mix without narration (music + SFX) is normalised the same way.

    python mix.py <timeline.json> <music.wav> <cues.json> <out_prefix>
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import synth as S  # noqa: E402
import sfx as X  # noqa: E402

SR = S.SR
TARGET = -15.0
METER = pyln.Meter(SR)


def lufs(x):
    return METER.integrated_loudness(x if x.ndim == 2 else np.stack([x, x], 1))


def to_lufs(x, target):
    return x * 10 ** ((target - lufs(x)) / 20)


def narration(tl):
    n = int(tl["duration"] * SR)
    vo = np.zeros(n)
    for sc in tl["scenes"]:
        for ln in sc["lines"]:
            y, sr = sf.read(os.path.join(ROOT, ln["file"]))
            y = signal.resample_poly(y, SR // 1000, sr // 1000)
            y = S.highpass(y, 75)
            # gentle presence lift for clarity
            y = y + 0.18 * S.bandpass(y, 2200, 5000)
            y = to_lufs(np.stack([y, y], 1), -18.0)[:, 0]
            i = int(ln["abs0"] * SR)
            m = min(len(y), n - i)
            vo[i:i + m] += y[:m]
    # small room ambience so the voice sits in the picture
    st = np.stack([vo, vo], 1)
    st = S.reverb(st, S.make_ir(0.9, seed=3), 0.07)
    return st


def voice_activity(vo, attack=0.06, release=0.45):
    """0..1 envelope that is 1 while the narrator speaks (with look-ahead)."""
    blk = int(0.01 * SR)
    nb = len(vo) // blk + 1
    x = np.pad(vo[:, 0], (0, nb * blk - len(vo)))
    rms = np.sqrt((x.reshape(nb, blk) ** 2).mean(1) + 1e-12)
    act = (20 * np.log10(rms + 1e-9) > -45).astype(float)
    # bridge short pauses inside a line and anticipate the onset
    act = ndimage.maximum_filter1d(act, size=int(0.5 / 0.01), origin=0)
    look = int(0.15 / 0.01)
    act = np.maximum(act, np.concatenate([act[look:], np.zeros(look)]))
    out = np.zeros_like(act)
    a_c, r_c = 1 - np.exp(-0.01 / attack), 1 - np.exp(-0.01 / release)
    v = 0.0
    for i, a in enumerate(act):
        v += (a - v) * (a_c if a > v else r_c)
        out[i] = v
    env = np.repeat(out, blk)[: len(vo)]
    return env


def limiter(x, ceiling_db=-1.5, release=0.12):
    ceil = 10 ** (ceiling_db / 20)
    over = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(over).max(axis=1)
    pk = pk[: len(x) * 4].reshape(len(x), 4).max(axis=1)
    g_t = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    look = int(0.005 * SR)
    g = ndimage.minimum_filter1d(g_t, size=2 * look + 1)
    g = np.convolve(g, np.ones(look) / look, mode="same")
    # slow release
    step = 1.0 / (release * SR)
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else min(g[i], cur + step)
        out[i] = cur
    return x * out[:, None]


def true_peak_db(x):
    over = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(over).max() + 1e-12)


def master(x):
    x = to_lufs(x, TARGET)
    for _ in range(3):
        x = limiter(x)
        l = lufs(x)
        if abs(l - TARGET) < 0.15:
            break
        x = x * 10 ** ((TARGET - l) / 20)
    x = limiter(x)
    return x


def main():
    tl = json.load(open(sys.argv[1]))
    music, sr = sf.read(sys.argv[2])
    assert sr == SR
    cues = json.load(open(sys.argv[3]))
    prefix = sys.argv[4]
    n = int(tl["duration"] * SR)
    music = np.pad(music, ((0, max(0, n - len(music))), (0, 0)))[:n]
    fx = X.build(cues, tl["duration"])
    fx = S.reverb(fx, S.make_ir(1.2, seed=5), 0.12)
    vo = narration(tl)
    # stem balance before ducking
    music = to_lufs(music, -20.5)
    fx = to_lufs(fx, -23.0)
    act = voice_activity(vo)
    duck_music = 10 ** (-14.0 * act / 20)
    duck_fx = 10 ** (-8.0 * act / 20)
    bg = music * duck_music[:, None] + fx * duck_fx[:, None]
    full = vo + bg
    # narration-to-background ratio per line (QA)
    ratios = []
    for sc in tl["scenes"]:
        for ln in sc["lines"]:
            a, b = int(ln["abs0"] * SR), int(ln["abs1"] * SR)
            rv = np.sqrt((vo[a:b] ** 2).mean()); rb = np.sqrt((bg[a:b] ** 2).mean())
            ratios.append((ln["id"], 20 * np.log10(rv / (rb + 1e-12))))
    print("voice/background dB per line:", " ".join(f"{i}:{r:.1f}" for i, r in ratios))
    print(f"min {min(r for _, r in ratios):.1f} dB, mean {np.mean([r for _, r in ratios]):.1f} dB")
    novo = music + fx
    full = master(full)
    novo = master(novo)
    for tag, x in (("", full), ("_novo", novo)):
        path = f"{prefix}{tag}.wav"
        sf.write(path, x.astype(np.float32), SR, subtype="PCM_24")
        print(f"{path}: {lufs(x):.2f} LUFS, true peak {true_peak_db(x):.2f} dBTP, {len(x) / SR:.2f}s")
    # stems for reference / QA
    sf.write(f"{prefix}_stem_vo.wav", vo.astype(np.float32), SR, subtype="PCM_24")
    print("ducking: music -14 dB, sfx -8 dB while narration plays")


if __name__ == "__main__":
    main()
