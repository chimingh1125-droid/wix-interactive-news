#!/usr/bin/env python3
"""Tile frames into a labelled contact sheet.

    python contact.py out.png cols width img1 img2 ...   (label = file stem)
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def main():
    out, cols, width = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    files = sys.argv[4:]
    ims = [Image.open(f).convert("RGB") for f in files]
    w = width
    h = int(ims[0].height * w / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * (h + 26) + 6), (20, 20, 20))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (im, f) in enumerate(zip(ims, files)):
        r, c = divmod(i, cols)
        x, y = 6 + c * (w + 6), 6 + r * (h + 26)
        sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y + 20))
        dr.text((x, y), os.path.splitext(os.path.basename(f))[0], fill=(230, 230, 230), font=font)
    sheet.save(out)
    print("sheet", out, sheet.size)


if __name__ == "__main__":
    main()
