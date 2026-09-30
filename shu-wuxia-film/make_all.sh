#!/usr/bin/env bash
# Rebuild the whole film from the script: narration -> timeline -> frames ->
# score + SFX + mix -> subtitles -> encodes -> QA.
#
# Needs: ffmpeg, Node 22 + Playwright (Chromium), Python 3.11 venv with
# requirements.txt, and the Kokoro-82M ONNX model + voices (see README).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/opt/venv/bin/python}
WORKERS=${WORKERS:-4}

$PY assets/fetch_fonts.py
$PY assets/logo/trace_logo.py
$PY render/make_paper.py
$PY render/make_paper.py 1080 1920 render/paper_v.png
$PY tts/make_vo.py --voice zm_yunyang --speed 0.80
$PY qa/check_vo.py
$PY build_timeline.py full short

for v in full short; do
  node render/render.mjs build/timeline_$v.json build/render_$v "$WORKERS"
  node render/export_cues.mjs build/timeline_$v.json build/cues_$v.json
  (cd audio && $PY music.py ../build/timeline_$v.json ../build/cues_$v.json ../build/music_$v.wav \
            && $PY mix.py ../build/timeline_$v.json ../build/music_$v.wav ../build/cues_$v.json ../build/mix_$v)
  node subs/make_subs.mjs build/timeline_$v.json build/subs_$v
  $PY finalize.py $v
  $PY qa/check_frames.py build/render_$v/master.mkv build/timeline_$v.json build/cues_$v.json build/qa_$v
done

# 9:16 vertical versions of the subtitled cuts
for v in full short; do
  node render/vertical_assets.mjs build/subs_$v build/vertical_$v
  $PY vertical.py $v
done
