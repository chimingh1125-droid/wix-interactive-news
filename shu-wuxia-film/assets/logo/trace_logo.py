#!/usr/bin/env python3
"""Vectorise the SHU Journalism department logo for the renderer.

Input : assets/logo/reference.png  (the logo as published on the department's
        Facebook page: white mark on red)
Output: render/lib/logo_data.js     (window.LOGO: outlines in logo units)

The white ink is traced with potrace (smooth Bezier outlines), flattened to
polylines and split into parts so the renderer can animate them:
  mark  - globe, orbit band, brush and the red cut-outs (SHU, "!")
  head  - the round head of the "journalist" figure
  text  - the 世新 / 新聞 calligraphy (one entry per character)
Coordinates are normalised: (0, 0) is the centre of the mark, 1 unit = half
the mark's width, y down.
"""
import json
import os

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, "reference.png")
OUT = os.path.join(ROOT, "render", "lib", "logo_data.js")
UP = 4                     # trace at 4x for smooth outlines
BG = (158, 34, 42)         # logo red
CAMERA_BUTTON = (75.5, 778.5, 46)  # screenshot UI button to paint out (x, y, r)
STEP = 1.2                 # flattening step, in source pixels


def load_mask():
    im = Image.open(SRC).convert("RGB")
    d = ImageDraw.Draw(im)
    x, y, r = CAMERA_BUTTON
    d.ellipse((x - r, y - r, x + r, y + r), fill=BG)
    g = np.asarray(im).astype(float)[:, :, 1]           # green: 34 on red, 255 on white
    white = np.clip((g - 34) / (255 - 34), 0, 1)
    big = Image.fromarray((white * 255).astype(np.uint8)).resize(
        (im.width * UP, im.height * UP), Image.BICUBIC).filter(ImageFilter.GaussianBlur(UP * 0.35))
    return np.asarray(big) > 127, im.size


def bez(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n + 1)[1:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def P(q):
    return np.array([q.x, q.y], float)


def flatten(curve):
    pts = [P(curve.start_point)]
    for seg in curve:
        a = pts[-1]
        if seg.is_corner:
            c, e = P(seg.c), P(seg.end_point)
            for q in (c, e):
                n = max(1, int(np.linalg.norm(q - pts[-1]) / (STEP * UP)))
                pts += list(pts[-1] + (q - pts[-1]) * (np.arange(1, n + 1)[:, None] / n))
        else:
            c1, c2, e = P(seg.c1), P(seg.c2), P(seg.end_point)
            ln = np.linalg.norm(c1 - a) + np.linalg.norm(c2 - c1) + np.linalg.norm(e - c2)
            pts += list(bez(a, c1, c2, e, max(2, int(ln / (STEP * UP)))))
    return np.array(pts[:-1]) / UP          # closed loop, source pixels


def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def inside(pt, poly):
    x, y = pt
    xs, ys = poly[:, 0], poly[:, 1]
    x2, y2 = np.roll(xs, -1), np.roll(ys, -1)
    c = ((ys > y) != (y2 > y)) & (x < (x2 - xs) * (y - ys) / (y2 - ys + 1e-12) + xs)
    return bool(np.count_nonzero(c) % 2)


def main():
    mask, (w, h) = load_mask()
    curves = [flatten(c) for c in potrace.Bitmap(mask).trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.2)]
    loops = [{"pts": p, "area": abs(area(p)), "bbox": (p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max())} for p in curves]
    # potracer also returns the frame of the bitmap itself; drop it
    loops = [l for l in loops if not (l["bbox"][0] < 1 and l["bbox"][1] < 1 and l["bbox"][2] > w - 1 and l["bbox"][3] > h - 1)]
    # nesting depth decides outer (even) vs hole (odd); group holes with the outer loop around them
    for i, a in enumerate(loops):
        parents = [j for j, b in enumerate(loops) if j != i and b["area"] > a["area"] and inside(a["pts"][0], b["pts"])]
        a["depth"] = len(parents)
        a["parent"] = min(parents, key=lambda j: loops[j]["area"]) if parents else None
    comps = {}
    for i, a in enumerate(loops):
        root = i
        while loops[root]["depth"] % 2 == 1:
            root = loops[root]["parent"]
        comps.setdefault(root, []).append(i)

    body = max(comps, key=lambda i: loops[i]["area"])
    head = None
    text = []
    for r, members in comps.items():
        if r == body:
            continue
        x0, y0, x1, y1 = loops[r]["bbox"]
        if x0 > 380 and y1 < 280:                       # round head above the globe
            head = r
        else:
            text.append(r)
    # calligraphy characters: two columns, right column (世新) read first
    chars = {}
    cells = [("世", 250, 118), ("新", 255, 222), ("新", 146, 172), ("聞", 146, 272)]
    for r in text:
        x0, y0, x1, y1 = loops[r]["bbox"]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        k = min(range(4), key=lambda i: (cells[i][1] - cx) ** 2 + (cells[i][2] - cy) ** 2)
        chars.setdefault(k, []).extend(comps[r])

    mark_ids = comps[body]
    allpts = np.concatenate([loops[i]["pts"] for i in mark_ids + comps[head]])
    mx0, my0 = allpts.min(0)
    mx1, my1 = allpts.max(0)
    cx, cy, s = (mx0 + mx1) / 2, (my0 + my1) / 2, (mx1 - mx0) / 2

    def norm(ids):
        return [[[round((x - cx) / s, 4), round((y - cy) / s, 4)] for x, y in loops[i]["pts"]] for i in ids]

    everything = np.concatenate([l["pts"] for l in loops])
    ex0, ey0 = (everything.min(0) - [cx, cy]) / s
    ex1, ey1 = (everything.max(0) - [cx, cy]) / s
    data = {
        "source": "SHU Journalism logo (department Facebook page), traced by assets/logo/trace_logo.py",
        "bounds": [round(v, 4) for v in (ex0, ey0, ex1, ey1)],
        "markBounds": [round(v, 4) for v in ((mx0 - cx) / s, (my0 - cy) / s, (mx1 - cx) / s, (my1 - cy) / s)],
        "mark": norm(mark_ids),
        "head": norm(comps[head]),
        "text": [{"ch": cells[k][0], "loops": norm(chars[k])} for k in sorted(chars)],
    }
    js = ("/* Generated by assets/logo/trace_logo.py - do not edit. */\n"
          "(function (G) { G.LOGO = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) +
          "; })(typeof window !== 'undefined' ? window : globalThis);\n")
    with open(OUT, "w") as f:
        f.write(js)
    npts = sum(len(l["pts"]) for l in loops)
    print(f"{len(loops)} loops ({npts} points): mark {len(mark_ids)}, head {len(comps[head])}, "
          f"text {[len(chars[k]) for k in sorted(chars)]}; {os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
