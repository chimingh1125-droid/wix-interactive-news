"""Synthesised sound effects (no samples) and cue placement.

Whooshes, wind, water and paper are spectrally shaped noise (STFT masks that
move over time); metal is inharmonic partials; impacts are pitched sine
drops plus filtered noise bursts.
"""
import numpy as np
from scipy import signal

import synth as S

SR = S.SR
rng = np.random.default_rng(1957)


def N(dur):
    return rng.standard_normal(int(dur * SR))


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def shaped(dur, fc, bw, env=None, floor=0.0):
    """Noise whose spectrum is a Gaussian band centred on fc(u), width bw(u),
    u = 0..1 over the duration."""
    n = int(dur * SR)
    x = rng.standard_normal(n + 2048)
    f, tt, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    u = np.clip(tt / dur, 0, 1)
    fcs = np.array([fc(v) for v in u])
    bws = np.array([bw(v) for v in u])
    mask = np.exp(-0.5 * ((f[:, None] - fcs[None, :]) / bws[None, :]) ** 2) + floor
    _, y = signal.istft(Z * mask, SR, nperseg=1024, noverlap=768)
    y = y[:n]
    if env is not None:
        y = y * env(np.arange(n) / n)
    return y / (np.abs(y).max() + 1e-9)


def ad(u, a=0.2, curve=2.0):
    """attack/decay envelope over u in [0,1] peaking at a."""
    return np.where(u < a, (u / a) ** 1.5, ((1 - u) / (1 - a)) ** curve)


def norm(x, g=1.0):
    return x / (np.abs(x).max() + 1e-9) * g


# ---------------------------------------------------------------- basics
def whoosh(dur=0.6, f0=400, f1=2600, peak=0.55, bw=0.5):
    return shaped(dur, lambda u: f0 + (f1 - f0) * u, lambda u: (f0 + (f1 - f0) * u) * bw + 80, lambda u: ad(u, peak, 1.6))


def thud(freq=80, dur=0.4, click=0.4):
    t = tvec(dur)
    f = freq * (1 + 0.8 * np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.3))
    x += S.lowpass(N(dur), 900) * np.exp(-t / 0.015) * click
    return norm(x)


def metal(freqs, dur=1.2, attack=0.001, bright=0.4):
    t = tvec(dur)
    x = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / (dur * 0.35 / (1 + i * 0.25))) for i, f in enumerate(freqs))
    x *= 1 - np.exp(-t / attack)
    x += S.highpass(N(dur), 3000) * np.exp(-t / 0.01) * bright
    return norm(x)


def tink(f, dur=0.08):
    t = tvec(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / (dur * 0.3))


def scatter(fn, dur, count, spread=None):
    out = np.zeros(int(dur * SR) + SR)
    for k in range(count):
        s = fn(k)
        i = int((spread(k) if spread else rng.uniform(0, dur)) * SR)
        m = min(len(s), len(out) - i)
        out[i:i + m] += s[:m]
    return norm(out[: int(dur * SR) + int(0.5 * SR)])


