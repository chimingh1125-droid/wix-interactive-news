#!/usr/bin/env python3
"""反選舉噪音污染 9:16 短影音產生器。

節奏參考：128 BPM、每拍一個切點、中段八分音符快切、breakdown 後 drop、
最後一拍靜音再重擊收尾。畫面與配樂都由本程式產生（配樂為自行合成）。

用法：
    pip install pillow numpy scipy
    python3 render.py            # 輸出 anti-election-noise.mp4
    python3 render.py --stills   # 只輸出關鍵影格預覽 build/stills.png
"""
import math
import os
import subprocess
import sys
import urllib.request
import wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
OUT = os.path.join(HERE, "anti-election-noise.mp4")

W, H, FPS = 1080, 1920, 30
BPM = 128.0
B = 60.0 / BPM  # 0.46875 s
DUR = 30.0
NF = int(DUR * FPS)


def bt(k):
    return k * B


# 段落時間（拍）
SEC_B, SEC_C, SEC_D, SEC_E, SEC_F = bt(8), bt(16), bt(24), bt(32), bt(40)
HIT, SEC_G, SILENT, FINAL = bt(44), bt(48), bt(55), bt(56)

# ---------------------------------------------------------------- fonts
FONT_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/{}"
FONT_FILES = {
    "black": ("NotoSansTC-Black.otf", "Sans/SubsetOTF/TC/NotoSansTC-Black.otf"),
    "bold": ("NotoSansTC-Bold.otf", "Sans/SubsetOTF/TC/NotoSansTC-Bold.otf"),
    "serif": ("NotoSerifTC-Black.otf", "Serif/SubsetOTF/TC/NotoSerifTC-Black.otf"),
}
FONT_DIR = os.path.join(HERE, "fonts")


def ensure_fonts():
    os.makedirs(FONT_DIR, exist_ok=True)
    for name, remote in FONT_FILES.values():
        path = os.path.join(FONT_DIR, name)
        if not os.path.exists(path):
            print("downloading", name)
            urllib.request.urlretrieve(FONT_URL.format(remote), path)


ensure_fonts()


@lru_cache(None)
def F(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[name][0]), int(size))


# ---------------------------------------------------------------- palette
BLACK = (13, 13, 15)
GRID = (40, 40, 45)
RED = (200, 38, 30)
RED_D = (168, 26, 20)
YEL = (255, 198, 41)
WHT = (247, 245, 240)
INK = (22, 20, 18)
CREAM = (240, 234, 220)
SEAL = (190, 24, 36)
NAVY = (14, 16, 30)

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lin(t, t0, t1):
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def e_out(x):
    return 1 - (1 - x) ** 3


def e_in(x):
    return x ** 3


