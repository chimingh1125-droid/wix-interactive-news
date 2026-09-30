#!/usr/bin/env python3
"""9:16 (1080x1920) version of the subtitled cut, for phones, Reels and Shorts.

The whole 16:9 picture is kept (the action spans the full width, so cropping
would cut off characters, labels and the department logo): it runs as a band
across the middle of a red-paper page that carries the department logo and
the title, and the bilingual subtitles are set larger in the band below it.
Picture, narration, music and SFX are the same as the landscape cut.

    python vertical.py full|short [crf]            -> output/<name>_9x16.mp4
    python vertical.py full|short --target-mb 29   -> build/vertical_compact/
        (two-pass copy that fits a size limit, e.g. for sending in chat apps)

Needs build/render_<cut>/master.mkv, build/mix_<cut>.wav, build/subs_<cut>/
and the page + subtitle cards from
    node render/vertical_assets.mjs build/subs_<cut> build/vertical_<cut>
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

import finalize as F

ROOT = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(ROOT, "build")
FADE = 0.18   # same subtitle fades as the landscape burn-in


class Cut:
    def __init__(self, variant):
        self.variant = variant
        self.tl = json.load(open(os.path.join(B, f"timeline_{variant}.json")))
        self.fps = self.tl["fps"]
        assets = os.path.join(B, f"vertical_{variant}")
        self.L = json.load(open(os.path.join(assets, "layout.json")))
        self.page = np.asarray(Image.open(os.path.join(assets, "page.png")).convert("RGB"), np.uint8)
        assert self.page.shape == (self.L["h"], self.L["w"], 3), self.page.shape
        self.cues = json.load(open(os.path.join(B, f"subs_{variant}", "cues.json")))
        self.cards = {c["id"]: np.asarray(Image.open(os.path.join(assets, c["id"] + ".png")).convert("RGBA"), np.float32) / 255.0 for c in self.cues}
        self.master = os.path.join(B, f"render_{variant}", "master.mkv")
        self.audio = os.path.join(B, f"mix_{variant}.wav")
        self.name = "shu_journalism_wuxia" + ("" if variant == "full" else "_short90s") + "_subtitled_zh_en_9x16"

    def frames(self):
        """Yield every composited 9:16 frame as raw RGB bytes."""
        W, VY, VH, SY, SH = self.L["w"], self.L["video_y"], self.L["video_h"], self.L["sub_y"], self.L["sub_h"]
        dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", self.master, "-vf", f"scale={W}:{VH}:flags=lanczos+accurate_rnd+full_chroma_int",
                                "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=W * VH * 3 * 2)
        n, f = W * VH * 3, 0
        while True:
            buf = dec.stdout.read(n)
            if len(buf) < n:
                break
            t = f / self.fps
            frame = self.page.copy()
            frame[VY:VY + VH] = np.frombuffer(buf, np.uint8).reshape(VH, W, 3)
            for c in self.cues:
                if not (c["start"] - FADE <= t <= c["end"] + FADE):
                    continue
                a = max(0.0, min(1.0, (t - (c["start"] - FADE)) / FADE, ((c["end"] + FADE) - t) / FADE))
                card = self.cards[c["id"]]
                al = card[:, :, 3:4] * a
                reg = frame[SY:SY + SH].astype(np.float32) / 255.0
                frame[SY:SY + SH] = (np.clip(reg * (1 - al) + card[:, :, :3] * al, 0, 1) * 255 + 0.5).astype(np.uint8)
            yield frame.tobytes()
            f += 1
        dec.wait()
        if dec.returncode != 0:
            raise SystemExit("decoder failed")

    def encode(self, out, vopts, audio_opts):
        W, H = self.L["w"], self.L["h"]
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(self.fps), "-i", "-"]
        cmd += (["-i", self.audio, "-map", "0:v", "-map", "1:a"] if audio_opts else ["-map", "0:v"]) + ["-vf", F.VF] + vopts
        cmd += (audio_opts + ["-shortest", out]) if audio_opts else ["-an", "-f", "mp4", out]
        enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        nf = 0
        for fr in self.frames():
            enc.stdin.write(fr)
            nf += 1
        enc.stdin.close()
        enc.wait()
        if enc.returncode != 0:
            raise SystemExit("encoder failed")
        return nf

    def report(self, out, nf, key):
        pr = F.probe(out)
        v = [s for s in pr["streams"] if s.get("codec_name") == "h264"][0]
        info = {"variant": self.variant, "path": os.path.relpath(out, ROOT), "timeline_frames": self.tl["frames"], "composited_frames": nf,
                "size": [v["width"], v["height"]], "probe": pr, "loudness": F.loudness(out)}
        json.dump(info, open(os.path.join(B, f"{key}_{self.variant}.json"), "w"), indent=1)
        print(f"{os.path.basename(out)}  {os.path.getsize(out) / 1e6:.1f} MB  {v['width']}x{v['height']}  "
              f"frames={v.get('nb_read_frames')}/{self.tl['frames']}  {info['loudness']}")


def main():
    cut = Cut(sys.argv[1])
    if "--target-mb" in sys.argv:
        # two-pass to a size budget: 160 kbps audio, the rest for video
        target = float(sys.argv[sys.argv.index("--target-mb") + 1]) * 1e6 * 0.98
        kbps = int((target * 8 / cut.tl["duration"] - 160_000) / 1000)
        odir = os.path.join(B, "vertical_compact")
        os.makedirs(odir, exist_ok=True)
        out, log = os.path.join(odir, cut.name + "_compact.mp4"), os.path.join(odir, cut.name + "_2pass")
        base = F.venc(0)
        i = base.index("-crf")
        vopts = lambda n: base[:i] + ["-b:v", f"{kbps}k", "-pass", str(n), "-passlogfile", log] + base[i + 2:]
        pass1 = vopts(1)
        j = pass1.index("-movflags")          # no faststart rewrite when writing to /dev/null
        cut.encode("/dev/null", pass1[:j] + pass1[j + 2:], None)
        nf = cut.encode(out, vopts(2), ["-c:a", "aac", "-b:a", "160k", "-ar", "48000"])
        cut.report(out, nf, "final_vertical_compact")
    else:
        crf = int(sys.argv[2]) if len(sys.argv) > 2 else 22
        out = os.path.join(F.OUT, cut.name + ".mp4")
        nf = cut.encode(out, F.venc(crf), F.AENC)
        cut.report(out, nf, "final_vertical")


if __name__ == "__main__":
    main()
