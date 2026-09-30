#!/usr/bin/env python3
"""Extract representative screenshots of every scene from a final video.

    python scene_shots.py <video.mp4> <timeline.json> <out_dir> [label]

Two frames per scene (after the draw-on, and after the wuxia event), saved as
JPEGs plus one labelled contact sheet.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

# (fraction of the scene) for the two shots
PICK = {
    "opening": (0.35, 0.86), "title": (0.55, 0.85), "founding": (0.4, 0.8), "motto": (0.45, 0.8),
    "littleworld": (0.3, 0.72), "interview": (0.4, 0.62), "writing": (0.42, 0.78), "verify": (0.35, 0.72),
    "editing": (0.3, 0.86), "mission": (0.25, 0.8), "legacy": (0.4, 0.75), "endcard": (0.45, 0.8),
}
NAMES = {
    "opening": "開場：木柵・景美溪・山洞口", "title": "片名卡", "founding": "開山立派（1956）", "motto": "總訣：德智兼修 手腦並用",
    "littleworld": "《小世界》創刊（1957）", "interview": "第一式 採訪：獨孤九劍", "writing": "第二式 寫作：降龍十八掌",
    "verify": "第三式 查證：玄鐵重劍", "editing": "第四式 編輯：乾坤大挪移", "mission": "俠之大者（夜景）",
    "legacy": "感人收尾：最後一頁", "endcard": "片尾字卡",
}


def grab(video, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-q:v", "2", out], check=True)


def main():
    video, tl_path, out_dir = sys.argv[1:4]
    label = sys.argv[4] if len(sys.argv) > 4 else ""
    tl = json.load(open(tl_path))
    os.makedirs(out_dir, exist_ok=True)
    shots = []
    for i, s in enumerate(tl["scenes"]):
        for k, fr in enumerate(PICK[s["id"]]):
            t = s["start"] + fr * s["dur"]
            p = os.path.join(out_dir, f"{i + 1:02d}_{s['id']}_{k + 1}.jpg")
            grab(video, t, p)
            shots.append((p, f"{i + 1:02d} {NAMES[s['id']]}  @{t:.1f}s"))
    font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 22)
    tw, th = 640, 360
    cols = 4
    rows = (len(shots) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 8, rows * (th + 34) + 60), (18, 18, 18))
    dr = ImageDraw.Draw(sheet)
    dr.text((10, 14), label, fill=(240, 240, 240), font=font)
    for j, (p, cap) in enumerate(shots):
        r, c = divmod(j, cols)
        x, y = 8 + c * (tw + 8), 50 + r * (th + 34)
        sheet.paste(Image.open(p).resize((tw, th), Image.LANCZOS), (x, y + 28))
        dr.text((x, y), cap, fill=(235, 235, 235), font=font)
    out = os.path.join(out_dir, "contact_sheet.jpg")
    sheet.save(out, quality=90)
    print("shots:", len(shots), "->", out)


if __name__ == "__main__":
    main()