def e_io(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def e_back(x, s=1.9):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def pulse(t, t0, decay):
    return math.exp(-(t - t0) / decay) if t >= t0 else 0.0


def last_beat(t, beats):
    """最近一次已發生的拍點時間（秒）。"""
    best = None
    for k in beats:
        if bt(k) <= t:
            best = bt(k)
    return best


# ---------------------------------------------------------------- tiles
@lru_cache(maxsize=8000)
def ctile(text, fn, size, fill, track=0, stroke=0, sfill=None):
    """文字貼圖：以字身中心定位，逐字繪製以便字距控制。"""
    size = max(4, int(size))
    f = F(fn, size)
    adv = [f.getlength(ch) for ch in text]
    w = int(sum(adv) + track * (len(text) - 1)) + 2 * (stroke + 6)
    h = int(size * 1.36) + 2 * stroke
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = stroke + 6
    for ch, a in zip(text, adv):
        d.text((x + a / 2, h / 2), ch, font=f, fill=fill, anchor="mm",
               stroke_width=stroke, stroke_fill=sfill)
        x += a + track
    return im


def comp(canvas, tile, x, y):
    cw, ch = canvas.size
    tw, th = tile.size
    x0, y0, x1, y1 = max(0, x), max(0, y), min(cw, x + tw), min(ch, y + th)
    if x1 <= x0 or y1 <= y0:
        return
    if (x0, y0, x1, y1) != (x, y, x + tw, y + th):
        tile = tile.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    canvas.alpha_composite(tile, (x0, y0))


@lru_cache(256)
def _alpha_lut(a):
    return [int(v * a / 255) for v in range(256)]


def fade(tile, a):
    if a >= 0.999:
        return tile
    t = tile.copy()
    t.putalpha(t.getchannel("A").point(_alpha_lut(int(a * 255))))
    return t


def put(canvas, tile, cx, cy, s=1.0, rot=0.0, a=1.0, sx=1.0, sy=1.0):
    if tile is None or a <= 0.004 or s <= 0.01:
        return
    t = tile
    fx, fy = s * sx, s * sy
    if abs(fx - 1) > 1e-3 or abs(fy - 1) > 1e-3:
        t = t.resize((max(1, round(t.width * fx)), max(1, round(t.height * fy))), Image.BICUBIC)
    if abs(rot) > 0.05:
        t = t.rotate(rot, resample=Image.BICUBIC, expand=True)
    t = fade(t, a)
    comp(canvas, t, int(round(cx - t.width / 2)), int(round(cy - t.height / 2)))


def put_text(canvas, text, fn, size, fill, cx, cy, s=1.0, a=1.0, rot=0.0, track=0, stroke=0, sfill=None):
    """以目標字級重新點陣化，避免放大模糊。"""
    sz = max(4, int(round(size * s / 2) * 2))
    tile = ctile(text, fn, sz, fill, int(track * s), int(stroke * s), sfill)
    put(canvas, tile, cx, cy, 1.0, rot, a)


STY = {
    "w": (WHT, INK, None),
    "k": ((22, 22, 24), WHT, WHT),
    "y": (YEL, INK, None),
    "r": (RED, WHT, None),
    "o": (None, WHT, WHT),
    "d": (None, (226, 96, 86), (226, 96, 86)),
}


@lru_cache(None)
def pill(text, style, size=44, tail=False, radius=None):
    bg, fg, border = STY[style]
    f = F("bold", size)
    tw = f.getlength(text)
    padx, pady = int(size * 0.62), int(size * 0.34)
    w, h = int(tw + 2 * padx), int(size * 1.12 + 2 * pady)
    th = int(size * 0.5) if tail else 0
    im = Image.new("RGBA", (w + 10, h + 10 + th), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = radius if radius is not None else h // 2
    d.rounded_rectangle((5, 5, 5 + w, 5 + h), radius=r, fill=bg,
                        outline=border, width=4 if border else 0)
    if tail:
        tx = 5 + int(w * 0.26)
        d.polygon([(tx, 5 + h - 4), (tx + th * 1.3, 5 + h - 4), (tx - th * 0.2, 5 + h + th)],
                  fill=bg if bg else border)
    d.text((5 + w / 2, 5 + h / 2), text, font=f, fill=fg, anchor="mm")
    return im


# ---------------------------------------------------------------- backgrounds
def dot_bg(color, dot, step=40, r=2):
    im = Image.new("RGBA", (W, H), color + (255,))
    d = ImageDraw.Draw(im)
    for y in range(step // 2, H, step):
        for x in range(step // 2, W, step):
            d.ellipse((x - r, y - r, x + r, y + r), fill=dot)
    return im


BG_BLACK = dot_bg(BLACK, GRID)
BG_RED = dot_bg(RED, (178, 30, 24))
BG_RED_TAGS = BG_RED.copy()
_rng = np.random.default_rng(7)
_tag_words = ["宣傳車", "擴音器", "鞭炮", "催票", "凍蒜", "拜票", "造勢", "遊行", "大聲公",
              "掃街", "07:00", "23:00", "鑼鼓", "最後衝刺", "懇請支持", "感謝鄉親"]
for gy in range(5):
    for gx in range(3):
        word = _tag_words[(gy * 3 + gx) % len(_tag_words)]
        cx = 190 + gx * 350 + int(_rng.integers(-30, 30))
        cy = 230 + gy * 360 + int(_rng.integers(-40, 40))
        put(BG_RED_TAGS, pill(word, "d", 34), cx, cy, a=0.55)


def make_city():
    rng = np.random.default_rng(11)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for layer, (base, shade, top) in enumerate([(820, (28, 30, 50), 0.22), (1040, (20, 22, 38), 0.36)]):
        x = -40
        while x < W + 40:
            bw = int(rng.integers(90, 210))
            bh = int(rng.integers(260, 720))
            y0 = base + int(rng.integers(-120, 160)) if layer == 0 else base + int(rng.integers(-60, 200))
            d.rectangle((x, y0, x + bw, H), fill=shade + (255,))
            for wy in range(y0 + 26, H - 380, 44):
                for wx in range(x + 16, x + bw - 22, 34):
                    if rng.random() < top:
                        c = (255, 206, 120, int(rng.integers(150, 235)))
                    else:
                        c = (42, 44, 66, 255) if layer == 0 else (34, 36, 54, 255)
                    d.rectangle((wx, wy, wx + 16, wy + 22), fill=c)
            x += bw + int(rng.integers(6, 26))
    # 街道
    d.rectangle((0, 1560, W, H), fill=(18, 18, 26, 255))
    for i in range(0, W, 120):
        d.rectangle((i + 20, 1700, i + 80, 1712), fill=(70, 70, 84, 255))
    # 競選旗幟（無特定政黨）
    flags = [(90, "凍蒜", RED), (300, "拜託", YEL), (520, "支持", WHT), (760, "衝刺", RED), (980, "凍蒜", YEL)]
    for fx, txt, col in flags:
        d.rectangle((fx - 3, 1180, fx + 3, 1580), fill=(120, 120, 132, 255))
        d.rectangle((fx + 3, 1200, fx + 83, 1440), fill=col + (255,))
        fg = WHT if col == RED else INK
        for k, ch in enumerate(txt):
            d.text((fx + 43, 1268 + k * 96), ch, font=F("black", 70), fill=fg, anchor="mm")
    return im


CITY = make_city()


def vgrad(top, bottom):
    a = np.linspace(0, 1, H)[:, None, None]
    arr = (np.array(top)[None, None, :] * (1 - a) + np.array(bottom)[None, None, :] * a)
    arr = np.repeat(arr, W, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


BG_NIGHT = vgrad((10, 12, 26), (38, 26, 44))


def make_paper():
    rng = np.random.default_rng(3)
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    light = 1.0 + 0.05 * np.clip(0.55 - r, 0, None) / 0.55 - 0.10 * np.clip(r - 0.35, 0, None)
    base = np.array(CREAM, dtype=np.float32)[None, None, :] * light[..., None]
    grain = rng.normal(0, 3.0, (H, W, 1)).astype(np.float32)
    arr = np.clip(base + grain, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


BG_PAPER = make_paper()


def make_vignette(strength):
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    return np.clip(1 - strength * np.clip(r - 0.45, 0, None) ** 1.5, 0.05, 1).astype(np.float32)[..., None]


VIG = make_vignette(1.25)

# ---------------------------------------------------------------- icons
def megaphone_tile(col=WHT):
    im = Image.new("RGBA", (420, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(150, 128), (318, 46), (318, 274), (150, 192)], fill=col)
    d.rounded_rectangle((70, 118, 160, 202), radius=18, fill=col)
    d.rounded_rectangle((300, 36, 342, 284), radius=20, fill=col)
    d.polygon([(168, 196), (206, 196), (226, 282), (186, 282)], fill=col)
    d.rounded_rectangle((40, 140, 82, 180), radius=10, fill=col)
    return im


MEGA = megaphone_tile()


def headphones_tile(col=INK):
    im = Image.new("RGBA", (360, 340), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.arc((40, 20, 320, 300), 180, 360, fill=col, width=34)
    d.rectangle((40, 150, 74, 210), fill=col)
    d.rectangle((286, 150, 320, 210), fill=col)
    d.rounded_rectangle((18, 170, 112, 320), radius=34, fill=col)
    d.rounded_rectangle((248, 170, 342, 320), radius=34, fill=col)
    return im


HEADPHONES = headphones_tile()


def sheep_tile(wolf=False):
    im = Image.new("RGBA", (760, 720), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dark = (30, 28, 32) if wolf else (58, 54, 60)
    for lx in (290, 440):
        d.rounded_rectangle((lx, 460, lx + 34, 600), radius=12, fill=dark)
    wool = (238, 236, 230) if wolf else WHT
    cx, cy = 380, 330
    for k in range(14):
        a = k / 14 * 2 * math.pi
        x = cx + 236 * math.cos(a)
        y = cy + 160 * math.sin(a)
        d.ellipse((x - 92, y - 92, x + 92, y + 92), fill=wool)
    d.ellipse((cx - 250, cy - 175, cx + 250, cy + 175), fill=wool)
    if wolf:
        for sgn in (-1, 1):
            d.polygon([(cx + sgn * 40, 300), (cx + sgn * 120, 150), (cx + sgn * 130, 320)], fill=dark)
            d.polygon([(cx + sgn * 70, 280), (cx + sgn * 112, 196), (cx + sgn * 116, 300)], fill=(90, 40, 44))
        d.ellipse((cx - 112, 300, cx + 112, 500), fill=dark)
        d.polygon([(cx - 70, 440), (cx + 70, 440), (cx + 30, 560), (cx - 30, 560)], fill=dark)
        d.ellipse((cx - 22, 532, cx + 22, 566), fill=(10, 10, 10))
        for k in range(5):
            x0 = cx - 50 + k * 20
            d.polygon([(x0, 492), (x0 + 20, 492), (x0 + 10, 520)], fill=WHT)
    else:
        for sgn in (-1, 1):
            d.ellipse((cx + sgn * 150 - 62, 330, cx + sgn * 150 + 62, 372), fill=dark)
        d.ellipse((cx - 104, 300, cx + 104, 540), fill=dark)
        for sgn in (-1, 1):
            ex = cx + sgn * 40
            d.ellipse((ex - 22, 382, ex + 22, 426), fill=WHT)
            d.ellipse((ex - 9 + sgn * 3, 396, ex + 11 + sgn * 3, 420), fill=(10, 10, 10))
        d.arc((cx - 30, 460, cx, 494), 20, 160, fill=(200, 196, 190), width=5)
        d.arc((cx, 460, cx + 30, 494), 20, 160, fill=(200, 196, 190), width=5)
        for k, (x, y) in enumerate([(cx - 52, 296), (cx, 280), (cx + 52, 296)]):
            d.ellipse((x - 48, y - 48, x + 48, y + 48), fill=WHT)
    return im


def wolf_eyes_tile():
    im = Image.new("RGBA", (760, 720), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = 380
    for sgn in (-1, 1):
        pts = [(cx + sgn * 18, 392), (cx + sgn * 82, 360), (cx + sgn * 76, 384), (cx + sgn * 26, 410)]
        d.polygon(pts, fill=(255, 40, 30))
    glow = im.filter(ImageFilter.GaussianBlur(16))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(im)
    d2 = ImageDraw.Draw(out)
    for sgn in (-1, 1):
        d2.line([(cx + sgn * 30, 394), (cx + sgn * 70, 376)], fill=(255, 210, 160), width=4)
    return out


SHEEP = sheep_tile(False)
WOLF = sheep_tile(True)
EYES = wolf_eyes_tile()

# ---------------------------------------------------------------- particles
def make_particles(seed, n, cx, cy, spread, speed, colors):
    rng = np.random.default_rng(seed)
    ang = rng.uniform(0, 2 * math.pi, n)
    sp = rng.uniform(speed * 0.25, speed, n)
    return dict(
        x=cx + rng.uniform(-spread[0], spread[0], n), y=cy + rng.uniform(-spread[1], spread[1], n),
        vx=np.cos(ang) * sp, vy=np.sin(ang) * sp - speed * 0.35,
        size=rng.uniform(6, 20, n), col=[colors[i % len(colors)] for i in range(n)],
        rot=rng.uniform(0, 90, n), life=rng.uniform(0.9, 1.8, n),
    )


def draw_particles(canvas, P, dt, gravity=1400, drag=2.6, alpha=1.0):
    if dt < 0:
        return
    d = ImageDraw.Draw(canvas)
    k = (1 - math.exp(-drag * dt)) / drag
    for i in range(len(P["x"])):
        life = P["life"][i]
        if dt > life:
            continue
        x = P["x"][i] + P["vx"][i] * k
        y = P["y"][i] + P["vy"][i] * k + 0.5 * gravity * dt * dt * 0.35
        s = P["size"][i] * (1 - 0.6 * dt / life)
        a = int(255 * alpha * (1 - (dt / life) ** 2))
        d.rectangle((x - s / 2, y - s / 2, x + s / 2, y + s / 2), fill=P["col"][i] + (a,))


HIT_P = make_particles(44, 170, 540, 1180, (420, 120), 1900, [YEL, WHT, YEL, INK, WHT])
HIT_P2 = make_particles(46, 70, 540, 1180, (420, 120), 1300, [YEL, WHT])
DUST_P = make_particles(56, 90, 540, 1250, (380, 20), 900, [(150, 132, 108), (176, 160, 136), (120, 106, 88)])
DUST_P2 = make_particles(58, 60, 540, 1540, (330, 10), 700, [(150, 132, 108), (176, 160, 136)])
DROP_P = make_particles(32, 80, 540, 600, (460, 120), 1400, [YEL, WHT])

# ---------------------------------------------------------------- scenes
FX0 = dict(cam=(1.0, 0, 0, 0), rgb=0, slices=0, flash=None, vig=False, fill=BLACK, shake=0)


def fx(**kw):
    out = dict(FX0)
    out.update(kw)
    return out


def header(canvas, text, y=250, style="r"):
    put(canvas, pill(text, style, 34, radius=14), 540, y)


# A — 隔絕噪音 ----------------------------------------------------------
A_STICKERS = [
    ("凍蒜！", "y", 210, 300, -12), ("宣傳車", "w", 820, 250, 9), ("拜託拜託", "r", 600, 420, -5),
    ("07:00", "k", 150, 520, 14), ("擴音器", "w", 900, 470, -16), ("鞭炮", "r", 300, 1460, 10),
    ("懇請支持", "w", 780, 1430, -8), ("23:00", "y", 120, 1290, -20), ("最後衝刺", "k", 900, 1310, 12),
    ("大聲公", "y", 560, 1590, 4), ("催票", "w", 200, 1700, -6), ("感謝鄉親", "r", 840, 1700, 7),
    ("掃街拜票", "k", 400, 300, 6), ("鑼鼓", "w", 980, 640, -24), ("造勢晚會", "y", 140, 690, 18),
    ("一票都不能少", "w", 520, 1790, -3),
]


def wave_line(canvas, t, y, amp, col, width=6, seed=0):
    d = ImageDraw.Draw(canvas)
    xs = np.linspace(-10, W + 10, 140)
    ph = t * 9.0
    v = (np.sin(xs * 0.031 + ph * 3.1 + seed) * 0.6 + np.sin(xs * 0.093 - ph * 5.3) * 0.45
         + np.sin(xs * 0.17 + ph * 7.7 + seed * 2) * 0.3)
    v *= np.hanning(len(xs)) * 0.6 + 0.4
    pts = [(float(x), float(y + amp * vv)) for x, vv in zip(xs, v)]
    d.line(pts, fill=col, width=width, joint="curve")


def scene_A(t, i):
    c = BG_BLACK.copy()
    beat_env = sum(pulse(t, bt(k), 0.12) for k in range(0, 8))
    wave_line(c, t, 1560, 40 + 150 * beat_env, YEL, 6)
    wave_line(c, t, 360, 20 + 90 * beat_env, (90, 90, 98), 4, seed=3)
    rng = np.random.default_rng(i)
    quake = 1.5 + 5.0 * lin(t, 0, SEC_B)
    for k, (txt, sty, x, y, rot) in enumerate(A_STICKERS):
        t0 = bt(k * 0.5)
        if t < t0:
            continue
        p = lin(t, t0, t0 + 0.2)
        s = e_back(p, 2.4) if p < 1 else 1.0
        jx, jy = rng.normal(0, quake, 2)
        put(c, pill(txt, sty, 48), x + jx, y + jy, s=max(0.02, s), rot=rot + 18 * (1 - p))
    # 隔音盒
    box = Image.new("RGBA", (700, 620), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle((3, 3, 697, 617), radius=46, fill=(9, 9, 11, 250),
                                         outline=(70, 70, 78), width=4)
    bs = e_back(lin(t, 0, 0.25), 1.4)
    put(c, box, 540, 965, s=max(0.02, bs))
    chars = [("隔", WHT, 410, 845), ("絕", WHT, 670, 845), ("噪", YEL, 410, 1085), ("音", YEL, 670, 1085)]
    rgb = 0
    for k, (ch, col, x, y) in enumerate(chars):
        t0 = bt(k)
        if t < t0:
            continue
        p = lin(t, t0, t0 + 0.16)
        s = 1.0 + 0.45 * (1 - e_out(p))
        jx = jy = 0.0
        if k >= 2 and t > bt(4):  # 「噪音」被困在盒內抖動
            jx, jy = rng.normal(0, 2 + 4 * lin(t, bt(4), SEC_B), 2)
        put_text(c, ch, "black", 230, col, x + jx, y + jy, s=s, a=lin(t, t0, t0 + 0.05))
        if t - t0 < 0.07:
            rgb = 14
    # 拍點底線
    d = ImageDraw.Draw(c)
    lw = 520 * e_out(lin(t, bt(4), bt(4) + 0.3))
    if lw > 2:
        d.rectangle((540 - lw / 2, 1215, 540 + lw / 2, 1223), fill=RED)
    zoom = 1.0 + 0.025 * pulse(t, last_beat(t, range(0, 8)) or 0, 0.12)
    gl = t > SEC_B - 0.1
    return c, fx(cam=(zoom, 0, 0, 0), rgb=rgb + (20 if gl else 0), slices=6 if gl else 0, shake=quake * 0.6)


# B — 選舉污染 ----------------------------------------------------------
B_EVENTS = [
    (bt(8), "slide", "選", WHT, RED),
    (bt(9), "big", "舉", WHT, RED),
    (bt(9.5), "big", "污", RED, WHT),
    (bt(10), "big", "染", YEL, BLACK),
    (bt(10.5), "two", "選舉", WHT, RED),
    (bt(11), "two", "污染", INK, YEL),
    (bt(11.5), "title1", None, None, RED),
    (bt(12), "title", None, None, RED),
]


def scene_B(t, i):
    ev = [e for e in B_EVENTS if e[0] <= t][-1]
    t0, kind, txt, col, bg = ev
    dt = t - t0
    rgb, slices, flash = 0, 0, None
    if bg == RED:
        c = (BG_RED_TAGS if kind.startswith("title") else BG_RED).copy()
    else:
        c = Image.new("RGBA", (W, H), bg + (255,))
    if kind == "slide":
        p = e_out(lin(t, t0, t0 + 0.14))
        x = -520 + (540 + 520) * p
        for g in range(3, 0, -1):
            put_text(c, txt, "black", 880, col, x - g * 70 * (1 - p), 960, a=0.18 * (1 - p))
        put_text(c, txt, "black", 880, col, x, 960)
        rgb = 18 * (1 - p)
    elif kind == "big":
        s = 1.0 + 0.3 * (1 - e_out(lin(t, t0, t0 + 0.1)))
        put_text(c, txt, "black", 880, col, 540, 960, s=s)
        rgb = 16 if dt < 0.06 else 0
    elif kind == "two":
        s = 1.0 + 0.25 * (1 - e_out(lin(t, t0, t0 + 0.1)))
        put_text(c, txt, "black", 470, col, 540, 960, s=s, track=10)
        rgb = 12 if dt < 0.06 else 0
    else:
        ms = e_back(lin(t, bt(11.5), bt(11.5) + 0.25), 1.8)
        wob = 4 * math.sin(t * 9)
        put(c, MEGA, 520, 500, s=0.82 * max(0.02, ms), rot=12 + wob)
        lb = last_beat(t, [k * 0.5 for k in range(23, 32)])
        d = ImageDraw.Draw(c)
        if lb is not None and t > bt(12):
            ph = (t - bt(12)) / (B / 2)
            for k in range(3):
                a = clamp(1 - abs(((ph - k) % 3) - 0.5) / 1.2)
                r = 70 + 52 * k
                if a > 0.02:
                    col_a = WHT + (int(255 * a),)
                    d.arc((660 - r, 455 - r, 660 + r, 455 + r), -50, 30, fill=col_a, width=16)
        s1 = 1.0 + 0.3 * (1 - e_out(lin(t, bt(11.5), bt(11.5) + 0.1)))
        put_text(c, "選舉", "black", 270, WHT, 540, 905, s=s1, track=16)
        if t >= bt(12):
            s2 = 1.0 + 0.3 * (1 - e_out(lin(t, bt(12), bt(12) + 0.1)))
            put_text(c, "污染", "black", 270, WHT, 540, 1195, s=s2, track=16)
        if t >= bt(13):
            n = int(clamp((t - bt(13)) / 0.35) * 24)
            put_text(c, "ELECTION NOISE POLLUTION"[:n], "bold", 46, YEL, 540, 1395, track=5)
            if n >= 24:
                lw = 300 * e_out(lin(t, bt(13) + 0.35, bt(13) + 0.6))
                d.rectangle((540 - lw, 1452, 540 + lw, 1458), fill=YEL)
        rgb = 14 if (t - bt(11.5) < 0.06 or 0 <= t - bt(12) < 0.06) else 0
    if dt < 0.035:
        flash = (WHT, 0.25)
    gl = t > SEC_C - 0.12
    zoom = 1.0 + (0.035 * lin(t, bt(12), SEC_C) if kind == "title" else 0)
    return c, fx(cam=(zoom, 0, 0, 0), rgb=rgb + (22 if gl else 0), slices=7 if gl else 0, flash=flash,
                 fill=bg)


# C — 噪音行程表 --------------------------------------------------------
NODES = [
    ("07:00", "宣傳車廣播", 300, 720), ("09:00", "掃街拜票", 780, 720),
    ("12:00", "鞭炮炸街", 780, 1010), ("15:00", "大聲公", 300, 1010),
    ("19:00", "造勢晚會", 300, 1300), ("23:00", "深夜催票", 780, 1300),
]


@lru_cache(None)
def node_tile(time_s, label, num):
    im = Image.new("RGBA", (420, 230), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((24, 22), num, font=F("bold", 28), fill=(140, 140, 148), anchor="lm")
    d.rounded_rectangle((10, 44, 410, 220), radius=28, fill=WHT)
    d.text((210, 92), time_s, font=F("black", 40), fill=RED, anchor="mm")
    d.text((210, 162), label, font=F("black", 58), fill=INK, anchor="mm")
    return im


def arrow(d, x0, y0, x1, y1, p, col=YEL, w=8):
    if p <= 0:
        return
    xe, ye = x0 + (x1 - x0) * p, y0 + (y1 - y0) * p
    d.line([(x0, y0), (xe, ye)], fill=col, width=w)
    ang = math.atan2(ye - y0, xe - x0)
    L = 26
    pts = [(xe + math.cos(ang) * 6, ye + math.sin(ang) * 6),
           (xe - L * math.cos(ang - 0.5), ye - L * math.sin(ang - 0.5)),
           (xe - L * math.cos(ang + 0.5), ye - L * math.sin(ang + 0.5))]
    d.polygon(pts, fill=col)


C_ARROWS = [((492, 732), (590, 732)), ((780, 828), (780, 905)), ((588, 1022), (492, 1022)),
            ((300, 1118), (300, 1195)), ((492, 1312), (590, 1312))]
LOOP = [(780, 1408), (780, 1500), (60, 1500), (60, 732), (88, 732)]


def scene_C(t, i):
    c = BG_BLACK.copy()
    d = ImageDraw.Draw(c)
    times = [bt(16 + k) for k in range(6)]
    for k, (a, b) in enumerate(C_ARROWS):
        arrow(d, *a, *b, e_out(lin(t, times[k] + 0.12, times[k] + 0.4)))
    # 每天重播
    lp = e_io(lin(t, bt(22), bt(22.9)))
    if lp > 0:
        segs = list(zip(LOOP[:-1], LOOP[1:]))
        lens = [math.dist(a, b) for a, b in segs]
        total = sum(lens) * lp
        for (a, b), L in zip(segs, lens):
            if total <= 0:
                break
            q = min(1.0, total / L)
            if q >= 1.0 and (a, b) != segs[-1]:
                d.line([a, b], fill=RED, width=8)
            else:
                arrow(d, *a, *b, q, col=RED, w=8)
            total -= L
    for k, (ts, label, x, y) in enumerate(NODES):
        if t < times[k]:
            continue
        p = lin(t, times[k], times[k] + 0.22)
        wob = 1.0
        if t > bt(22):  # 節點跟著十六分音符波動
            wob = 1 + 0.06 * pulse(t, bt(22) + k * B / 4, 0.09)
        put(c, node_tile(ts, label, f"{k + 1:02d}"), x, y - 20, s=max(0.02, e_back(p, 2.0)) * wob)
    lk = max([k for k in range(6) if t >= times[k]], default=0)
    if t < bt(22):
        nx, ny = NODES[lk][2], NODES[lk][3]
        bob = 6 * math.sin(t * 14)
        put(c, pill("NEXT", "y", 28), nx + 150, ny + 112 + bob)
    if lp > 0.6:
        put(c, pill("每天重播", "r", 38), 540, 1500, s=e_back(lin(t, bt(22.55), bt(22.8)), 2))
    put(c, pill("選舉期間｜每一天", "r", 34, radius=14), 540, 520)
    # 鏡頭：先貼近最新節點，最後拉遠看全貌
    def cam_target(k):
        return NODES[k][2], NODES[k][3]
    cx, cy = cam_target(0)
    for k in range(1, 6):
        q = e_io(lin(t, times[k] - 0.02, times[k] + 0.26))
        tx, ty = cam_target(k)
        cx, cy = cx + (tx - cx) * q, cy + (ty - cy) * q
    s = 1.55 - 0.2 * lin(t, times[0], times[5])
    zq = e_io(lin(t, bt(21.6), bt(22.3)))
    s = s + (1.0 - s) * zq
    cx = cx + (540 - cx) * zq
    cy = cy + (1080 - cy) * zq
    cam = (s, (540 - cx) * s, (960 - cy) * s, 0)
    lb = last_beat(t, range(16, 24)) or 0
    rgb = 10 if t - lb < 0.05 else 0
    gl = t > SEC_D - 0.1
    return c, fx(cam=cam, rgb=rgb + (24 if gl else 0), slices=6 if gl else 0)


# D — 道德偽裝 ----------------------------------------------------------
SLOGANS = ["為了你好", "服務鄉親", "公平正義", "清廉", "改革", "守護家園",
           "愛鄉愛土", "誠信", "良心", "感恩", "捍衛價值", "以民為本"]


def scene_D(t, i):
    c = BG_RED.copy()
    cx, cy = 540, 1010
    collapse = e_in(lin(t, bt(30.5), bt(31.5)))
    grow = e_in(lin(t, bt(31.5), bt(31.95)))
    tags = []
    for k, word in enumerate(SLOGANS):
        t0 = bt(24.5 + 0.5 * k)
        if t < t0:
            continue
        th = -math.pi / 2 + k * 2.39996 + 0.32 * (t - SEC_D)
        rr = 1 - collapse
        x = cx + 420 * math.cos(th) * rr
        y = cy + 610 * math.sin(th) * rr
        depth = 0.86 + 0.22 * (math.sin(th) + 1) / 2
        p = lin(t, t0, t0 + 0.22)
        s = e_back(p, 2.2) * depth * (1 - 0.6 * collapse)
        tags.append((math.sin(th), word, "k" if k % 3 == 1 else "w", x, y, s))
    for z, word, sty, x, y, s in sorted(tags):
        put(c, pill(word, sty, 54), x, y, s=max(0.02, s))
    # 中央圓
    d = ImageDraw.Draw(c)
    cp = e_back(lin(t, SEC_D, SEC_D + 0.3), 1.6)
    beat_p = 1 + 0.04 * pulse(t, last_beat(t, [24 + 0.5 * k for k in range(14)]) or 0, 0.1)
    r = 220 * cp * beat_p * (1 + 0.15 * collapse) + 1500 * grow
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHT)
    slip = any(0 <= t - bt(b) < 0.07 for b in (28, 29, 29.75))
    if cp > 0.3 and grow < 0.5:
        ta = clamp((cp - 0.3) / 0.4) * (1 - grow * 2)
        if slip:
            put_text(c, "選票", "black", 150, INK, cx, cy, a=ta)
        else:
            put_text(c, "道德", "black", 128, RED, cx, cy - 66, a=ta, track=6)
            put_text(c, "偽裝", "black", 128, RED, cx, cy + 76, a=ta, track=6)
        n = sum(1 for k in range(12) if t >= bt(24.5 + 0.5 * k))
        put_text(c, f"{n:02d}/12", "bold", 26, (170, 160, 156), cx, cy + 176, a=ta)
    return c, fx(rgb=18 if slip else 0, slices=5 if slip else 0, fill=RED,
                 hud=[("header", "說什麼｜漂亮口號")] if grow < 0.2 else [])


# E — 分貝 drop ---------------------------------------------------------
@lru_cache(None)
def card_tile(kind):
    if kind == 1:
        im = Image.new("RGBA", (960, 330), (0, 0, 0, 0))
        ImageDraw.Draw(im).rounded_rectangle((0, 0, 959, 329), radius=34, fill=RED)
    elif kind in (2, 3):
        im = Image.new("RGBA", (460, 380), (0, 0, 0, 0))
        ImageDraw.Draw(im).rounded_rectangle((0, 0, 459, 379), radius=34, fill=WHT)
    else:
        im = Image.new("RGBA", (960, 290), (0, 0, 0, 0))
        ImageDraw.Draw(im).rounded_rectangle((0, 0, 959, 289), radius=34, fill=YEL)
    return im


def scene_E(t, i):
    c = BG_BLACK.copy()
    T = [bt(32), bt(33), bt(34), bt(35)]
    cards = [
        (1, 540, 600, (0, -900)), (2, 302, 1000, (-900, 0)), (3, 778, 1000, (900, 0)), (4, 540, 1370, (0, 900)),
    ]
    for (kind, x, y, (ox, oy)), t0 in zip(cards, T):
        if t < t0:
            continue
        p = e_out(lin(t, t0, t0 + 0.22))
        X, Y = x + ox * (1 - p), y + oy * (1 - p)
        put(c, card_tile(kind), X, Y)
        cnt = e_out(lin(t, t0 + 0.05, t0 + 0.75))
        d = ImageDraw.Draw(c)
        if kind == 1:
            put_text(c, "宣傳車廣播", "bold", 40, WHT, X, Y - 112)
            v = int(round(90 * cnt))
            put_text(c, f"{v}", "black", 190, WHT, X - 60, Y + 20)
            put_text(c, "dB", "black", 80, YEL, X + 150, Y + 50)
            lw = 760 * cnt
            d.rounded_rectangle((X - 380, Y + 130, X - 380 + lw, Y + 142), radius=6, fill=YEL)
        elif kind in (2, 3):
            label, target = ("鞭炮", 120) if kind == 2 else ("大聲公", 100)
            put_text(c, label, "bold", 40, RED, X, Y - 128)
            v = int(round(target * cnt))
            put_text(c, f"{v}", "black", 150, INK, X, Y + 6)
            put_text(c, "dB", "black", 46, RED, X, Y + 108)
            for j in range(8):
                on = j < int(round(8 * cnt * target / 120))
                col = (RED if j > 5 else INK) if on else (220, 218, 212)
                bx = X - 150 + j * 40
                d.rounded_rectangle((bx, Y + 148, bx + 28, Y + 168), radius=4, fill=col)
        else:
            put_text(c, "從早到晚", "black", 52, INK, X - 300, Y - 70)
            env = 0.35 + 0.65 * pulse(t, last_beat(t, [k * 0.5 for k in range(64, 80)]) or t0, 0.14)
            for j in range(26):
                h = 30 + 140 * env * abs(math.sin(t * (5 + j * 0.7) + j * 1.7)) * (0.5 + 0.5 * math.sin(j * 0.9) ** 2)
                bx = X - 420 + j * 33
                d.rounded_rectangle((bx, Y + 70 - h / 2, bx + 18, Y + 70 + h / 2), radius=9, fill=INK)
    put(c, pill("分貝｜噪音值", "r", 34, radius=14), 540, 330)
    if t < T[0] + 1.6:
        draw_particles(c, DROP_P, t - T[0])
    # 鏡頭：推近鞭炮卡、搖到宣傳車、再拉遠
    s, cx, cy = 1.0, 540, 960
    z1 = e_io(lin(t, bt(36), bt(36) + 0.18))
    z2 = e_io(lin(t, bt(37), bt(37) + 0.18))
    z3 = e_io(lin(t, bt(38), bt(38) + 0.2))
    s = 1.0 + 0.55 * z1
    cx, cy = 540 + (302 - 540) * z1, 960 + (1000 - 960) * z1
    s += (1.4 - s) * z2
    cx, cy = cx + (540 - cx) * z2, cy + (600 - cy) * z2
    s += (1.0 - s) * z3
    cx, cy = cx + (540 - cx) * z3, cy + (960 - cy) * z3
    s *= 1 + 0.03 * pulse(t, last_beat(t, range(32, 40)) or 0, 0.1)
    lb = last_beat(t, range(32, 40)) or 0
    rgb = 16 if t - lb < 0.06 else 0
    gl = any(0 <= t - bt(b) < 0.1 for b in (36, 39)) or t > SEC_F - 0.08
    flash = (WHT, 0.6 * pulse(t, T[0], 0.06)) if t < T[0] + 0.2 else None
    return c, fx(cam=(s, (540 - cx) * s, (960 - cy) * s, 0), rgb=rgb + (26 if gl else 0),
                 slices=7 if gl else 0, flash=flash, shake=10 * pulse(t, bt(38), 0.15))


# F — 羊皮下的狼 --------------------------------------------------------
def scene_F(t, i):
    c = BG_BLACK.copy()
    cx, cy = 540, 960
    pop = e_back(lin(t, SEC_F, SEC_F + 0.25), 2.0)
    hop_t = last_beat(t, [40, 40.5, 41, 41.5])
    hop = 0.0
    squash = 1.0
    if hop_t is not None and t < bt(42):
        q = (t - hop_t) / (B / 2)
        hop = -46 * math.sin(math.pi * clamp(q))
        squash = 1 - 0.06 * pulse(t, hop_t, 0.05)
    flick = [(42, 2), (42.5, 3), (42.75, 2), (43, 99)]
    wolf = any(bt(b) <= t < bt(b) + n / FPS for b, n in flick)
    dark = lin(t, bt(43.5), bt(43.5) + 0.06)
    zoom = 1.0 + 0.28 * e_in(lin(t, bt(43), bt(43.85)))
    if dark < 1:
        put(c, WOLF if wolf else SHEEP, cx, cy + hop, s=max(0.02, pop), sy=squash, sx=2 - squash,
            a=1 - dark)
    if wolf or dark > 0:
        glow = 0.75 + 0.25 * math.sin(t * 30)
        put(c, EYES, cx, cy + hop, s=max(0.02, pop), a=glow)
    if bt(41) <= t < bt(42):
        bp = e_back(lin(t, bt(41), bt(41) + 0.2), 2.2)
        put(c, pill("咩～", "w", 54, tail=True), 800, 600, s=max(0.02, bp), rot=-8)
    rgb = 30 if wolf and t < bt(43) + 0.1 else 0
    return c, fx(cam=(zoom, 0, 0, 0), rgb=rgb, slices=8 if wolf and t < bt(43) + 0.1 else 0,
                 vig=t > bt(43), shake=6 if t > bt(43) and dark < 1 else 0)


def scene_hit(t, i):
    c = BG_RED.copy()
    dt = t - HIT
    s = e_back(lin(t, HIT, HIT + 0.3), 1.5)
    put(c, WOLF, 540, 640, s=max(0.02, 0.62 * s))
    put(c, EYES, 540, 640, s=max(0.02, 0.62 * s), a=0.8 + 0.2 * math.sin(t * 24))
    d = ImageDraw.Draw(c)
    wp = e_out(lin(t, HIT, HIT + 0.12))
    if wp > 0:
        d.rectangle((70, 1040, 70 + 940 * wp, 1320), fill=WHT)
    tp = 1 + 0.08 * pulse(t, bt(46), 0.12)
    if dt > 0.04:
        put_text(c, "狼披羊皮", "black", 214, RED, 540, 1180, s=tp, track=8)
    draw_particles(c, HIT_P, dt)
    draw_particles(c, HIT_P2, t - bt(46))
    rgb = int(40 * pulse(t, HIT, 0.12)) + int(14 * pulse(t, bt(46), 0.06))
    sl = 9 if dt < 0.18 else (5 if 0 <= t - bt(46) < 0.08 else 0)
    flash = (WHT, 0.7 * pulse(t, HIT, 0.05)) if dt < 0.2 else None
    gl = t > SEC_G - 0.1
    return c, fx(rgb=rgb + (24 if gl else 0), slices=sl + (6 if gl else 0), flash=flash,
                 shake=26 * pulse(t, HIT, 0.16) + 10 * pulse(t, bt(46), 0.1),
                 cam=(1.0 + 0.04 * pulse(t, HIT, 0.25), 0, 0, 0), fill=RED)


# G — 噪音城市 → 隔絕 ---------------------------------------------------
BUBBLES = [
    ("凍蒜！", "y", 270, 560, -6), ("拜託拜託！", "w", 760, 470, 5), ("砰！砰！砰！", "r", 520, 760, -3),
    ("嗶——叭叭！", "k", 210, 980, 4), ("最後一票！", "y", 820, 900, -7), ("懇請支持！", "w", 300, 1180, 6),
    ("感謝鄉親！", "r", 790, 1150, -4), ("催票中…", "k", 560, 640, 8), ("全力衝刺！", "w", 860, 690, -10),
    ("凍蒜！凍蒜！", "y", 260, 780, 3),
]


def scene_G(t, i):
    c = BG_NIGHT.copy()
    c.alpha_composite(CITY)
    rng = np.random.default_rng(i * 3 + 1)
    p = e_io(lin(t, bt(52), bt(55) - 0.08))
    R = 1180 * p
    cx, cy = 540, 960
    shakeamt = 4 * (1 - p)
    for k, (txt, sty, x, y, rot) in enumerate(BUBBLES):
        t0 = bt(48 + 0.5 * k)
        if t < t0:
            continue
        q = lin(t, t0, t0 + 0.2)
        s = e_back(q, 2.4) if q < 1 else 1.0
        dx, dy = x - cx, y - cy
        dist = math.hypot(dx, dy) + 1e-3
        push = max(0.0, R + 170 - dist)
        X, Y = x + dx / dist * push, y + dy / dist * push
        jx, jy = rng.normal(0, 3.5 * (1 - p), 2)
        put(c, pill(txt, sty, 50, tail=True), X + jx, Y + jy, s=max(0.02, s), rot=rot, a=1 - p ** 2)
    d = ImageDraw.Draw(c)
    if R > 1:
        d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=CREAM)
    hp = e_back(lin(t, bt(52), bt(52) + 0.3), 1.8)
    ha = 1 - lin(t, bt(54.6), bt(55))
    if t >= bt(52) and ha > 0:
        put(c, HEADPHONES, cx, cy, s=max(0.02, hp * (0.9 + 0.1 * p)), a=ha)
    # 分貝讀數
    if t < bt(55):
        db = 118 + rng.integers(-3, 4) if p == 0 else int(round(118 - 88 * p))
        on_cream = R > 660
        col = INK if on_cream else (RED if db > 85 else WHT)
        a = 1 - lin(t, bt(54.5), bt(55))
        put_text(c, f"{db}", "black", 150, col, 500, 300, a=a)
        put_text(c, "dB", "black", 60, col if on_cream else YEL, 660, 330, a=a)
    lb = last_beat(t, range(48, 52))
    zoom = 1.0 + (0.025 * pulse(t, lb, 0.1) if lb is not None and t < bt(52) else 0)
    return c, fx(cam=(zoom, 0, 0, 0), shake=shakeamt if t < bt(52) else 0,
                 fill=NAVY, rgb=8 if lb is not None and t - lb < 0.04 and t < bt(52) else 0)


def scene_silent(t, i):
    return BG_PAPER.copy(), fx(fill=CREAM)


# H — 歲月靜好 我的自由 -------------------------------------------------
def scene_H(t, i):
    c = BG_PAPER.copy()
    d = ImageDraw.Draw(c)
    T1, T2 = FINAL, bt(58)
    # 衝擊波
    for t0, y0, mx in ((T1, 1262, 760), (T2, 1548, 520)):
        q = lin(t, t0, t0 + 0.8)
        if 0 < q < 1:
            r = 300 + mx * e_out(q)
            a = int(70 * (1 - q) ** 1.5)
            d.ellipse((540 - r, y0 - r * 0.12, 540 + r, y0 + r * 0.12), outline=(150, 132, 108, a),
                      width=max(2, int(16 * (1 - q))))
    # 歲月靜好：從高處重重落下
    q1 = lin(t, T1 - 0.16, T1)
    s1 = 1 + 1.3 * (1 - e_in(q1))
    a1 = lin(t, T1 - 0.16, T1 - 0.06)
    squash = 1 - 0.05 * pulse(t, T1, 0.07)
    breathe = 1 + 0.012 * lin(t, T1 + 0.5, DUR)
    if a1 > 0:
        for txt, y in (("歲月", 700), ("靜好", 1080)):
            sz = 360 * s1 * breathe
            tile = ctile(txt, "serif", int(round(sz / 2) * 2), INK, int(30 * s1))
            put(c, tile, 540, 890 + (y - 890) * s1 * squash, a=a1, sx=1 / squash ** 0.5, sy=squash)
    draw_particles(c, DUST_P, t - T1, gravity=500, drag=3.2, alpha=0.75)
    # 我的自由：印章蓋下
    q2 = lin(t, T2 - 0.12, T2)
    if q2 > 0:
        s2 = 1 + 0.9 * (1 - e_in(q2))
        a2 = lin(t, T2 - 0.12, T2 - 0.05)
        seal = seal_tile()
        put(c, seal, 540, 1430, s=s2 * breathe, rot=-1.5, a=a2)
    draw_particles(c, DUST_P2, t - T2, gravity=500, drag=3.4, alpha=0.6)
    # 緩慢上飄的微塵
    rng = np.random.default_rng(99)
    if t > T1 + 0.6:
        al = lin(t, T1 + 0.6, T1 + 2.0)
        for k in range(36):
            x0, y0, sp, sz = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(20, 60), rng.uniform(2, 5)
            y = (y0 - sp * (t - T1)) % H
            x = x0 + 14 * math.sin(t * 0.8 + k)
            d.ellipse((x - sz, y - sz, x + sz, y + sz), fill=(170, 150, 110, int(90 * al)))
    shake = 34 * pulse(t, T1, 0.18) + 16 * pulse(t, T2, 0.12)
    rgb = int(10 * pulse(t, T1, 0.05))
    flash = (INK, 0.18 * pulse(t, T1, 0.06)) if t < T1 + 0.3 else None
    return c, fx(shake=shake, rgb=rgb, flash=flash, fill=CREAM,
                 cam=(1.0 + 0.03 * lin(t, T1, DUR) + 0.02 * pulse(t, T1, 0.1), 0, 0, 0))


@lru_cache(None)
def seal_tile():
    im = Image.new("RGBA", (720, 230), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 719, 229), fill=SEAL)
    d.rectangle((14, 14, 705, 215), outline=(236, 214, 200), width=4)
    d.text((360, 118), "我的自由", font=F("black", 150), fill=WHT, anchor="mm")
    # 印泥紋理
    rng = np.random.default_rng(5)
    arr = np.array(im)
    mask = rng.random(arr.shape[:2]) < 0.025
    arr[mask & (arr[..., 3] > 0), 3] = 150
    return Image.fromarray(arr, "RGBA")


def scene(t, i):
    if t < SEC_B:
        return scene_A(t, i)
    if t < SEC_C:
        return scene_B(t, i)
    if t < SEC_D:
        return scene_C(t, i)
    if t < SEC_E:
        return scene_D(t, i)
    if t < SEC_F:
        return scene_E(t, i)
    if t < HIT:
        return scene_F(t, i)
    if t < SEC_G:
        return scene_hit(t, i)
    if t < SILENT:
        return scene_G(t, i)
    if t < FINAL - 0.16:
        return scene_silent(t, i)
    return scene_H(t, i)


# ---------------------------------------------------------------- post
def apply_cam(img, s, dx, dy, rot, fill):
    if abs(s - 1) < 1e-4 and abs(dx) < 0.3 and abs(dy) < 0.3 and abs(rot) < 1e-3:
        return img
    cx, cy = W / 2, H / 2
    co, si = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    a, b = co / s, si / s
    d_, e = -si / s, co / s
    c = cx - a * (cx + dx) - b * (cy + dy)
    f = cy - d_ * (cx + dx) - e * (cy + dy)
    return img.transform((W, H), Image.AFFINE, (a, b, c, d_, e, f), resample=Image.BICUBIC,
                         fillcolor=fill + (255,))


def post(img, f, i):
    rng = np.random.default_rng(1000 + i)
    s, dx, dy, rot = f["cam"]
    if f["shake"]:
        jx, jy = rng.normal(0, f["shake"], 2)
        dx, dy = dx + jx, dy + jy
        rot += rng.normal(0, f["shake"] * 0.02)
    img = apply_cam(img, s, dx, dy, rot, f["fill"])
    for kind, text in f.get("hud", []):
        put(img, pill(text, "w", 34, radius=14), 540, 250)
    arr = np.asarray(img.convert("RGB")).copy()
    if f["rgb"]:
        k = int(f["rgb"])
        out = arr.copy()
        out[..., 0] = np.roll(arr[..., 0], k, axis=1)
        out[..., 2] = np.roll(arr[..., 2], -k, axis=1)
        arr = out
    if f["slices"]:
        for _ in range(int(f["slices"])):
            y0 = int(rng.integers(0, H - 40))
            h = int(rng.integers(12, 120))
            off = int(rng.integers(-90, 90))
            arr[y0:y0 + h] = np.roll(arr[y0:y0 + h], off, axis=1)
    if f["vig"]:
        arr = (arr.astype(np.float32) * VIG).astype(np.uint8)
    if f["flash"] and f["flash"][1] > 0.004:
        col, a = f["flash"]
        arr = (arr.astype(np.float32) * (1 - a) + np.array(col, np.float32) * a).astype(np.uint8)
    return arr


def render_frame(i):
    t = i / FPS
    img, f = scene(t, i)
    return post(img, f, i).tobytes()


# ================================================================ audio
SR = 48000
NS = int(SR * DUR)
ARNG = np.random.default_rng(2024)


def T(n):
    return np.arange(n) / SR


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def noise(n):
    return ARNG.standard_normal(n)


class Bus:
    def __init__(self):
        self.b = np.zeros((NS, 2))

    def add(self, t0, sig, gain=1.0, pan=0.0):
        i0 = int(round(t0 * SR))
        if i0 >= NS:
            return
        if i0 < 0:
            sig = sig[-i0:]
            i0 = 0
        n = min(len(sig), NS - i0)
        ramp = min(96, len(sig))  # 2 ms 起音，避免階躍造成 AAC 過衝
        sig = sig.copy()
        env = np.linspace(0, 1, ramp)
        sig[:ramp] *= env if sig.ndim == 1 else env[:, None]
        if sig.ndim == 1:
            l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
            self.b[i0:i0 + n, 0] += sig[:n] * gain * l * 1.414
            self.b[i0:i0 + n, 1] += sig[:n] * gain * r * 1.414
        else:
            self.b[i0:i0 + n] += sig[:n] * gain


def kick():
    t = T(int(0.5 * SR))
    f = 44 + 120 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    s += 0.35 * filt(noise(len(t)), "high", 2000) * np.exp(-t * 400)
    return np.tanh(s * 1.8) * 0.9


def clap():
    t = T(int(0.35 * SR))
    n = filt(noise(len(t)), "band", [900, 3200])
    env = np.zeros_like(t)
    for d0 in (0, 0.011, 0.022):
        env += np.where(t >= d0, np.exp(-(t - d0) * 160), 0)
    env += 0.5 * np.exp(-t * 16)
    return n * env * 0.55


def hat(open_=False):
    t = T(int((0.3 if open_ else 0.06) * SR))
    return filt(noise(len(t)), "high", 7500) * np.exp(-t * (14 if open_ else 70)) * 0.3


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def bass(freq, dur=B * 0.45):
    t = T(int(dur * SR))
    s = 0.6 * saw(freq, t) + 0.8 * np.sin(2 * np.pi * freq * t)
    s = filt(s, "low", 520)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 6)
    return np.tanh(s * env * 1.6) * 0.55


def stab(freqs, dur=0.22):
    t = T(int(dur * SR))
    s = sum(saw(f * (1 + dv), t) for f in freqs for dv in (-0.004, 0.004))
    s = filt(s, "low", 2600) * np.exp(-t * 11) / len(freqs)
    return s * 0.6


def pluck(freq, dur=0.5, bright=1.0):
    t = T(int(dur * SR))
    s = np.sin(2 * np.pi * freq * t) + 0.4 * bright * np.sin(4 * np.pi * freq * t) + 0.15 * np.sin(6 * np.pi * freq * t)
    return s * np.exp(-t * 9) * np.minimum(1, t / 0.002) * 0.35


def pop(freq):
    t = T(int(0.07 * SR))
    f = freq * (1 + 0.8 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 55) * 0.35


def impact(big=1.0):
    t = T(int(1.4 * SR))
    f = 34 + 90 * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    s += 0.7 * filt(noise(len(t)), "low", 900) * np.exp(-t * 14)
    s += 0.25 * filt(noise(len(t)), "high", 3000) * np.exp(-t * 40)
    return np.tanh(s * 1.5 * big) * 0.9


def crash(dur=2.2):
    t = T(int(dur * SR))
    return filt(noise(len(t)), "high", 4500) * np.exp(-t * 2.4) * 0.3


def glitch(dur=0.09):
    n = int(dur * SR)
    out = np.zeros(n)
    i = 0
    while i < n:
        hold = int(ARNG.integers(30, 400))
        out[i:i + hold] = ARNG.uniform(-1, 1)
        i += hold
    out = filt(np.round(out * 4) / 4, "low", 7000)
    return out * 0.22 * np.hanning(n) ** 0.3


def whoosh(dur=0.35, rev=False):
    t = T(int(dur * SR))
    env = np.sin(np.pi * t / dur) ** 2
    s = filt(noise(len(t)), "band", [500, 5000]) * env * 0.35
    return s[::-1] if rev else s


def riser(dur):
    n = int(dur * SR)
    t = T(n)
    x = noise(n)
    out = np.zeros(n)
    blk = 512
    zi = None
    for k in range(0, n, blk):
        fc = 300 * (20 ** (k / n))
        so = sos("band", [fc * 0.7, min(fc * 1.4, 20000)])
        if zi is None:
            zi = signal.sosfilt_zi(so) * 0
        y, zi = signal.sosfilt(so, x[k:k + blk], zi=zi)
        out[k:k + blk] = y
    tone = np.sin(2 * np.pi * np.cumsum(220 * (6 ** (t / dur))) / SR) * 0.25
    return (out * 0.5 + tone) * (t / dur) ** 2 * 0.6


def firecrackers(dur, density=38):
    n = int(dur * SR)
    out = np.zeros(n)
    tt = 0.0
    while tt < dur:
        i = int(tt * SR)
        L = int(SR * 0.025)
        bang = noise(L) * np.exp(-np.arange(L) / SR * 260) * ARNG.uniform(0.4, 1.0)
        bang += np.sin(2 * np.pi * 90 * np.arange(L) / SR) * np.exp(-np.arange(L) / SR * 90) * 0.6
        m = min(L, n - i)
        out[i:i + m] += bang[:m]
        tt += ARNG.exponential(1 / density)
    return np.tanh(out * 1.2) * 0.45


def horn(dur=0.22):
    t = T(int(dur * SR))
    s = np.sign(np.sin(2 * np.pi * 392 * t)) + 0.8 * np.sign(np.sin(2 * np.pi * 494 * t))
    s = filt(s, "low", 2500) * np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.02)
    return s * 0.18


def megaphone(syllables, f0=170):
    """擴音器喊話質感：鋸齒波 + 共振峰 + 失真 + 回音，不是真實語音。"""
    out = []
    for dur, bend in syllables:
        t = T(int(dur * SR))
        f = f0 * (1 + bend * t / dur) * (1 + 0.02 * np.sin(2 * np.pi * 6 * t))
        s = saw(1, np.cumsum(f) / SR)
        s = filt(s, "band", [600, 1100]) + 0.7 * filt(s, "band", [1500, 2600])
        env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
        out.append(s * env)
        out.append(np.zeros(int(0.05 * SR)))
    s = np.concatenate(out)
    s = np.tanh(s * 6) * 0.3
    s = filt(s, "band", [450, 3800])
    echo = np.zeros(len(s) + int(0.5 * SR))
    echo[:len(s)] += s
    for k, g in ((1, 0.4), (2, 0.18), (3, 0.08)):
        d0 = int(0.13 * k * SR)
        echo[d0:d0 + len(s)] += s * g
    return echo


def bleat():
    t = T(int(0.7 * SR))
    f = 420 * (1 + 0.06 * np.sin(2 * np.pi * 9 * t)) * (1 - 0.15 * t)
    s = saw(1, np.cumsum(f) / SR)
    s = filt(s, "band", [700, 2400])
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)
    return s * am * np.minimum(1, t / 0.03) * np.exp(-t * 2.5) * 0.35


def tick():
    t = T(int(0.015 * SR))
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 400) * 0.15


def boom(scale=1.0):
    t = T(int(4.0 * SR))
    f = 30 + 34 * np.exp(-t * 2.2)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.05)
    body = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-t * 18)) / SR) * np.exp(-t * 5)
    thump = filt(noise(len(t)), "low", 260) * np.exp(-t * 10)
    s = 1.0 * sub + 0.7 * body + 0.8 * thump
    s = np.tanh(s * 1.4 * scale)
    ir_t = T(int(2.4 * SR))
    ir = filt(noise(len(ir_t)), "low", 1600) * np.exp(-ir_t * 2.4)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(s, ir)[:len(s)]
    return (s + 0.35 * wet) * 0.95