# -------------------------------------------------------------- library
def lib(name, dur=None):
    d = dur
    if name == "whooshUp":
        return whoosh(0.9, 300, 2600, 0.7, 0.45)
    if name in ("whooshSoft", "jump"):
        return whoosh(0.45, 700, 2200, 0.5) * (0.7 if name == "jump" else 1)
    if name == "whooshLong":
        return whoosh(1.4, 250, 1800, 0.35, 0.5)
    if name == "dash":
        return whoosh(0.35, 900, 4200, 0.75, 0.4)
    if name in ("step", "tap"):
        return norm(thud(90, 0.18, 0.3) * 0.7 + S.bandpass(N(0.18), 900, 4000) * np.exp(-tvec(0.18) / 0.02) * 0.4) * (0.8 if name == "tap" else 1)
    if name == "land":
        return norm(thud(70, 0.5, 0.6) + S.bandpass(N(0.5), 500, 3000) * np.exp(-tvec(0.5) / 0.06) * 0.5)
    if name in ("march", "crowdSteps"):
        dd = d or 2.0
        x = scatter(lambda k: lib("step") * rng.uniform(0.3, 0.8), dd, int(dd * (9 if name == "march" else 6)))
        if name == "crowdSteps":
            x = x + 0.25 * shaped(dd + 0.5, lambda u: 500, lambda u: 250, lambda u: np.ones_like(u))
        return norm(x)
    if name == "swordSwing":
        w = whoosh(0.5, 700, 3800, 0.45, 0.4)
        sh = metal([2950, 4210, 5380, 6890], 0.9, 0.004, 0.1)
        sh = np.concatenate([np.zeros(int(0.12 * SR)), sh])
        out = np.zeros(max(len(w), len(sh)))
        out[:len(w)] += w
        out[:len(sh)] += 0.55 * sh
        return norm(out)
    if name == "metalRing":
        return metal([1830, 2974, 4122, 5510, 7010], 1.8, 0.002, 0.05)
    if name == "clang":
        c = metal([1240, 2870, 4350, 5930], 1.0, 0.0008, 0.6)
        th = thud(160, 0.2, 0.8)
        c[: len(th)] += 0.5 * th
        return norm(c)
    if name == "swordStab":
        w = whoosh(0.2, 1500, 5200, 0.8, 0.35)
        c = metal([1540, 3120, 4700, 6300], 1.2, 0.0008, 0.7)
        out = np.zeros(len(c) + len(w))
        out[:len(w)] += 0.6 * w
        out[int(0.15 * SR):int(0.15 * SR) + len(c)] += c
        return norm(out)
    if name == "shatter":
        x = scatter(lambda k: tink(rng.uniform(3000, 9000), rng.uniform(0.03, 0.09)) * rng.uniform(0.3, 1), 0.7, 40, lambda k: abs(rng.normal(0, 0.18)))
        x[: int(0.05 * SR)] += S.highpass(N(0.05), 2000) * 0.8
        return norm(x)
    if name == "debris":
        return scatter(lambda k: (tink(rng.uniform(2500, 7000), 0.06) if k % 3 else thud(rng.uniform(150, 300), 0.12, 0.5)) * rng.uniform(0.2, 0.7), 1.3, 22, lambda k: k / 22 * 1.2)
    if name == "palmStrike":
        t = tvec(1.4)
        boom = np.sin(2 * np.pi * np.cumsum(70 * (0.5 + 0.8 * np.exp(-t / 0.08))) / SR) * np.exp(-t / 0.35)
        imp = S.lowpass(N(1.4), 2000) * np.exp(-t / 0.04)
        air = np.concatenate([whoosh(0.35, 400, 2000, 0.8), np.zeros(int(1.05 * SR))])[: len(t)]
        return norm(boom + 0.7 * imp + 0.3 * air)
    if name == "rockCrack":
        x = scatter(lambda k: S.bandpass(N(rng.uniform(0.005, 0.02)), 900, 6000) * rng.uniform(0.4, 1), 0.35, 14, lambda k: k * 0.02)
        return norm(x + 0.6 * np.pad(thud(100, 0.3, 0.6), (0, len(x) - int(0.3 * SR)))[: len(x)])
    if name == "rockCrumble":
        dd = 1.8
        rum = S.lowpass(N(dd), 180) * ad(np.arange(int(dd * SR)) / (dd * SR), 0.05, 1.5)
        grav = scatter(lambda k: S.bandpass(N(0.03), 700, 3500) * rng.uniform(0.2, 0.6), dd, 60, lambda k: (k / 60) ** 1.5 * dd)
        return norm(rum * 1.2 + grav[: len(rum)])
    if name == "qiCharge":
        dd = d or 1.0
        t = tvec(dd)
        u = t / dd
        tone = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.06 * u)) / SR) for f in (110, 165, 220, 330))
        trem = 1 + 0.3 * np.sin(2 * np.pi * (6 + 10 * u) * t)
        hiss = shaped(dd, lambda v: 300 + 3000 * v, lambda v: 400 + 1500 * v, None)
        return norm((tone * 0.4 + hiss * 0.6) * trem * (u ** 1.5))
    if name == "rumble":
        dd = d or 1.5
        u = tvec(dd) / dd
        return norm(S.lowpass(N(dd), 110) * (0.3 + u))
    if name == "dragonRoar":
        dd = 1.7
        t = tvec(dd)
        f0 = 120 * (1 - 0.35 * t / dd) * (1 + 0.03 * np.sin(2 * np.pi * 7 * t))
        ph = 2 * np.pi * np.cumsum(f0) / SR
        x = sum((1 / k) * np.sin(k * ph) for k in range(1, 30))
        x *= 1 + 0.6 * np.sin(2 * np.pi * 33 * t)  # growl
        x = S.lowpass(x, 2500) + 0.4 * shaped(dd, lambda u: 900 - 400 * u, lambda u: 500, None)
        e = ad(t / dd, 0.12, 1.3)
        octave = S.lowpass(np.sin(0.5 * ph) * (1 + 0.5 * np.sin(2 * np.pi * 21 * t)), 400)
        return norm((x + 0.6 * octave) * e)
    if name == "doorCrash":
        crack = scatter(lambda k: S.bandpass(N(0.02), 400, 3000) * rng.uniform(0.5, 1), 0.3, 10, lambda k: k * 0.025)
        boom = thud(55, 1.4, 0.9)
        out = np.zeros(len(boom) + int(0.5 * SR))
        out[:len(boom)] += boom
        out[:len(crack)] += crack * 0.8
        deb = lib("debris")
        out[int(0.2 * SR):int(0.2 * SR) + len(deb)] += deb[: len(out) - int(0.2 * SR)] * 0.4
        return norm(out)
    if name == "chime":
        out = S.bell(1760, 1.8, 1.0)
        b2 = S.bell(2637, 1.6, 0.7)
        j = int(0.08 * SR)
        out[j:j + len(b2)] += 0.6 * b2[: len(out) - j]
        return norm(out)
    if name == "chimeBig":
        out = np.zeros(int(2.8 * SR))
        for i, f in enumerate((1318.5, 1760, 2637, 3520)):
            b = S.bell(f, 2.4, 1 - i * 0.15)
            j = int(i * 0.07 * SR)
            out[j:j + len(b)] += b[: len(out) - j]
        return norm(out)
    if name == "burstBell":
        out = lib("chimeBig")
        sw = S.cymbal(0.5, 1.0, swell=True)
        o2 = np.zeros(len(out) + len(sw))
        o2[:len(sw)] += sw * 0.5
        o2[len(sw) - int(0.05 * SR):len(sw) - int(0.05 * SR) + len(out)] += out
        return norm(o2)
    if name == "phoneChime":
        t = tvec(0.9)
        x = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t / 0.18) + np.pad(np.sin(2 * np.pi * 1760 * t[: int(0.7 * SR)]) * np.exp(-t[: int(0.7 * SR)] / 0.25), (int(0.2 * SR), 0))[: len(t)]
        return norm(x)
    if name == "shimmer":
        dd = d or 1.5
        return scatter(lambda k: S.bell(rng.choice([1760, 1975.5, 2349.3, 2637, 3136, 3520]), 0.7, rng.uniform(0.3, 0.8)), dd, max(4, int(dd * 7)))
    if name == "rise":
        dd = 1.3
        t = tvec(dd)
        f = 400 * (6 ** (t / dd))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
        x *= ad(t / dd, 0.8, 1.2)
        return norm(x * 0.6 + lib("shimmer", dd)[: len(x)] * 0.5 + S.cymbal(0.6, dd, swell=True)[: len(x)] * 0.4)
    if name == "titleHit":
        t = tvec(2.5)
        boom = np.sin(2 * np.pi * np.cumsum(55 * (1 + 0.6 * np.exp(-t / 0.05))) / SR) * np.exp(-t / 0.7)
        ch = lib("chimeBig")[: len(t)]
        boom[: len(ch)] += 0.5 * ch
        return norm(boom)
    if name == "brushStroke":
        return shaped(0.3, lambda u: 3200 - 1500 * u, lambda u: 900, lambda u: ad(u, 0.25, 1.5)) * 0.8
    if name == "sealStamp":
        x = thud(120, 0.3, 0.5)
        x[: int(0.05 * SR)] += S.bandpass(N(0.05), 2000, 6000) * 0.5
        return norm(x)
    if name == "scrollUnroll":
        dd = 1.0
        am = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * tvec(dd))) * (0.6 + 0.4 * rng.random(int(dd * SR)))
        x = shaped(dd, lambda u: 3500, lambda u: 2000, lambda u: ad(u, 0.1, 1.2)) * am
        return norm(x + 0.3 * np.pad(thud(140, 0.25, 0.3), (0, int(0.75 * SR))))
    if name == "bookOpen":
        return norm(shaped(0.55, lambda u: 2000 + 1500 * u, lambda u: 1500, lambda u: ad(u, 0.3, 1.5)) + 0.4 * np.pad(thud(120, 0.2, 0.3), (int(0.3 * SR), int(0.05 * SR))))
    if name == "pageFlip":
        dd = 0.22
        return shaped(dd, lambda u: 4000 - 1000 * u, lambda u: 2200, lambda u: ad(u, 0.2, 1.3)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 40 * tvec(dd))))
    if name == "pageFlipFast":
        dd = d or 2.5
        return scatter(lambda k: lib("pageFlip") * rng.uniform(0.5, 0.9), dd, int(dd / 0.14), lambda k: k * 0.14)
    if name in ("paperFlutter", "flag"):
        dd = 0.5 if name == "paperFlutter" else 1.4
        rate = 18 if name == "paperFlutter" else 11
        am = np.abs(np.sin(2 * np.pi * rate * tvec(dd))) ** 2
        return shaped(dd, lambda u: 2600 if name == "paperFlutter" else 1400, lambda u: 1500, lambda u: ad(u, 0.2, 1.2)) * (0.3 + 0.7 * am)
    if name == "bigPaper":
        return norm(shaped(0.8, lambda u: 1500 + 2500 * u, lambda u: 1800, lambda u: ad(u, 0.4, 1.4)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 14 * tvec(0.8)))))
    if name in ("windSoft", "windGust", "stormWind", "bambooWind"):
        dd = d or (1.8 if name == "windGust" else 4.0)
        ph = rng.uniform(0, 6)
        fc = (lambda u: 600 + 400 * np.sin(2 * np.pi * u * dd / 3.0 + ph)) if name != "windGust" else (lambda u: 400 + 900 * np.sin(np.pi * u))
        env = (lambda u: 0.6 + 0.4 * np.sin(2 * np.pi * u * dd / 4.2 + ph)) if name != "windGust" else (lambda u: ad(u, 0.4, 1.5))
        x = shaped(dd, fc, lambda u: 350 if name != "stormWind" else 700, env)
        if name == "stormWind":
            x = x + 0.6 * shaped(dd, lambda u: 200, lambda u: 150, lambda u: 0.7 + 0.3 * np.sin(2 * np.pi * u * dd / 2.3))
        if name == "bambooWind":
            knocks = scatter(lambda k: S.woodblock(rng.uniform(0.2, 0.5), rng.uniform(500, 800))[: int(0.1 * SR)], dd, int(dd * 1.2))
            x = x + 0.35 * knocks[: len(x)]
        return norm(x)
    if name == "riverLoop":
        dd = d or 4.0
        bab = shaped(dd, lambda u: 1400, lambda u: 900, lambda u: np.ones_like(u))
        am = 0.6 + 0.4 * S.lowpass(rng.standard_normal(len(bab)), 12) / 0.1
        low = shaped(dd, lambda u: 250, lambda u: 150, lambda u: np.ones_like(u))
        blips = scatter(lambda k: tink(rng.uniform(500, 1500), 0.03) * 0.3, dd, int(dd * 12))
        return norm(bab * np.clip(am, 0.2, 1.5) * 0.7 + low * 0.5 + blips[: len(bab)] * 0.4)
    if name == "oceanLoop":
        dd = d or 6.0
        t = tvec(dd)
        swell = 0.35 + 0.65 * np.sin(np.pi * ((t / 4.6) % 1)) ** 2
        surf = shaped(dd, lambda u: 700, lambda u: 600, None) * swell
        hiss = shaped(dd, lambda u: 5000, lambda u: 2500, None) * swell * 0.3
        return norm(surf + hiss + 0.5 * S.lowpass(N(dd), 90))
    if name == "waveRise":
        return shaped(1.1, lambda u: 300 + 1300 * u, lambda u: 500 + 800 * u, lambda u: u ** 1.8)
    if name == "waveCrash":
        dd = 2.0
        t = tvec(dd)
        x = S.lowpass(N(dd), 3500) * np.exp(-t / 0.5) + shaped(dd, lambda u: 1200 - 700 * u, lambda u: 900, lambda u: np.exp(-u * 3)) * 0.8
        return norm(x + 0.5 * thud(60, dd, 0.3))
    if name == "heavySwing":
        return norm(whoosh(0.6, 150, 700, 0.6, 0.6) + 0.4 * shaped(0.6, lambda u: 90, lambda u: 60, lambda u: ad(u, 0.6, 1.5)))
    if name == "thunder":
        dd = 3.0
        t = tvec(dd)
        crack = S.bandpass(N(0.25), 400, 5000) * np.exp(-tvec(0.25) / 0.05)
        rum = S.lowpass(N(dd), 140) * (np.exp(-t / 1.2) * (1 + 0.5 * np.sin(2 * np.pi * 1.7 * t)))
        rum[: len(crack)] += crack
        return norm(rum)
    if name == "eagleCry":
        out = np.zeros(int(1.5 * SR))
        for k, st in enumerate((0.0, 0.62)):
            dd = 0.55
            t = tvec(dd)
            f = (2600 - 900 * (t / dd) ** 0.7) * (1 + 0.02 * np.sin(2 * np.pi * 28 * t))
            x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
            x = x * ad(t / dd, 0.12, 1.2) + S.bandpass(N(dd), 2000, 5000) * 0.15 * ad(t / dd, 0.1, 2)
            i = int(st * SR)
            out[i:i + len(x)] += x * (1 if k == 0 else 0.7)
        return norm(out)
    if name == "craneCall":
        out = np.zeros(int(1.0 * SR))
        for st, f0 in ((0.0, 1250), (0.34, 1050)):
            dd = 0.28
            t = tvec(dd)
            f = f0 * (1 + 0.05 * np.sin(np.pi * t / dd))
            x = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)) * ad(t / dd, 0.2, 1.3)
            out[int(st * SR):int(st * SR) + len(x)] += x
        return norm(out)
    if name == "wingFlap":
        return scatter(lambda k: whoosh(0.2, 150, 500, 0.4, 0.8) * (1 - k * 0.15), 1.0, 4, lambda k: k * 0.25)
    if name in ("birds", "dawnAmb"):
        dd = d or (1.6 if name == "birds" else 5.0)
        ch = scatter(lambda k: np.sin(2 * np.pi * np.cumsum(np.linspace(rng.uniform(2500, 4000), rng.uniform(3000, 5200), int(0.07 * SR))) / SR) * np.hanning(int(0.07 * SR)), dd, int(dd * (6 if name == "birds" else 3)))
        if name == "dawnAmb":
            ch = ch[: int(dd * SR)] * 0.8 + 0.3 * lib("riverLoop", dd)[: int(dd * SR)]
        return norm(ch)
    if name == "nightAmb":
        dd = d or 6.0
        t = tvec(dd)
        pulses = (np.sin(2 * np.pi * 30 * t) > 0.3) * (np.sin(2 * np.pi * 2.1 * t) > 0.2)
        jit = 0.004 * np.sin(2 * np.pi * 0.7 * t) + 0.002 * np.sin(2 * np.pi * 3.1 * t)
        soft = S.lowpass(pulses.astype(float), 180)
        cr = np.sin(2 * np.pi * 4600 * np.cumsum(1 + jit) / SR) * soft * 0.1
        g2 = S.lowpass(((np.sin(2 * np.pi * 26 * t + 1) > 0.4) * (np.sin(2 * np.pi * 1.6 * t + 2) > 0.3)).astype(float), 160)
        cr2 = np.sin(2 * np.pi * 5150 * np.cumsum(1 - jit) / SR) * g2 * 0.06
        return norm(cr + cr2 + 0.5 * lib("windSoft", dd)[: len(t)])
    if name == "torchLoop":
        dd = d or 4.0
        cr = scatter(lambda k: S.bandpass(N(0.01), 1500, 6000) * rng.uniform(0.2, 1), dd, int(dd * 25))
        roar = shaped(dd, lambda u: 250, lambda u: 150, None)
        return norm(cr[: len(roar)] * 0.7 + roar * 0.5)
    if name == "townAmb":
        dd = d or 5.0
        return shaped(dd, lambda u: 450, lambda u: 250, lambda u: 0.7 + 0.3 * np.sin(2 * np.pi * u * dd / 1.7)) * 0.7
    if name == "pressLoop":
        dd = d or 5.0
        def clack(k):
            c = S.woodblock(0.9, 700)[: int(0.12 * SR)] + 0.5 * thud(110, 0.12, 0.4)
            return c * (1 if k % 2 == 0 else 0.6)
        return scatter(clack, dd, int(dd / 0.36), lambda k: k * 0.36)
    if name in ("bladeSwirl", "swirlLoop"):
        dd = d or 3.0
        t = tvec(dd)
        rate = 1.5 + 3.5 * (t / dd)
        am = 0.4 + 0.6 * np.abs(np.sin(np.pi * np.cumsum(rate) / SR))
        x = shaped(dd, lambda u: 700 + 900 * u, lambda u: 500, lambda u: 0.3 + 0.7 * u) * am
        return norm(x)
    if name == "snap":
        return norm(S.woodblock(1.0, 1400)[: int(0.1 * SR)])
    if name == "bowCreak":
        dd = 1.4
        t = tvec(dd)
        f = 55 + 20 * np.abs(S.lowpass(rng.standard_normal(len(t)), 8)) * 8
        x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.3 + 0.7 * rng.random(len(t)) ** 4)
        return norm(S.bandpass(x, 200, 2500) * ad(t / dd, 0.7, 1.5))
    if name == "bowRelease":
        p = S.pluck(98, 0.8, 1.0, pos=0.1, bright=0.6, decay=0.3)
        return norm(p + 0.5 * thud(90, 0.8, 0.4))
    if name == "arrowWhoosh":
        return whoosh(0.8, 3200, 700, 0.25, 0.3)
    if name == "writing":
        dd = d or 3.0
        return scatter(lambda k: shaped(0.1, lambda u: 3000, lambda u: 1200, lambda u: ad(u, 0.3, 1.2)) * rng.uniform(0.3, 0.8), dd, int(dd * 5))
    if name == "swordPlace":
        return norm(metal([2100, 3350, 4900], 0.6, 0.001, 0.3) * 0.6 + np.pad(thud(130, 0.3, 0.5), (0, int(0.3 * SR))))
    raise KeyError(name)


def build(cues, dur, sr=SR):
    out = np.zeros((int((dur + 3) * sr), 2))
    missing = set()
    for c in cues:
        try:
            x = lib(c["sfx"], c.get("dur"))
        except KeyError:
            missing.add(c["sfx"])
            continue
        x = np.nan_to_num(x) * c.get("gain", 1.0)
        st = S.pan(x, max(-1, min(1, c.get("pan", 0.0))))
        i = int(c["t"] * sr)
        if i < 0:
            st = st[-i:]
            i = 0
        m = min(len(st), len(out) - i)
        out[i:i + m] += st[:m]
    if missing:
        print("missing sfx:", sorted(missing))
    return out[: int(dur * sr)]
