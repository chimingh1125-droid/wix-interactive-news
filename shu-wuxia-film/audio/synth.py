"""Instrument synthesis for the original score (numpy, 48 kHz).

Everything is synthesised from scratch: no samples. Plucked strings use an
additive model of an ideal plucked string (harmonic amplitudes from the pluck
position, higher partials decaying faster, slight inharmonicity), the dizi
and erhu are additive with breath/bow noise, vibrato and portamento, drums
and gongs are modal (decaying partials + noise transients).
"""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(1956)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=np.float64)
    if a > 0:
        e[:min(a, n)] = np.linspace(0, 1, a)[:min(a, n)]
    if d > 0 and a < n:
        seg = min(d, n - a)
        e[a:a + seg] = np.linspace(1, s, d)[:seg]
    if r > 0:
        r = min(r, n)
        e[n - r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), "low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, f1, f2, order=2):
    b, a = signal.butter(order, [max(f1, 10) / (SR / 2), min(f2 / (SR / 2), 0.99)], "band")
    return signal.lfilter(b, a, x)


def noise(n):
    return RNG.standard_normal(n)


# ------------------------------------------------------------ plucked
_CACHE = {}


def cached(fn):
    """Memoise note renders on rounded arguments (the score repeats notes a lot)."""
    def wrap(*a, **k):
        key = (fn.__name__, tuple(round(x, 3) if isinstance(x, float) else x for x in a), tuple(sorted((kk, round(v, 3) if isinstance(v, float) else v) for kk, v in k.items())))
        if key not in _CACHE:
            _CACHE[key] = fn(*a, **k)
        return _CACHE[key].copy()
    wrap.__name__ = fn.__name__
    return wrap


@cached
def pluck(freq, dur, vel=1.0, pos=0.22, bright=1.0, decay=1.6, inharm=0.00012, body=True):
    """Guzheng / pipa like plucked string."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    kmax = int(min(28, (SR / 2 - 500) / freq))
    for k in range(1, kmax + 1):
        amp = abs(np.sin(np.pi * k * pos)) / (k ** (1.25 - 0.25 * bright))
        if amp < 1e-4:
            continue
        fk = freq * k * np.sqrt(1 + inharm * k * k)
        tau = decay / (1 + 0.035 * k * k / bright) * (1.0 if freq < 400 else 400 / freq * 0.8 + 0.2)
        out += amp * np.sin(2 * np.pi * fk * t + RNG.uniform(0, 6.28)) * np.exp(-t / tau)
    # pluck transient
    m = min(n, int(0.012 * SR))
    tr = noise(m) * np.linspace(1, 0, m) ** 2
    out[:m] += bandpass(tr, freq * 2, min(9000, freq * 14)) * 0.35 * bright
    if body:
        out += 0.12 * bandpass(out, 180, 520)
    a = min(n, int(0.002 * SR))
    out[:a] *= np.linspace(0, 1, a)
    out *= np.minimum(1, (n - np.arange(n)) / (0.03 * SR))
    return out * vel / (np.abs(out).max() + 1e-9)


def tremolo_pluck(freq, dur, vel=1.0, rate=14.0):
    """Pipa 輪指 tremolo: fast repeated plucks."""
    n = int(dur * SR)
    out = np.zeros(n + int(0.6 * SR))
    k = 0
    tt = 0.0
    while tt < dur:
        v = vel * (0.75 + 0.25 * np.sin(k * 1.7)) * (0.9 + 0.1 * RNG.random())
        p = pluck(freq, 0.5, v, pos=0.12, bright=1.3, decay=0.5, body=False)
        i = int(tt * SR)
        out[i:i + len(p)] += p
        tt += 1.0 / rate * (0.92 + 0.16 * RNG.random())
        k += 1
    fade = env_adsr(len(out), 0.02, 0.0, 1.0, 0.25)
    return out * fade * 0.45


# --------------------------------------------------------------- winds
def dizi(freq, dur, vel=1.0, vib=1.0, scoop=True):
    """Bamboo flute: bright harmonic tone + membrane buzz + breath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib_amt = 0.012 * vib * np.clip((t - 0.18) / 0.3, 0, 1)
    f = freq * (1 + vib_amt * np.sin(2 * np.pi * 5.6 * t))
    if scoop:
        f *= 1 - 0.03 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    amps = [1.0, 0.45, 0.28, 0.12, 0.09, 0.05, 0.04, 0.03]
    out = sum(a * np.sin((k + 1) * ph) for k, a in enumerate(amps) if freq * (k + 1) < SR / 2 - 1000)
    # membrane buzz: soft-clipped upper partials
    buzz = np.tanh(3 * np.sin(ph)) - np.sin(ph)
    out += 0.08 * highpass(buzz, 2500)
    br = bandpass(noise(n), freq * 0.9, min(freq * 6, 12000)) * 0.12
    out += br * (0.5 + 0.5 * np.exp(-t / 0.08))
    e = env_adsr(n, 0.05, 0.1, 0.85, min(0.12, dur * 0.3))
    return out * e * vel / (np.abs(out).max() + 1e-9)


