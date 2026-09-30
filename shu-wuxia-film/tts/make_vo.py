#!/usr/bin/env python3
"""Generate the Mandarin narration with Kokoro-82M (offline ONNX).

Every line of script.json becomes one WAV, trimmed of edge silence, and a
manifest records the exact duration of each clip. The timeline builder uses
those durations to size the scenes, so picture, subtitles and voice stay in
sync.

G2P follows misaki's legacy Chinese frontend (the one Kokoro v1.0 was trained
with) but adds explicit readings for the polyphonic characters and wuxia
names in this script, which the stock dictionary gets wrong
(e.g. 木柵 mù zhà, 降龍 xiáng lóng, 乾坤 qián kūn, 為國 wèi guó).
"""
import argparse
import json
import os
import re
import sys

import jieba
import numpy as np
import onnxruntime as ort
import soundfile as sf
from misaki.zh import ZHG2P
from pypinyin import Style, lazy_pinyin, load_phrases_dict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL = os.environ.get("KOKORO_MODEL", "/opt/tts/kokoro-fp32.onnx")
VOICES = os.environ.get("KOKORO_VOICES", "/opt/tts/voices-v1.0.npz")
SR = 24000

# Readings for names and polyphones used in the script (tone-marked pinyin).
PHRASES = {
    "木柵": "mù zhà",
    "景美溪": "jǐng měi xī",
    "溪畔": "xī pàn",
    "溝子口": "gōu zi kǒu",
    "山洞": "shān dòng",
    "藏著": "cáng zhe",
    "成舍我": "chéng shě wǒ",
    "報人": "bào rén",
    "開山立派": "kāi shān lì pài",
    "只有": "zhǐ yǒu",
    "總訣": "zǒng jué",
    "德智兼修": "dé zhì jiān xiū",
    "手腦並用": "shǒu nǎo bìng yòng",
    "周伯通": "zhōu bó tōng",
    "左右互搏": "zuǒ yòu hù bó",
    "實習刊物": "shí xí kān wù",
    "小世界": "xiǎo shì jiè",
    "印報": "yìn bào",
    "令狐沖": "lìng hú chōng",
    "獨孤九劍": "dú gū jiǔ jiàn",
    "破綻": "pò zhàn",
    "刺穿": "cì chuān",
    "千言萬語": "qiān yán wàn yǔ",
    "喬峰": "qiáo fēng",
    "降龍十八掌": "xiáng lóng shí bā zhǎng",
    "招招到位": "zhāo zhāo dào wèi",
    "導言": "dǎo yán",
    "開門見山": "kāi mén jiàn shān",
    "重點": "zhòng diǎn",
    "查證": "chá zhèng",
    "楊過": "yáng guò",
    "玄鐵重劍": "xuán tiě zhòng jiàn",
    "重劍無鋒": "zhòng jiàn wú fēng",
    "重劍": "zhòng jiàn",
    "狂潮": "kuáng cháo",
    "站得穩": "zhàn de wěn",
    "張無忌": "zhāng wú jì",
    "乾坤大挪移": "qián kūn dà nuó yí",
    "挪移乾坤": "nuó yí qián kūn",
    "鉛字": "qiān zì",
    "排版": "pái bǎn",
    "數位": "shù wèi",
    "郭靖": "guō jìng",
    "俠之大者": "xiá zhī dà zhě",
    "為國為民": "wèi guó wèi mín",
    "健全": "jiàn quán",
    "那年": "nà nián",
    "創辦": "chuàng bàn",
    "台灣立報": "tái wān lì bào",
    "秘笈": "mì jí",
    "空白": "kòng bái",
    "執筆": "zhí bǐ",
    "留給": "liú gěi",
    "傳下": "chuán xià",
    "傳過": "chuán guò",
    "風華": "fēng huá",
    "傳世新章": "chuán shì xīn zhāng",
    "新聞系": "xīn wén xì",
    "都": "dōu",
}


def setup_dictionaries():
    for word, py in PHRASES.items():
        jieba.add_word(word, freq=2_000_000)
        syl = py.split()
        assert len(syl) == len(word), (word, py)
        load_phrases_dict({word: [[s] for s in syl]})


def word_pinyin(w):
    return lazy_pinyin(w, style=Style.TONE3, neutral_tone_with_five=True)


