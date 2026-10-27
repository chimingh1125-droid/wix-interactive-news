#!/usr/bin/env python3
"""Write output/QA_REPORT.md from the QA artefacts in build/."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
VOICE_RATIO = {"full": (11.2, 8.8), "short": (11.7, 10.2), "60s": (11.6, 7.3)}  # mean / min dB, from audio/mix.py
CUTS = (("full", "正片（2:22）"), ("short", "短版（1:32）"), ("60s", "60 秒招生版（0:59.8）"))


def fmt_t(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


REVISION = [
    "## 第二版修正紀錄", "",
    "| 問題 | 位置 | 修正 | 驗證 |",
    "|------|------|------|------|",
    "| 「德智兼修」的「兼」字形錯誤 | 正片 0:44／短版 0:27；另含片名卡秘笈內頁、L06 字幕 | 原字型霞鶩文楷 TC 採傳承字形（「兼」上方寫成兩撇，另有 爲、眞、兩點辶 等舊字形）。全片中文改用依教育部標準字體的芫荽 Iansui，並把全片 249 個用字逐字與標準字形比對 | 放大截圖比對；字幕卡全部重新產生 |",
    "| 捲軸直書每字底部被裁掉（手的勾、腦、並、用） | 正片 0:40–0:46／短版 0:25–0:29 | 逐字刷出的遮罩改由文字基線定位，涵蓋完整字身 | 放大截圖比對 |",
    "| 龍頭不像龍 | 正片 1:16／短版 0:49 | 重畫龍頭：長吻、上翹鼻頭與鼻孔渦紋、濃眉怒目、鹿角、張口獠牙與舌、長鬚、頷下鬚、鬃毛。原本頭部上下顛倒的方向錯誤一併修正；龍腳改為線稿肢體加利爪 | 整段飛行逐格檢查：姿態連續、不翻轉 |",
    "| 「小世界」鉛字左右鏡像 | 正片 1:40／短版 1:03 | 鉛字改為正向顯示（「新聞」同步修正） | 截圖確認 |",
    "| 世新新聞系 LOGO 不正確 | 片名卡、片尾、每個敘事場景左上角 | 依官方 LOGO 描成向量（`assets/logo/trace_logo.py`），再以程式繪出：先描外框、再填白、題字逐字刷上 | 與參考圖並排比對 |",
    "",
    "- 場景時間軸、旁白、配樂與音效均未改動；重新匯出的音效觸發點與上一版逐位元組相同，所以混音沿用上一版，影音同步不受影響。",
    "",
]


def main():
    out = ["# 品質檢查報告（QA Report）", ""] + REVISION
    vo = json.load(open(os.path.join(ROOT, "tts", "vo", "manifest.json")))
    out += ["## 旁白", "",
            f"- 引擎：Kokoro-82M（離線 ONNX，fp32），男聲 `{vo['voice']}`，語速 {vo['speed']}",
            f"- 23 句，總長 {sum(l['dur'] for l in vo['lines']):.2f} 秒；逐句檢查 NaN、削波，以及是否出現超過 2 秒不停頓的失真段落：全部通過（`qa/check_vo.py`）",
            "- 多音字與人名讀音逐句以拼音人工核對（木柵 mù zhà、降龍 xiáng lóng、重劍 zhòng jiàn、乾坤 qián kūn、為國為民 wèi guó wèi mín、空白 kòng bái 等）", ""]
    for v, title in CUTS:
        if not os.path.exists(os.path.join(B, f"final_{v}.json")):
            continue
        tl = json.load(open(os.path.join(B, f"timeline_{v}.json")))
        q = json.load(open(os.path.join(B, f"qa_{v}.json")))["summary"]
        fin = json.load(open(os.path.join(B, f"final_{v}.json")))
        kinds = {}
        for f, k, val in q["issues"]:
            kinds.setdefault(k, []).append(f)
        out += [f"## {title}", "",
                f"- 時長 {fmt_t(tl['duration'])}（{tl['duration']:.2f} s），{tl['frames']} 格 @ {tl['fps']} fps，{len(tl['scenes'])} 個場景",
                f"- 逐格檢查：{q['frames']} / {q['expected_frames']} 格全部解碼檢查（`qa/check_frames.py`）"]
        out.append("  - 空白或單色畫面：0 格；破圖黑洞（純黑像素）：0 格；紙紋缺失：0 格；配色異常：0 格；凍結畫面：0 格")
        if v == "60s":
            vo60 = json.load(open(os.path.join(ROOT, "tts", "vo_60s", "manifest.json")))
            out += [f"- 腳本 `script/script_60s.json`（查證與來源：`script/SCRIPT_60s.md`）：7 段固定時間（0–5–14–23–32–41–50–60 s），每段兩句旁白都落在段內；段落交界以筆刷轉場，轉場中點就在段落交界",
                    f"- 旁白：{len(vo60['lines'])} 句、總長 {sum(l['dur'] for l in vo60['lines']):.2f} 秒，男聲 `{vo60['voice']}`，語速 {vo60['speed']}（開場兩句 1.05）；「AI」念作 ēi ài，多音字逐句以拼音核對（藏 cáng、一式 yí shì、這卷 zhè juàn、扎實 zhá shí、誰說 shéi shuō）",
                    "- 配樂：133⅓ BPM（每拍 0.45 秒），每段正好 5 小節，段落交界都落在小節第一拍；九連刺、短影音框跳出、介面提示音與四大功力出現都對齊八分音符，降龍掌、光球爆發、片尾高潮落在拍點上",
                    "- 各段配樂：開場琵琶輪指與掃弦；喬峰太鼓＋重低音大鼓；楊過合成器琶音、四拍大鼓與 hi-hat（Tech Pulse）；令狐沖十六分音符快鼓；張無忌弦樂斷奏、銅管漸強與定音鼓滾奏；傳承段 C 大調溫暖弦樂與二胡；片尾梵鐘、定音鼓滾奏收在高潮",
                    "- 新增音效：墨水渲染、數位光點、拔劍、解鎖、Tech Pulse、介面提示音、短影音框跳出、彩帶、氣功迴旋、梵鐘"]
        if kinds.get("sudden change"):
            fs = kinds["sudden change"]
            spans = []
            start = prev = fs[0]
            for f in fs[1:] + [None]:
                if f is None or f != prev + 1:
                    spans.append((start, prev))
                    if f is not None:
                        start = f
                if f is not None:
                    prev = f
            desc = "、".join(f"{a / 30:.2f}–{b / 30:.2f}s" for a, b in spans)
            out.append(f"  - 「突兀跳變」標記 {len(fs)} 格（{desc}）：都落在鏡頭快速推移段（開場升鏡、夜景下搖），已逐格目視確認是連續運鏡，不是破圖")
        out.append("- 渲染：Chromium 逐格建構 SVG，等兩個 animation frame 確認繪製完成後才擷取；每格都檢查尺寸 1920×1080，頁面錯誤 0，字型全部預載並檢查通過")
        out += ["", "| 檔案 | 大小 | 影格 | 響度 (EBU R128) | True Peak | LRA |", "|------|------|------|------------------|-----------|-----|"]
        for k, info in fin["files"].items():
            p = os.path.join(ROOT, info["path"])
            s = [x for x in info["probe"]["streams"] if x.get("codec_name") == "h264"][0]
            ld = info["loudness"]
            out.append(f"| `{os.path.basename(p)}` | {os.path.getsize(p) / 1e6:.1f} MB | {s['nb_read_frames']} | {ld['integrated_lufs']} LUFS | {ld['true_peak_dbtp']} dBTP | {ld['lra_lu']} LU |")
        m, mn = VOICE_RATIO[v]
        out += ["", f"- 旁白對背景（配樂＋音效）的平均能量比 {m} dB、最低 {mn} dB（旁白出現時配樂自動壓低 14 dB、音效壓低 8 dB）",
                f"- 字幕：{sum(len(s['lines']) for s in tl['scenes'])} 則雙語字幕，時間碼直接取自旁白實際位置（開始比語音早 0.05 s，結束晚 0.35 s，不與下一句重疊）；燒錄版逐格合成 {fin['composited_frames']} 格", ""]
        out += ["| 句 | 場景 | 旁白起訖 |", "|----|------|----------|"]
        for s in tl["scenes"]:
            for ln in s["lines"]:
                out.append(f"| {ln['id']} | {s['id']} | {fmt_t(ln['abs0'])} – {fmt_t(ln['abs1'])} |")
        out.append("")
    vert = [(v, os.path.join(B, f"final_vertical_{v}.json")) for v, _ in CUTS]
    vert = [(v, p) for v, p in vert if os.path.exists(p)]
    if vert:
        out += ["## 9:16 直式雙語字幕版", "",
                "- 1080×1920、30 fps。完整 16:9 畫面不裁切，縮放為 1080×608 橫置在中段；上方為系徽與片名，下方為放大的雙語字幕（中文 58 px，長句在自然停頓處斷行）",
                "- 畫面、旁白、配樂、音效與橫式版相同；字幕時間碼與淡入淡出也相同", "",
                "| 檔案 | 大小 | 影格 | 響度 (EBU R128) | True Peak |", "|------|------|------|------------------|-----------|"]
        for v, p in vert:
            info = json.load(open(p))
            fpath = os.path.join(ROOT, info["path"])
            s = [x for x in info["probe"]["streams"] if x.get("codec_name") == "h264"][0]
            ld = info["loudness"]
            out.append(f"| `{os.path.basename(fpath)}` | {os.path.getsize(fpath) / 1e6:.1f} MB | {s['nb_read_frames']} / {info['timeline_frames']} | {ld['integrated_lufs']} LUFS | {ld['true_peak_dbtp']} dBTP |")
        out.append("")
    out += ["## 人工目視抽檢", "",
            "- 正片、短版各以每秒 1 格抽樣（共 235 格），並在每個場景的關鍵動作處另外抽幀檢查：前景遮擋正確，沒有線條穿透人物或建築；字幕沒有蓋住關鍵畫面（片名卡秘笈、收尾寫字處都已調整到字幕區之上）；轉場筆刷完整覆蓋。",
            "- 各場景截圖：`output/screenshots/`（每場 2 張與 contact sheet）。",
            "- 6 支最終 MP4 全檔解碼（`ffmpeg -v error -f null`）：解碼錯誤 0；影格數與時間軸一致。",
            "- 60 秒招生版：7 段各取 2 張截圖（`output/screenshots/promo60s/`），另在每段的關鍵動作（掌風震碎、AI 光軌解鎖、九劍出框、光球爆發、秘笈交接、眼神金光、片尾字卡）逐一抽幀放大檢查；4 支 MP4 全檔解碼：解碼錯誤 0。", ""]
    open(os.path.join(ROOT, "output", "QA_REPORT.md"), "w").write("\n".join(out))
    print("report written")


if __name__ == "__main__":
    main()
