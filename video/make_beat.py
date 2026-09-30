"""產生 120 BPM、30 秒的原創節拍音軌（純 Python，無外部依賴）。"""
import math, random, struct, wave

SR = 44100
BPM = 120
BEAT = 60 / BPM
DUR = 30.0
N = int(SR * DUR)
buf = [0.0] * N
random.seed(7)

def add(start, samples):
    i0 = int(start * SR)
    for k, s in enumerate(samples):
        if i0 + k < N:
            buf[i0 + k] += s

def kick(amp=0.9):
    out = []
    for k in range(int(0.35 * SR)):
        t = k / SR
        f = 45 + 110 * math.exp(-t * 30)
        out.append(amp * math.sin(2 * math.pi * f * t) * math.exp(-t * 9))
    return out

def snare(amp=0.45):
    return [amp * (random.uniform(-1, 1) * 0.8 + 0.4 * math.sin(2 * math.pi * 190 * k / SR)) * math.exp(-k / SR * 22)
            for k in range(int(0.2 * SR))]

def hat(amp=0.15):
    prev, out = 0.0, []
    for k in range(int(0.05 * SR)):
        n = random.uniform(-1, 1)
        out.append(amp * (n - prev) * math.exp(-k / SR * 90))
        prev = n
    return out

def bass(freq, length, amp=0.25):
    return [amp * math.tanh(2.5 * math.sin(2 * math.pi * freq * k / SR)) * min(1, k / 200) * math.exp(-k / SR * 3)
            for k in range(int(length * SR))]

def impact(amp=0.6):
    out = []
    for k in range(int(1.2 * SR)):
        t = k / SR
        out.append(amp * (math.sin(2 * math.pi * 38 * t) + 0.3 * random.uniform(-1, 1) * math.exp(-t * 8)) * math.exp(-t * 3))
    return out

def riser(length, amp=0.25):
    out = []
    for k in range(int(length * SR)):
        t = k / SR
        p = t / length
        out.append(amp * p * p * (random.uniform(-1, 1) * 0.6 + 0.4 * math.sin(2 * math.pi * (200 + 1200 * p * p) * t)))
    return out

roots = [55.0, 55.0, 65.41, 49.0]  # A1 A1 C2 G1
beats = int(DUR / BEAT)
for b in range(beats):
    t = b * BEAT
    intro = t < 4
    add(t, kick(1.0 if intro else 0.9))
    if not intro:
        if b % 4 in (1, 3):
            add(t, snare())
        add(t + BEAT / 2, hat())
        add(t + BEAT / 4, hat(0.07))
        add(t + BEAT * 0.75, hat(0.07))
        add(t, bass(roots[(b // 4) % 4], BEAT * 0.9))
        add(t + BEAT / 2, bass(roots[(b // 4) % 4] * 2, BEAT * 0.4, 0.12))

# 場景轉換重音 + 開場前的上升音效
for at in (4, 8, 14, 20, 25, 28):
    add(at, impact())
add(2.0, riser(2.0))
add(12.0, riser(2.0, 0.18))
add(26.0, riser(2.0, 0.18))

peak = max(abs(s) for s in buf)
with wave.open("beat.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(32000 * s / peak * (1 - max(0, (i / SR - (DUR - 0.5)) / 0.5)))) for i, s in enumerate(buf)))
print("beat.wav written")
