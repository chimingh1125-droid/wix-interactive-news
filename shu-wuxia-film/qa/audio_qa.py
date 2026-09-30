#!/usr/bin/env python3
"""Audio QA: loudness, true peak, dropouts, and a spectrogram with scene marks.
    python audio_qa.py <mix.wav> <timeline.json> <out.png>"""
import json, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

x, sr = sf.read(sys.argv[1])
tl = json.load(open(sys.argv[2]))
m = pyln.Meter(sr)
print(f"{sys.argv[1]}: {len(x)/sr:.2f}s, integrated {m.integrated_loudness(x):.2f} LUFS")
over = signal.resample_poly(x, 4, 1, axis=0)
print(f"true peak {20*np.log10(np.abs(over).max()):.2f} dBTP, nan={int(np.isnan(x).sum())}")
# short-term loudness (3 s) and dropouts (400 ms windows)
w = int(0.4 * sr)
rms = np.array([np.sqrt((x[i:i+w]**2).mean()) for i in range(0, len(x)-w, w)])
db = 20*np.log10(rms+1e-12)
quiet = [(round(i*0.4,1), round(v,1)) for i, v in enumerate(db) if v < -45]
print("windows below -45 dBFS:", quiet[:20], "count", len(quiet))
mono = x.mean(1)
f, t, Z = signal.spectrogram(mono, sr, nperseg=2048, noverlap=1024)
fig, ax = plt.subplots(2, 1, figsize=(18, 7), sharex=True)
ax[0].plot(np.arange(len(db))*0.4, db, lw=0.8); ax[0].set_ylabel("RMS dBFS (400ms)"); ax[0].set_ylim(-60, 0)
ax[1].pcolormesh(t, f, 10*np.log10(Z+1e-12), shading="auto", vmin=-110, vmax=-30, cmap="magma"); ax[1].set_ylim(0, 8000); ax[1].set_ylabel("Hz")
for s in tl["scenes"]:
    for a in ax: a.axvline(s["start"], color="c", lw=0.8)
    ax[0].text(s["start"]+0.3, -5, s["id"], fontsize=8, color="c")
    for ln in s["lines"]:
        ax[0].axvspan(ln["abs0"], ln["abs1"], color="y", alpha=0.15)
plt.tight_layout(); plt.savefig(sys.argv[3], dpi=80)
print("plot", sys.argv[3])