def erhu(notes, vel=1.0):
    """Bowed two-string fiddle: notes = [(start_s, dur_s, midi)], legato with
    portamento between notes, strong vibrato, body formants."""
    total = max(s + d for s, d, m in notes) + 0.3
    n = int(total * SR)
    t = np.arange(n) / SR
    fcur = np.zeros(n)
    amp = np.zeros(n)
    for i, (s, d, m) in enumerate(notes):
        a, b = int(s * SR), int((s + d) * SR)
        fcur[a:b] = midi_hz(m)
        amp[a:b] = 1
        if i > 0:
            ps, pd, pm = notes[i - 1]
            if abs((ps + pd) - s) < 0.05:  # legato: slide
                g = int(0.07 * SR)
                fcur[a:a + g] = np.geomspace(midi_hz(pm), midi_hz(m), g)
    # fill gaps for continuity of phase
    last = midi_hz(notes[0][2])
    for i in range(n):
        if fcur[i] == 0:
            fcur[i] = last
        else:
            last = fcur[i]
    vib = 0.018 * np.sin(2 * np.pi * 6.0 * t) * np.clip(np.convolve(amp, np.ones(int(0.25 * SR)) / (0.25 * SR), "same") * 1.4 - 0.4, 0, 1)
    f = fcur * (1 + vib)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(n)
    for k in range(1, 18):
        fk = f * k
        # body formant weighting
        w = (1 / k) * (1 + 1.8 * np.exp(-((fk - 800) / 400) ** 2) + 1.2 * np.exp(-((fk - 2400) / 700) ** 2))
        out += w * np.sin(k * ph) * (fk < SR / 2 - 1000)
    out += 0.05 * bandpass(noise(n), 1500, 6000)  # bow noise
    sm = np.convolve(amp, np.ones(int(0.06 * SR)) / (0.06 * SR), "same")
    out *= sm
    return out * vel / (np.abs(out).max() + 1e-9)


# --------------------------------------------------------------- pads
def strings(midis, dur, vel=1.0, attack=0.5, release=0.8, bright=0.6):
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in midis:
        f0 = midi_hz(m)
        for dt in (-0.07, 0.0, 0.08):
            f = f0 * 2 ** (dt / 12)
            ph = 2 * np.pi * f * t + RNG.uniform(0, 6.28) + 0.3 * np.sin(2 * np.pi * 0.3 * t + RNG.uniform(0, 6))
            for k in range(1, 16):
                if f * k > 9000:
                    break
                out += (1 / k) * (bright ** (k - 1) * 0.9 + 0.1) * np.sin(k * ph)
    e = env_adsr(n, attack, 0.2, 0.9, release)
    out = lowpass(out, 5000)
    return out * e * vel / (np.abs(out).max() + 1e-9)


def drone(midis, dur, vel=1.0):
    return strings(midis, dur, vel, attack=1.2, release=1.5, bright=0.45)


