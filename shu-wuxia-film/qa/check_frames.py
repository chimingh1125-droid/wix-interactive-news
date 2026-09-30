#!/usr/bin/env python3
"""Frame-by-frame QA of a rendered master.

Every frame is decoded and checked for:
  - blank / flat frames (render failure)              -> luminance std
  - pure-black holes (missing background/fill)        -> share of RGB < 12
  - missing paper texture (overlay failed to load)    -> texture energy in
    a flat corner patch
  - palette sanity (red day paper vs navy night)      -> mean hue vs scene
  - jumps: sudden frame-to-frame changes that are not scene cuts or
    scripted hits                                     -> diff spike vs median
  - frozen frames (identical to the previous frame)
Writes a JSON report and a metrics plot.

    python check_frames.py <master.mkv> <timeline.json> <cues.json> <out_prefix>
"""
import json
import subprocess
import sys

import numpy as np

W, H = 1920, 1080


def frames(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=W * H * 3 * 4)
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()


def main():
    master, tl_path, cues_path, out = sys.argv[1:5]
    tl = json.load(open(tl_path))
    cues = json.load(open(cues_path))
    fps = tl["fps"]
    # moments where big visual changes are expected
    expected = set()
    for s in tl["scenes"]:
        for k in range(int((s["start"] - 0.1) * fps), int((s["start"] + s["tin"] + 0.2) * fps) + 1):
            expected.add(k)
    for c in cues:
        if c["sfx"] in ("palmStrike", "swordStab", "doorCrash", "waveCrash", "titleHit", "clang", "swordSwing", "burstBell", "bowRelease", "thunder", "chimeBig", "rise", "shatter"):
            for k in range(int((c["t"] - 0.6) * fps), int((c["t"] + 1.2) * fps) + 1):
                expected.add(k)

    def scene_at(t):
        act = [s for s in tl["scenes"] if s["start"] <= t < s["start"] + s["dur"]]
        return act[-1] if act else tl["scenes"][-1]

    rows, prev, issues = [], None, []
    for f, fr in enumerate(frames(master)):
        t = f / fps
        small = fr[::4, ::4].astype(np.float32)
        lum = small @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        std = float(lum.std())
        black = float((fr[::2, ::2].max(axis=2) < 12).mean())
        # texture energy: high-pass in a background patch (top band, avoiding the logo)
        patch = fr[10:90, 700:1300].astype(np.float32).mean(axis=2)
        tex = float(np.abs(np.diff(patch, axis=1)).mean())
        mean = small.reshape(-1, 3).mean(0)
        diff = float(np.abs(small - prev).mean()) if prev is not None else 0.0
        frozen = prev is not None and diff == 0.0
        sc = scene_at(t)
        row = {"f": f, "t": round(t, 3), "scene": sc["id"], "std": round(std, 2), "black": round(black, 5), "tex": round(tex, 3),
               "r": round(float(mean[0]), 1), "g": round(float(mean[1]), 1), "b": round(float(mean[2]), 1), "diff": round(diff, 3), "frozen": frozen}
        rows.append(row)
        prev = small
        edge = t < 0.7 or t > tl["duration"] - 1.3  # global fade in/out
        if not edge:
            if std < 6:
                issues.append((f, "flat frame", std))
            if black > 0.004:
                issues.append((f, "black pixels", black))
            if tex < 0.35:
                issues.append((f, "paper texture missing?", tex))
            night = sc["palette"] == "night"
            in_trans = f in expected
            if not in_trans:
                if night and not (mean[2] > mean[0] * 0.8):
                    issues.append((f, "palette: expected navy", mean.tolist()))
                if not night and not (mean[0] > mean[2] * 1.4):
                    issues.append((f, "palette: expected red", mean.tolist()))
    diffs = np.array([r["diff"] for r in rows])
    med = float(np.median(diffs[1:]))
    for r in rows[1:]:
        if r["diff"] > max(6 * med, 4.0) and r["f"] not in expected and 0.7 < r["t"] < tl["duration"] - 1.3:
            issues.append((r["f"], "sudden change", r["diff"]))
    # frozen runs
    run = 0
    for r in rows:
        run = run + 1 if r["frozen"] else 0
        if run == 6:
            issues.append((r["f"], "frozen >= 6 frames", run))
    rep = {"frames": len(rows), "expected_frames": tl["frames"], "median_diff": med, "issues": issues}
    json.dump({"summary": rep, "rows": rows}, open(out + ".json", "w"))
    print(f"frames checked: {len(rows)} / {tl['frames']}  median diff {med:.3f}")
    print(f"issues: {len(issues)}")
    for it in issues[:60]:
        print("  ", it)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        t = np.array([r["t"] for r in rows])
        fig, ax = plt.subplots(4, 1, figsize=(18, 9), sharex=True)
        ax[0].plot(t, [r["std"] for r in rows], lw=0.7); ax[0].set_ylabel("lum std")
        ax[1].plot(t, diffs, lw=0.7); ax[1].set_ylabel("frame diff")
        ax[2].plot(t, [r["tex"] for r in rows], lw=0.7); ax[2].set_ylabel("paper tex")
        ax[3].plot(t, [r["r"] for r in rows], "r", lw=0.7); ax[3].plot(t, [r["b"] for r in rows], "b", lw=0.7); ax[3].set_ylabel("mean R/B")
        for s in tl["scenes"]:
            for a in ax:
                a.axvline(s["start"], color="gray", lw=0.6)
            ax[0].text(s["start"] + 0.3, ax[0].get_ylim()[1] * 0.9, s["id"], fontsize=8)
        for it in issues:
            for a in ax:
                a.axvline(it[0] / fps, color="orange", lw=0.5, alpha=0.5)
        plt.tight_layout()
        plt.savefig(out + ".png", dpi=70)
    except Exception as e:
        print("plot failed", e)


if __name__ == "__main__":
    main()
