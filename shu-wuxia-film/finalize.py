#!/usr/bin/env python3
"""Encode the deliverables for one cut (full / short).

  <name>_clean.mp4        picture + narration + music + SFX, no subtitles
  <name>_clean_novo.mp4   picture + music + SFX (no narration, no subtitles)
  <name>_subtitled.mp4    bilingual subtitles burned in (zh on top, en italic)
  <name>.srt              bilingual subtitle file

H.264 High / yuv420p / BT.709, 30 fps, AAC 48 kHz. After encoding, the
loudness of every MP4 is re-measured with ffmpeg's EBU R128 meter.

    python finalize.py full|short
"""
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "output")
W, H = 1920, 1080
VENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "{crf}", "-tune", "animation", "-profile:v", "high", "-level", "4.1",
        "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-g", "60",
        "-bf", "3", "-movflags", "+faststart"]
AENC = ["-c:a", "aac", "-b:a", "256k", "-ar", "48000"]
VF = "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd+full_chroma_int,format=yuv420p"


def venc(crf):
    return [x.replace("{crf}", str(crf)) for x in VENC]


def run(cmd, **kw):
    print("$", " ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True, **kw)


def encode_clean(master, audio, out, crf):
    run(["ffmpeg", "-y", "-v", "error", "-i", master, "-i", audio, "-map", "0:v", "-map", "1:a", "-vf", VF] + venc(crf) + AENC + ["-shortest", out])


def encode_subtitled(master, audio, subs_dir, out, fps, crf):
    cues = json.load(open(os.path.join(subs_dir, "cues.json")))
    cards = {c["id"]: np.asarray(Image.open(os.path.join(subs_dir, c["id"] + ".png")).convert("RGBA"), np.float32) / 255.0 for c in cues}
    band_y = H - 300
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", master, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                            "-i", audio, "-map", "0:v", "-map", "1:a", "-vf", VF] + venc(crf) + AENC + ["-shortest", out], stdin=subprocess.PIPE)
    n = W * H * 3
    f = 0
    fade = 0.18
    while True:
        buf = dec.stdout.read(n)
        if len(buf) < n:
            break
        t = f / fps
        active = [c for c in cues if c["start"] - fade <= t <= c["end"] + fade]
        if active:
            fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0
            for c in active:
                a = min(1.0, (t - (c["start"] - fade)) / fade, ((c["end"] + fade) - t) / fade)
                a = max(0.0, a)
                card = cards[c["id"]]
                al = card[:, :, 3:4] * a
                reg = fr[band_y:band_y + 300]
                fr[band_y:band_y + 300] = reg * (1 - al) + card[:, :, :3] * al
            buf = (np.clip(fr, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()
        enc.stdin.write(buf)
        f += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()
    if enc.returncode != 0:
        raise SystemExit("encoder failed")
    return f


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,sample_rate,channels",
                        "-show_entries", "format=duration,size,bit_rate", "-of", "json", path], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def loudness(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", txt)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", txt)
    lra = re.search(r"LRA:\s+(-?[\d.]+) LU", txt)
    return {"integrated_lufs": float(i.group(1)) if i else None, "true_peak_dbtp": float(tp.group(1)) if tp else None, "lra_lu": float(lra.group(1)) if lra else None}


def main():
    variant = sys.argv[1]
    crf = int(sys.argv[2]) if len(sys.argv) > 2 else 19
    tl = json.load(open(os.path.join(B, f"timeline_{variant}.json")))
    master = os.path.join(B, f"render_{variant}", "master.mkv")
    mix, novo = os.path.join(B, f"mix_{variant}.wav"), os.path.join(B, f"mix_{variant}_novo.wav")
    subs = os.path.join(B, f"subs_{variant}")
    os.makedirs(OUT, exist_ok=True)
    name = "shu_journalism_wuxia" + ("" if variant == "full" else "_short90s")
    outs = {
        "clean": os.path.join(OUT, f"{name}_clean.mp4"),
        "clean_novo": os.path.join(OUT, f"{name}_clean_no_narration.mp4"),
        "subtitled": os.path.join(OUT, f"{name}_subtitled_zh_en.mp4"),
    }
    encode_clean(master, mix, outs["clean"], crf)
    encode_clean(master, novo, outs["clean_novo"], crf)
    nf = encode_subtitled(master, mix, subs, outs["subtitled"], tl["fps"], crf)
    shutil.copy(os.path.join(subs, "subtitles.srt"), os.path.join(OUT, f"{name}_zh_en.srt"))
    report = {"variant": variant, "timeline_frames": tl["frames"], "timeline_duration": tl["duration"], "composited_frames": nf, "files": {}}
    for k, p in outs.items():
        pr = probe(p)
        report["files"][k] = {"path": os.path.relpath(p, ROOT), "probe": pr, "loudness": loudness(p)}
        v = [s for s in pr["streams"] if s.get("codec_name") == "h264"][0]
        print(f"{k:11s} {os.path.getsize(p) / 1e6:6.1f} MB  frames={v.get('nb_read_frames')}  {report['files'][k]['loudness']}")
    json.dump(report, open(os.path.join(B, f"final_{variant}.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
