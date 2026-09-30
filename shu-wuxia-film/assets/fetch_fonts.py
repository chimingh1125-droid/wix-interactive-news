#!/usr/bin/env python3
"""Download the web fonts used by the renderer into assets/fonts.

Google Fonts serves CJK families as many unicode-range slices; we mirror all
of them and rewrite the CSS to point at the local files, so rendering never
touches the network.
"""
import hashlib
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fonts")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
FAMILIES = [
    # Iansui (芫荽): Traditional Chinese Kai-style face that follows the Taiwan
    # MOE standard glyph forms (LXGW WenKai TC, used before, keeps inherited
    # forms such as 兼 with a 秝 top, 爲, 眞 and the two-dot 辶).
    "Iansui",
    "Cormorant+Garamond:ital,wght@0,600;1,500;1,600",
]


def curl(url, dest=None):
    cmd = ["curl", "-sS", "--fail", "--max-time", "60", "-A", UA, url]
    if dest:
        cmd += ["-o", dest]
        subprocess.run(cmd, check=True)
        return None
    return subprocess.run(cmd, check=True, capture_output=True).stdout.decode()


def main():
    os.makedirs(OUT, exist_ok=True)
    url = "https://fonts.googleapis.com/css2?" + "&".join("family=" + f for f in FAMILIES) + "&display=block"
    css = curl(url)
    n = 0

    def repl(m):
        nonlocal n
        src = m.group(1)
        name = hashlib.sha1(src.encode()).hexdigest()[:16] + ".woff2"
        dest = os.path.join(OUT, name)
        if not os.path.exists(dest):
            curl(src, dest)
        n += 1
        return f"url(fonts/{name})"

    css = re.sub(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", repl, css)
    with open(os.path.join(HERE, "fonts.css"), "w") as f:
        f.write(css)
    print(f"{n} font files, css written")


if __name__ == "__main__":
    main()