def to_phonemes(text):
    """Mirror of misaki.zh.ZHG2P.legacy_call with our dictionaries loaded."""
    text = ZHG2P.map_punctuation(text)
    out, pys = "", []
    for seg in re.findall(r"[一-鿿]+|[^一-鿿]+", text):
        if re.match(r"[一-鿿]", seg):
            words = jieba.lcut(seg, cut_all=False)
            parts = []
            for w in words:
                p = word_pinyin(w)
                pys.append("".join(p))
                parts.append("".join(ZHG2P.py2ipa(s) for s in p))
            out += " ".join(parts)
        else:
            out += seg
            pys.append(seg.strip())
    return out.replace(chr(815), ""), " ".join(x for x in pys if x)


class Kokoro:
    def __init__(self):
        import kokoro_onnx
        cfg = json.load(open(os.path.join(os.path.dirname(kokoro_onnx.__file__), "config.json")))
        self.vocab = cfg["vocab"]
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = os.cpu_count() or 4
        self.sess = ort.InferenceSession(MODEL, opts, providers=["CPUExecutionProvider"])
        self.voices = np.load(VOICES)

    def voice(self, spec):
        # "a" or "a:0.7,b:0.3" blends style vectors
        parts = [p.split(":") for p in spec.split(",")]
        acc = None
        for p in parts:
            v = self.voices[p[0]].astype(np.float32) * (float(p[1]) if len(p) > 1 else 1.0)
            acc = v if acc is None else acc + v
        return acc

    def synth(self, phonemes, voice, speed):
        toks = [self.vocab[c] for c in phonemes if c in self.vocab]
        dropped = [c for c in phonemes if c not in self.vocab]
        if dropped:
            print("   dropped phonemes:", dropped)
        style = voice[min(len(toks), len(voice)) - 1]
        out = self.sess.run(None, {
            "input_ids": np.array([[0, *toks, 0]], dtype=np.int64),
            "style": np.asarray(style, dtype=np.float32).reshape(1, 256),
            "speed": np.array([speed], dtype=np.float32),
        })
        return np.asarray(out[0]).ravel().astype(np.float32)


def trim(x, thresh_db=-45.0, pad=0.04):
    """Trim leading/trailing silence using a short-window RMS gate."""
    win = int(0.01 * SR)
    n = len(x) // win
    if n == 0:
        return x
    frames = x[: n * win].reshape(n, win)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms / (np.abs(x).max() + 1e-9))
    on = np.where(db > thresh_db)[0]
    if len(on) == 0:
        return x
    a = max(0, on[0] * win - int(pad * SR))
    b = min(len(x), (on[-1] + 1) * win + int(pad * SR))
    y = x[a:b].copy()
    f = int(0.008 * SR)  # tiny fades to avoid clicks
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=None)
    ap.add_argument("--speed", type=float, default=0.80)
    ap.add_argument("--out", default=os.path.join(ROOT, "tts", "vo"))
    ap.add_argument("--only", default=None, help="comma list of line ids")
    ap.add_argument("--dry", action="store_true", help="print pinyin/phonemes only")
    args = ap.parse_args()

    script = json.load(open(os.path.join(ROOT, "script", "script.json")))
    voice_spec = args.voice or script.get("voice", "zm_yunyang")
    setup_dictionaries()
    os.makedirs(args.out, exist_ok=True)

    tts = None if args.dry else Kokoro()
    vstyle = None if args.dry else tts.voice(voice_spec)
    manifest = {"voice": voice_spec, "speed": args.speed, "sr": SR, "lines": []}
    only = set(args.only.split(",")) if args.only else None
    for sc in script["scenes"]:
        for ln in sc["lines"]:
            if only and ln["id"] not in only:
                continue
            ph, py = to_phonemes(ln["tts"])
            print(f"{ln['id']} {ln['tts']}\n   {py}\n   {ph}")
            if args.dry:
                continue
            audio = trim(tts.synth(ph, vstyle, args.speed))
            peak = np.abs(audio).max()
            audio = audio / (peak + 1e-9) * 10 ** (-3 / 20)
            path = os.path.join(args.out, f"{ln['id']}.wav")
            sf.write(path, audio, SR, subtype="PCM_24")
            dur = len(audio) / SR
            cps = len(re.sub(r"[^一-鿿]", "", ln["tts"])) / dur
            print(f"   -> {dur:.2f}s  ({cps:.2f} chars/s)")
            manifest["lines"].append({"id": ln["id"], "scene": sc["id"], "file": path,
                                      "dur": round(dur, 4), "pinyin": py})
    if not args.dry and not only:
        with open(os.path.join(args.out, "manifest.json"), "w") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.exit(main())