def bell(freq, dur=3.0):
    t = T(int(dur * SR))
    s = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 2) \
        + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 4)
    return s * np.exp(-t * 1.6) * np.minimum(1, t / 0.004) * 0.12


def pad(freqs, dur, attack=1.0, cutoff=1400):
    t = T(int(dur * SR))
    s = np.zeros((len(t), 2))
    for j, f in enumerate(freqs):
        for ch, dv in ((0, -0.003), (1, 0.003)):
            s[:, ch] += np.sin(2 * np.pi * f * (1 + dv) * t + j) + 0.3 * saw(f * (1 + dv * 1.7), t)
    s = signal.sosfilt(sos("low", cutoff), s, axis=0) / len(freqs)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.8)
    return s * env[:, None] * 0.35


def bird(t0, bus):
    for k in range(3):
        t = T(int(0.09 * SR))
        f = 5200 - 2200 * t / 0.09 + 300 * np.sin(2 * np.pi * 70 * t)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.09) ** 2 * 0.05
        bus.add(t0 + k * 0.13, s, pan=0.5)


def make_audio(path):
    music, sfx = Bus(), Bus()
    K, C, Hh, Ho = kick(), clap(), hat(), hat(True)
    roots = [55.0, 43.65, 65.41, 49.0]  # Am F C G
    chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]

    groove = [b for b in range(0, 24)] + [b for b in range(32, 42)] + [b for b in range(44, 55)]
    for b in groove:
        tb = bt(b)
        music.add(tb, K, 0.9)
        if b % 2 == 1:
            music.add(tb, C, 0.8, pan=0.05)
        music.add(tb + B / 2, Hh, 0.9, pan=0.25)
        if b >= 32:
            music.add(tb + B / 4, Hh, 0.45, pan=-0.25)
            music.add(tb + 3 * B / 4, Hh, 0.45, pan=-0.25)
        if b % 4 == 3:
            music.add(tb + B / 2, Ho, 0.6, pan=0.3)
        root = roots[(b // 4) % 4]
        music.add(tb + B / 2, bass(root * 2 if b % 8 == 7 else root), 0.9)
        music.add(tb + 3 * B / 4, bass(root * 2, B * 0.2), 0.35)
    # A：貼紙 pop + 打字
    penta = [440, 523.3, 587.3, 659.3, 784, 880]
    for k in range(16):
        sfx.add(bt(k * 0.5), pop(penta[k % 6] * 2), 0.8, pan=(k % 5 - 2) / 3)
    for k in range(4):
        sfx.add(bt(k), stab(chords[0], 0.16), 0.9)
    sfx.add(bt(1.2), megaphone([(0.28, 0.1), (0.42, 0.25)]), 0.55, pan=-0.6)
    sfx.add(bt(5.2), megaphone([(0.2, 0.0), (0.2, 0.1), (0.4, 0.2)], 190), 0.5, pan=0.6)
    sfx.add(bt(3.6), horn(), 0.8, pan=0.7)
    sfx.add(bt(3.9), horn(), 0.8, pan=0.7)
    # B：選舉污染
    sfx.add(SEC_B, impact(0.9), 0.9)
    sfx.add(SEC_B - 0.2, whoosh(0.22, True), 0.8)
    for k, b in enumerate([9, 9.5, 10, 10.5, 11, 11.5, 12]):
        sfx.add(bt(b), stab(chords[k % 4]), 1.1)
        sfx.add(bt(b), glitch(0.05), 0.5)
    for k in range(24):
        sfx.add(bt(13) + k * 0.35 / 24, tick(), 0.5)
    sfx.add(SEC_C - 0.1, glitch(0.1), 0.8)
    # C：行程表
    for k in range(6):
        sfx.add(bt(16 + k), pluck(penta[k] , 0.6), 1.0, pan=-0.3 if NODES[k][2] < 540 else 0.3)
        sfx.add(bt(16 + k) + 0.12, whoosh(0.18), 0.35)
    sfx.add(bt(16) + 0.05, horn(), 0.9, pan=-0.4)
    sfx.add(bt(16) + 0.32, horn(), 0.9, pan=-0.4)
    sfx.add(bt(18), firecrackers(0.9), 0.9, pan=0.4)
    sfx.add(bt(19), megaphone([(0.3, 0.2), (0.3, 0.0)], 160), 0.6, pan=-0.4)
    sfx.add(bt(21), megaphone([(0.5, 0.3)], 200), 0.4, pan=0.4)
    sfx.add(bt(22), whoosh(0.9), 0.6)
    sfx.add(SEC_D - 0.1, glitch(0.1), 0.8)
    # D：breakdown
    music.add(SEC_D, pad([174.6, 220, 261.6, 329.6], bt(4) + 0.2, 0.4), 1.0)
    music.add(bt(28), pad([196, 246.9, 293.7, 392], bt(3.5), 0.3), 1.0)
    sfx.add(SEC_D, impact(0.6), 0.6)
    for k in range(12):
        sfx.add(bt(24.5 + 0.5 * k), pluck(penta[(k * 2) % 6] * 2, 0.4), 0.7, pan=((k % 3) - 1) * 0.5)
    for b in (28, 29, 29.75):
        sfx.add(bt(b), glitch(0.08), 0.9)
    roll = []
    tb = bt(28)
    while tb < bt(31.75):
        roll.append(tb)
        step = B / 2 if tb < bt(30) else (B / 4 if tb < bt(31) else B / 8)
        tb += step
    for j, tr in enumerate(roll):
        sfx.add(tr, clap(), 0.25 + 0.6 * j / len(roll))
    sfx.add(bt(28), riser(bt(31.75) - bt(28)), 0.9)
    sfx.add(bt(30.5), whoosh(0.45, True), 0.6)
    # E：drop
    sfx.add(SEC_E, impact(1.0), 1.0)
    sfx.add(SEC_E, crash(), 0.9)
    for k, b in enumerate([33, 34, 35]):
        sfx.add(bt(b) - 0.08, whoosh(0.2), 0.7, pan=[-0.6, 0.6, 0][k])
    for b, target in ((32, 90), (33, 120), (34, 100)):
        for k in range(18):
            sfx.add(bt(b) + 0.05 + 0.7 * (1 - (1 - k / 18) ** (1 / 3)), tick(), 0.6)
    sfx.add(bt(33) + 0.1, firecrackers(1.0, 45), 0.7, pan=-0.5)
    sfx.add(bt(34) + 0.1, megaphone([(0.25, 0.1), (0.4, 0.3)], 180), 0.45, pan=0.5)
    for b in (36, 39):
        sfx.add(bt(b), glitch(0.12), 1.0)
    sfx.add(bt(38), impact(0.5), 0.5)
    # F：羊 → 狼
    for k, b in enumerate([40, 40.5, 41, 41.5]):
        sfx.add(bt(b), pop(660 + 110 * k), 0.8)
    sfx.add(bt(41), bleat(), 0.9, pan=0.3)
    for b in (42, 42.5, 42.75, 43):
        sfx.add(bt(b), glitch(0.1), 1.1)
    sfx.add(bt(42), riser(bt(43.5) - bt(42)), 1.0)
    for b in (42, 43):
        sfx.add(bt(b), K, 0.6)
    sfx.add(bt(43.5), boom(0.4)[: int(0.25 * SR)] * np.linspace(1, 0, int(0.25 * SR)), 0.6)
    # HIT
    sfx.add(HIT, impact(1.1), 1.1)
    sfx.add(HIT, crash(2.6), 1.0)
    sfx.add(HIT, glitch(0.18), 0.8)
    for k, b in enumerate([44, 44.5, 45, 46]):
        sfx.add(bt(b), stab(chords[0] if k < 3 else chords[1], 0.3), 1.1)
    sfx.add(bt(46), impact(0.6), 0.5)
    # G：噪音城市
    for k in range(10):
        sfx.add(bt(48 + 0.5 * k), pop(penta[k % 6] * 1.5), 0.6, pan=(k % 5 - 2) / 3)
    sfx.add(bt(48), megaphone([(0.3, 0.1), (0.5, 0.25), (0.3, 0.0), (0.5, 0.3)], 175), 0.6, pan=-0.5)
    sfx.add(bt(49), firecrackers(1.6, 50), 0.75, pan=0.4)
    sfx.add(bt(50), megaphone([(0.25, 0.0), (0.25, 0.1), (0.6, 0.35)], 205), 0.55, pan=0.55)
    for b in (48.75, 49.25, 51, 51.3):
        sfx.add(bt(b), horn(), 0.8, pan=-0.2)
    sfx.add(bt(51.5), firecrackers(1.2, 40), 0.6, pan=-0.4)
    sfx.add(bt(52), megaphone([(0.3, 0.1), (0.5, 0.25)], 170), 0.5, pan=0.2)
    # 混音 → G 後段低通掃頻（像戴上隔音耳機）
    mix = music.b + sfx.b
    t0, t1 = bt(52), bt(55)
    i0, i1 = int(t0 * SR), int(t1 * SR)
    blk = 256
    zi = np.zeros((1, 2, 2))
    for k in range(i0, NS, blk):
        q = clamp((k - i0) / (i1 - i0))
        fc = 16000 * (180 / 16000) ** e_io(q)
        so = sos("low", fc)
        if k == i0:
            zi = np.stack([signal.sosfilt_zi(so)[:, :, None] * mix[k][None, None, :]], 0)[0]
        y, zi = signal.sosfilt(so, mix[k:k + blk], axis=0, zi=zi)
        gain = (1 - 0.7 * e_io(q))
        mix[k:k + blk] = y * gain
    # 靜音一拍
    sil0, sil1 = int((bt(55) - 0.03) * SR), int(FINAL * SR)
    ramp = np.linspace(1, 0, int(0.03 * SR))[:, None]
    mix[sil0:sil0 + len(ramp)] *= ramp
    mix[sil0 + len(ramp):] = 0
    # H：重擊收尾 + 寧靜
    fin = Bus()
    fin.add(FINAL - 0.3, whoosh(0.3, True), 0.25)
    fin.add(FINAL, boom(1.0), 1.15)
    fin.add(bt(58), boom(0.7), 0.75)
    fin.add(bt(58), impact(0.5) * np.exp(-T(int(1.4 * SR)) * 2), 0.4)
    fin.add(FINAL + 0.4, pad([130.8, 196, 246.9, 293.7, 329.6], DUR - FINAL - 0.4, 1.4, 1100), 0.9)
    for k, (b, f) in enumerate([(59, 659.3), (60, 784), (61, 587.3), (62, 523.3)]):
        fin.add(bt(b), bell(f), 1.0, pan=(k - 1.5) / 3)
    bird(bt(59.5), fin)
    bird(bt(61.7), fin)
    mix += fin.b
    # 尾端淡出
    fo = int(1.2 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    mix = np.tanh(mix * 0.9)
    mix = signal.sosfilt(sos("low", 15000, 4), mix, axis=0)
    mix /= np.max(np.abs(mix)) / 0.70  # AAC 編碼後峰值仍留在 -0.5 dBFS 以下
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ================================================================ main
def stills(times=None):
    times = times or [0.3, 1.6, 3.2, 3.8, 4.5, 4.95, 5.2, 6.8, 7.6, 9.9, 10.9, 12.2, 13.1, 14.6, 15.2, 16.6,
             17.0, 17.5, 19.3, 19.8, 20.5, 20.75, 21.4, 23.6, 24.9, 25.5, 26.1, 26.4, 27.4, 29.5]
    os.makedirs(BUILD, exist_ok=True)
    tiles = []
    for t in times:
        i = int(round(t * FPS))
        arr = np.frombuffer(render_frame(i), np.uint8).reshape(H, W, 3)
        im = Image.fromarray(arr).resize((216, 384))
        ImageDraw.Draw(im).text((6, 4), f"{t:.2f}s", fill=(255, 0, 255), font=F("bold", 22))
        tiles.append(im)
    cols = min(10, len(tiles))
    sheet = Image.new("RGB", (216 * cols, 384 * math.ceil(len(tiles) / cols)), (0, 0, 0))
    for k, im in enumerate(tiles):
        sheet.paste(im, ((k % cols) * 216, (k // cols) * 384))
    sheet.save(os.path.join(BUILD, "stills.png"))
    print("wrote", os.path.join(BUILD, "stills.png"))


def main():
    os.makedirs(BUILD, exist_ok=True)
    wav = os.path.join(BUILD, "audio.wav")
    make_audio(wav)
    print("audio done")
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "19",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
           "-shortest", OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, frame in enumerate(pool.imap(render_frame, range(NF), chunksize=4)):
            proc.stdin.write(frame)
            if k % 90 == 0:
                print(f"frame {k}/{NF}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", OUT)


if __name__ == "__main__":
    if "--stills" in sys.argv:
        extra = [float(a) for a in sys.argv[2:]]
        stills(extra or None)
    elif "--audio" in sys.argv:
        os.makedirs(BUILD, exist_ok=True)
        make_audio(os.path.join(BUILD, "audio.wav"))
    else:
        main()
