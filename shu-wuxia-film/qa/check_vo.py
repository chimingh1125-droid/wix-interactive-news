#!/usr/bin/env python3
"""Sanity-check the narration clips: NaN, clipping, runaway (non-speech) output."""
import json
import os
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    m = json.load(open(os.path.join(ROOT, "tts", "vo", "manifest.json")))
    print("voice", m["voice"], "speed", m["speed"])
    bad = 0
    for ln in m["lines"]:
        y, sr = sf.read(ln["file"])
        w = int(0.025 * sr)
        n = len(y) // w
        rms = np.sqrt((y[: n * w].reshape(n, w) ** 2).mean(1) + 1e-12)
        db = 20 * np.log10(rms / (np.abs(y).max() + 1e-12))
        voiced = db >= -38
        runs, i = [], 0
        while i < n:
            if voiced[i]:
                j = i
                while j < n and voiced[j]:
                    j += 1
                runs.append((j - i) * 0.025)
                i = j
            else:
                i += 1
        nan = int(np.isnan(y).sum())
        clip = int((np.abs(y) > 0.999).sum())
        longest = max(runs) if runs else 0.0
        # Kokoro speech has a pause at least every couple of seconds; a single
        # voiced run longer than that means the model produced noise.
        flag = nan > 0 or clip > 0 or longest > 2.0
        bad += int(flag)
        print(f"{ln['id']} {ln['dur']:.2f}s longest_run={longest:.2f}s nan={nan} clip={clip}"
              + ("  <-- CHECK" if flag else ""))
    total = sum(x["dur"] for x in m["lines"])
    print(f"total {total:.2f}s, flagged {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