# ----------------------------------------------------------- percussion
@cached
def big_drum(vel=1.0, pitch=62.0, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.9 * np.exp(-t / 0.035))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.45) + 0.35 * np.sin(1.52 * ph) * np.exp(-t / 0.18)
    hit = lowpass(noise(n), 1400) * np.exp(-t / 0.03) * 0.8
    out = body + hit
    return out * vel / (np.abs(out).max() + 1e-9)


@cached
def tang_drum(vel=1.0, pitch=170.0, dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.35 * np.exp(-t / 0.02))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16) + 0.4 * np.sin(1.6 * ph) * np.exp(-t / 0.07)
    slap = bandpass(noise(n), 800, 5000) * np.exp(-t / 0.012) * 0.7
    out = body + slap
    return out * vel / (np.abs(out).max() + 1e-9)


def gong(vel=1.0, base=110.0, dur=4.0, bend=-0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ratios = [1.0, 1.47, 2.09, 2.56, 3.13, 3.84, 4.51, 5.29]
    out = np.zeros(n)
    for i, r in enumerate(ratios):
        f = base * r * (1 + bend * (1 - np.exp(-t / 0.6)))
        ph = 2 * np.pi * np.cumsum(f) / SR + RNG.uniform(0, 6)
        tau = 2.6 / (1 + 0.35 * i)
        out += (0.9 ** i) * np.sin(ph) * np.exp(-t / tau) * (1 - np.exp(-t / (0.004 + 0.01 * i)))
    out += bandpass(noise(n), 1500, 9000) * np.exp(-t / 0.15) * 0.25
    return out * vel / (np.abs(out).max() + 1e-9)


def cymbal(vel=1.0, dur=2.0, swell=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = highpass(noise(n), 3000)
    parts = sum(np.sin(2 * np.pi * f * t + RNG.uniform(0, 6)) for f in RNG.uniform(3200, 9000, 24)) * 0.05
    x = x + parts
    if swell:
        e = (t / dur) ** 2.2
        e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    else:
        e = np.exp(-t / (dur * 0.35)) * (1 - np.exp(-t / 0.002))
    out = x * e
    return out * vel / (np.abs(out).max() + 1e-9)


@cached
def woodblock(vel=1.0, pitch=950.0):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    out = np.sin(2 * np.pi * pitch * t) * np.exp(-t / 0.025) + 0.5 * np.sin(2 * np.pi * pitch * 2.7 * t) * np.exp(-t / 0.012)
    out += bandpass(noise(n), 2000, 7000) * np.exp(-t / 0.004) * 0.4
    return out * vel / (np.abs(out).max() + 1e-9)


def bell(freq, dur=2.5, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ratios = [1.0, 2.0, 2.76, 5.4, 8.93]
    amps = [1.0, 0.5, 0.35, 0.18, 0.08]
    out = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (dur * 0.5 / (1 + i * 0.6))) for i, (r, a) in enumerate(zip(ratios, amps)))
    out *= 1 - np.exp(-t / 0.002)
    return out * vel / (np.abs(out).max() + 1e-9)


# --------------------------------------------------------------- reverb
def make_ir(rt60=2.2, sr=SR, pre=0.018, seed=7):
    rng = np.random.default_rng(seed)
    n = int(rt60 * 1.3 * sr)
    t = np.arange(n) / sr
    ir = np.zeros((n, 2))
    decay = np.exp(-6.9 * t / rt60)
    for c in range(2):
        x = rng.standard_normal(n) * decay
        x = lowpass(x, 7000) * 0.7 + lowpass(x, 2500) * 0.3
        ir[:, c] = x
    # early reflections
    for k in range(12):
        dt = pre + rng.uniform(0.005, 0.08)
        i = int(dt * sr)
        ir[i, rng.integers(0, 2)] += rng.uniform(0.3, 0.7) * np.exp(-dt / 0.2)
    ir[: int(pre * sr)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir


def reverb(x_stereo, ir, wet=0.3):
    out = np.zeros((x_stereo.shape[0] + ir.shape[0] - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x_stereo[:, c], ir[:, c])
    out = out[: x_stereo.shape[0]]
    return x_stereo * (1 - wet) + out * wet * 1.6


def pan(x, p):
    """Constant-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)
