#!/usr/bin/env python3
"""Procedural paper texture (grain, fibres, mottling) as a mid-grey image.

It is laid over every frame with mix-blend-mode: overlay, so grey 128 leaves
the colour untouched while lighter/darker texels lift or deepen it. That keeps
the texture identical on red (day) and navy (night) paper.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
rng = np.random.default_rng(1956)


def lowfreq(scale, octaves=4):
    acc = np.zeros((H, W), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(H / scale * 2 ** o)), max(2, int(W / scale * 2 ** o))
        g = rng.standard_normal((gh, gw)).astype(np.float32)
        img = Image.fromarray(g).resize((W, H), Image.BICUBIC)
        acc += np.asarray(img) * amp
        tot += amp
        amp *= 0.5
    acc /= tot
    return acc / (np.abs(acc).max() + 1e-6)


def fibres(n, light):
    im = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.uniform(-50, W + 50), rng.uniform(-50, H + 50)
        ang = rng.uniform(0, np.pi)
        L = rng.uniform(20, 120)
        pts = []
        for k in range(8):
            ang += rng.normal(0, 0.25)
            x += np.cos(ang) * L / 8
            y += np.sin(ang) * L / 8
            pts.append((x, y))
        dr.line(pts, fill=int(rng.uniform(90, 255) if light else rng.uniform(60, 200)), width=1)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255.0


def main():
    base = np.full((H, W), 128.0, np.float32)
    base += lowfreq(420) * 9.0          # large soft blotches
    base += lowfreq(90, 3) * 4.0        # medium mottling
    base += fibres(2600, True) * 16.0   # light fibres
    base -= fibres(1400, False) * 10.0  # darker fibres
    base += rng.normal(0, 3.2, (H, W))  # fine grain
    # a few deckle-like speckles
    spk = (rng.random((H, W)) > 0.9993).astype(np.float32)
    spk_img = Image.fromarray((spk * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.1))
    base += np.asarray(spk_img, np.float32) * 0.18
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "L")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "paper.png")
    img.save(out, optimize=True)
    print("paper texture", out, "mean", float(base.mean()))


if __name__ == "__main__":
    main()
