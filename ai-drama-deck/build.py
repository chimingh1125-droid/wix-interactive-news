"""Assemble the deck into one self-contained HTML file (images inlined as data URIs).

usage: python3 build.py [artifact_out.html]
Writes index.html next to this script; with an argument, also writes a copy without the
<!doctype>/<html>/<head>/<body> wrapper for publishing as an Artifact.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
TITLE = "解剖爆款 AI 劇"
FONTS = ("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700"
         "&family=IBM+Plex+Mono:wght@400;500&family=LXGW+WenKai+TC:wght@400;700"
         "&family=Noto+Sans+TC:wght@400;500;700;900&display=swap")

CONTROLS = """<div id="controls" role="toolbar" aria-label="簡報控制"><button id="prev" aria-label="上一張"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><span id="counter" aria-live="polite">01 / 01</span><button id="next" aria-label="下一張"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button><button id="replay" aria-label="重播本頁動畫（R）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg></button><button id="fs" aria-label="全螢幕（F）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>"""


def inline_images(html: str) -> str:
    cache = {}

    def sub(m):
        name = m.group(1)
        if name not in cache:
            data = (ROOT / "img" / f"{name}.webp").read_bytes()
            cache[name] = "data:image/webp;base64," + base64.b64encode(data).decode()
        return f'src="{cache[name]}"'

    out = re.sub(r'src="@([a-z0-9-]+)"', sub, html)
    print(f"inlined {len(cache)} images")
    return out


def main():
    css = (SRC / "deck.css").read_text(encoding="utf-8")
    slides = (SRC / "slides1.html").read_text(encoding="utf-8") + "\n" + (SRC / "slides2.html").read_text(encoding="utf-8")
    js = (SRC / "deck.js").read_text(encoding="utf-8")
    head = (
        f'<title>{TITLE}</title>\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'<link rel="stylesheet" href="{FONTS}">\n'
        f"<style>{css}</style>\n"
    )
    body = (
        '<div id="bar"></div><div id="hint">← → 或點擊畫面翻頁 · F 全螢幕 · R 重播動畫</div>\n'
        '<div id="viewport"><div id="stage" role="region" aria-roledescription="簡報" aria-label="解剖爆款：高推薦 AI 劇的公式結構與敘事模式">\n'
        f"{slides}\n</div></div>\n{CONTROLS}\n<script>{js}</script>\n"
    )
    body = inline_images(body)
    full = ('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + '</head>\n<body>\n' + body + '</body>\n</html>\n')
    (ROOT / "index.html").write_text(full, encoding="utf-8")
    print("index.html", len(full.encode()) // 1024, "KB")
    if len(sys.argv) > 1:
        pathlib.Path(sys.argv[1]).write_text(head + body, encoding="utf-8")
        print(sys.argv[1], len((head + body).encode()) // 1024, "KB")


if __name__ == "__main__":
    main()
