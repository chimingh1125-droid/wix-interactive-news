#!/usr/bin/env python3
"""Build the edit timeline from the measured narration.

Scene length = lead-in + narration lines (exact clip durations) + gaps +
tail. Consecutive scenes overlap by the incoming scene's transition time
(brush wipe / fade) and no narration plays inside a transition. The same
file drives the renderer, the subtitles and the audio mix, so picture,
subtitles and voice stay frame-accurate.

    python build_timeline.py full   -> build/timeline_full.json
    python build_timeline.py short  -> build/timeline_short.json (≈ 90 s)
    python build_timeline.py 60s    -> build/timeline_60s.json (60-second promo)
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# pre: before first line, gaps: between lines, post: after last line (s)
FULL = {
    "opening":     {"pre": 2.6, "gaps": [1.4], "post": 2.8},
    "title":       {"pre": 2.0, "post": 3.6},
    "founding":    {"pre": 1.7, "gaps": [1.5], "post": 2.2},
    "motto":       {"pre": 1.5, "gaps": [1.1], "post": 2.6},
    "littleworld": {"pre": 1.5, "gaps": [1.1], "post": 2.4},
    "interview":   {"pre": 1.3, "gaps": [1.9], "post": 2.4},
    "writing":     {"pre": 1.3, "gaps": [2.2], "post": 2.4},
    "verify":      {"pre": 1.5, "gaps": [1.7], "post": 2.4},
    "editing":     {"pre": 1.3, "gaps": [1.8], "post": 2.4},
    "mission":     {"pre": 2.0, "gaps": [1.4, 1.1], "post": 2.1},
    "legacy":      {"pre": 1.8, "gaps": [1.5], "post": 3.2},
    "endcard":     {"pre": 1.7, "post": 4.8},
}
# 1:30 cut: one or two lines per scene, same scenes and choreography
SHORT_LINES = {
    "opening": ["L01"], "title": ["L03"], "founding": ["L04"], "motto": ["L06"],
    "littleworld": ["L08"], "interview": ["L10"], "writing": ["L12"], "verify": ["L14"],
    "editing": ["L16"], "mission": ["L18", "L20"], "legacy": ["L21", "L22"], "endcard": ["L23"],
}
SHORT = {
    "opening":     {"pre": 1.9, "post": 3.0},
    "title":       {"pre": 1.8, "post": 2.5},
    "founding":    {"pre": 1.5, "post": 2.5},
    "motto":       {"pre": 1.4, "post": 3.1},
    "littleworld": {"pre": 1.4, "post": 2.3},
    "interview":   {"pre": 1.2, "post": 2.6},
    "writing":     {"pre": 1.2, "post": 3.3},
    "verify":      {"pre": 1.4, "post": 2.5},
    "editing":     {"pre": 1.2, "post": 3.5},
    "mission":     {"pre": 1.8, "gaps": [1.1], "post": 1.6},
    "legacy":      {"pre": 1.6, "gaps": [1.1], "post": 2.3},
    "endcard":     {"pre": 1.5, "post": 3.6},
}
TRANSITION = {"mission": ("wipe", 1.0), "legacy": ("wipe", 1.0)}
DEFAULT_TIN = 0.8


# 60-second promo cut (script_60s.json): seven segments at fixed times. Brush
# wipes are centred on each boundary; both lines of a segment play inside it.
P60 = {"tin": 0.5, "lead": 0.45, "gap": 0.4, "first_lead": 0.28, "first_gap": 0.2, "total": 59.8}
P60_TEXTS = ["世新新聞系武功秘笈", "武功秘笈", "舍我樓", "世新大學", "世新大學新聞學系", "AI與媒體產業", "解鎖", "採訪", "剪輯", "AI生成",
             "社群營運", "個人申請", "志願填報", "熱烈招募中", "個人申請／志願填報熱烈招募中", "降龍十八掌", "玄鐵重劍", "獨孤九劍",
             "乾坤大挪移", "喬峰", "楊過", "令狐沖", "張無忌", "新聞", "報", "舊聞", "日報", "短影音", "創意", "迷因", "爆", "讚", "哈",
             "一二三四五六七八九十", "風華七十傳世新章"]


def snap(x):
    return round(x * FPS) / FPS


def build_60s():
    script = json.load(open(os.path.join(ROOT, "script", "script_60s.json")))
    vo = {l["id"]: l for l in json.load(open(os.path.join(ROOT, "tts", "vo_60s", "manifest.json")))["lines"]}
    S = script["scenes"]
    scenes, texts, warn = [], [], []
    for i, sc in enumerate(S):
        a, b = sc["seg"]
        tin = 0.0 if i == 0 else P60["tin"]
        start = 0.0 if i == 0 else snap(a - tin / 2)
        end = snap(S[i + 1]["seg"][0] + P60["tin"] / 2) if i < len(S) - 1 else snap(P60["total"])
        limit = (S[i + 1]["seg"][0] - P60["tin"] / 2 - 0.05) if i < len(S) - 1 else P60["total"] - 2.0
        cur = a + (P60["first_lead"] if i == 0 else P60["lead"]) - start
        gap = P60["first_gap"] if i == 0 else P60["gap"]
        out_lines = []
        for k, ln in enumerate(sc["lines"]):
            d = vo[ln["id"]]["dur"]
            out_lines.append({
                "id": ln["id"], "zh": ln["zh"], "en": ln["en"], "file": os.path.relpath(vo[ln["id"]]["file"], ROOT),
                "t0": round(cur, 4), "t1": round(cur + d, 4), "dur": d,
                "abs0": round(start + cur, 4), "abs1": round(start + cur + d, 4),
            })
            texts.append(ln["zh"])
            cur += d + gap
        if out_lines[-1]["abs1"] > limit:
            warn.append(f"{sc['id']}: narration ends {out_lines[-1]['abs1']:.2f}s, past {limit:.2f}s")
        scenes.append({"id": sc["id"], "kind": sc["kind"], "palette": sc["palette"], "start": start, "dur": snap(end - start),
                       "tin": tin, "transition": "wipe", "lines": out_lines, "variant": "60s", "seg": sc["seg"]})
    duration = snap(P60["total"])
    tl = {"variant": "60s", "fps": FPS, "width": 1920, "height": 1080, "duration": duration,
          "frames": int(round(duration * FPS)), "scenes": scenes, "texts": texts + P60_TEXTS + [script["title_zh"]]}
    out = os.path.join(ROOT, "build", "timeline_60s.json")
    json.dump(tl, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"60s: {len(scenes)} scenes, {duration:.2f}s, {tl['frames']} frames -> {out}")
    for s_ in scenes:
        ls = ", ".join(f"{l['id']}@{l['abs0']:.2f}-{l['abs1']:.2f}" for l in s_["lines"])
        print(f"  {s_['id']:11s} {s_['start']:6.2f} +{s_['dur']:5.2f} seg={s_['seg']}  {ls}")
    for w in warn:
        print("  WARNING", w)
    if warn:
        raise SystemExit(1)
    return tl


def build(variant):
    script = json.load(open(os.path.join(ROOT, "script", "script.json")))
    vo = {l["id"]: l for l in json.load(open(os.path.join(ROOT, "tts", "vo", "manifest.json")))["lines"]}
    params = FULL if variant == "full" else SHORT
    scenes, t, texts = [], 0.0, []
    for i, sc in enumerate(script["scenes"]):
        prm = params[sc["id"]]
        lines = sc["lines"]
        if variant == "short":
            keep = SHORT_LINES[sc["id"]]
            lines = [l for l in lines if l["id"] in keep]
        kind, tin = TRANSITION.get(sc["id"], ("wipe", DEFAULT_TIN))
        if i == 0:
            tin = 0.0
        start = snap(max(0.0, t - tin))
        # narration must not start before the transition has finished
        pre = max(prm["pre"], tin + 0.45)
        cur = pre
        out_lines = []
        gaps = prm.get("gaps", [])
        for k, ln in enumerate(lines):
            d = vo[ln["id"]]["dur"]
            out_lines.append({
                "id": ln["id"], "zh": ln["zh"], "en": ln["en"], "file": os.path.relpath(vo[ln["id"]]["file"], ROOT),
                "t0": round(cur, 4), "t1": round(cur + d, 4), "dur": d,
                "abs0": round(start + cur, 4), "abs1": round(start + cur + d, 4),
            })
            texts += [ln["zh"]]
            cur += d
            if k < len(lines) - 1:
                cur += gaps[k] if k < len(gaps) else 1.0
        dur = snap(cur + prm["post"])
        scenes.append({
            "id": sc["id"], "kind": sc["kind"], "palette": sc["palette"], "start": start, "dur": dur,
            "tin": tin, "transition": kind, "lines": out_lines, "variant": variant,
        })
        t = start + dur
    duration = snap(t)
    tl = {
        "variant": variant, "fps": FPS, "width": 1920, "height": 1080, "duration": duration,
        "frames": int(round(duration * FPS)), "scenes": scenes,
        "texts": texts + [script["title_zh"], "世新大學新聞學系", "世新新聞", "德智兼修手腦並用", "風華七十傳世新章",
                          "第一式第二式第三式第四式獨孤九劍降龍十八掌玄鐵重劍乾坤大挪移採訪寫作查證編輯",
                          "小世界台灣立報世界新聞職業學校開山立派襄陽俠之大者為國為民秘笈武功一九五六七年月",
                          "舍我德智兼修手腦並用左右互搏周伯通令狐沖喬峰楊過張無忌郭靖成舍我無可奉告官腔沒有意見",
                          "謠言未證實假消息真相查證據實報導頭條新聞導言開門見山重點世新大學山洞口溝子口木柵景美溪"],
    }
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    out = os.path.join(ROOT, "build", f"timeline_{variant}.json")
    json.dump(tl, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"{variant}: {len(scenes)} scenes, {duration:.2f}s, {tl['frames']} frames -> {out}")
    for s in scenes:
        ls = ", ".join(f"{l['id']}@{l['abs0']:.2f}-{l['abs1']:.2f}" for l in s["lines"])
        print(f"  {s['id']:12s} {s['start']:7.2f} +{s['dur']:6.2f} tin={s['tin']:.1f}  {ls}")
    return tl


if __name__ == "__main__":
    for v in (sys.argv[1:] or ["full", "short"]):
        build_60s() if v == "60s" else build(v)
