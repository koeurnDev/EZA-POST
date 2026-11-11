"""
KhmerSub AI Telegram Bot
Autonomous Telegram Bot with Inline Buttons, Reels Word Pacing, and AI Social Caption generation.

Zero external dependencies required (uses Python standard library urllib).

Run:
  python -m apps.api.app.bot.telegram_bot
"""

import os
import sys
import json
import time
import logging
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# Add project root to sys.path
SCRIPT_DIR = Path(__file__).resolve()
SERVICE_ROOT = SCRIPT_DIR.parents[2]
PROJECT_ROOT = SCRIPT_DIR.parents[3]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(SERVICE_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / "backend" / ".env")
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

from apps.api.app.services.transcription import transcribe_audio_khmer
from apps.api.app.services.subtitles import generate_srt
from apps.api.app.services.audio_extractor import extract_audio_to_wav
from apps.api.app.services.caption_generator import generate_social_captions

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("khmersub_telegram_bot")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Memory caches:
# user_id -> words_per_sub (0=phrase, 1=reels, 2=tiktok)
USER_PREFERENCES = {}
# chat_id -> {"segments": segments, "transcript": text, "filename": name}
LAST_PROJECTS = {}

def call_telegram_api(method: str, params: dict = None, data: bytes = None, headers: dict = None) -> dict:
    url = f"{API_URL}/{method}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            logger.error(f"Telegram API HTTP error on {method}: {err_body}")
            return err_body
        except Exception:
            return {"ok": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Telegram API error on {method}: {e}")
        return {"ok": False, "error": str(e)}

def send_message(chat_id: int, text: str, parse_mode: str = "Markdown", reply_markup: dict = None) -> dict:
    payload_dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload_dict["parse_mode"] = parse_mode
    if reply_markup:
        payload_dict["reply_markup"] = reply_markup
    payload = json.dumps(payload_dict).encode("utf-8")
    res = call_telegram_api("sendMessage", data=payload, headers={"Content-Type": "application/json"})
    if not res.get("ok") and parse_mode:
        # Fallback to plain text if Markdown entity parsing failed
        payload_dict.pop("parse_mode", None)
        payload = json.dumps(payload_dict).encode("utf-8")
        return call_telegram_api("sendMessage", data=payload, headers={"Content-Type": "application/json"})
    return res

def send_document(chat_id: int, file_path: Path, caption: str = ""):
    """Send multipart document to Telegram."""
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    filename = file_path.name

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
        f"{chat_id}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="caption"\r\n\r\n'
        f"{caption}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
        f"Content-Type: application/x-subrip\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return call_telegram_api("sendDocument", data=body, headers=headers)

def answer_callback_query(callback_query_id: str, text: str = ""):
    payload = json.dumps({"callback_query_id": callback_query_id, "text": text}).encode("utf-8")
    return call_telegram_api("answerCallbackQuery", data=payload, headers={"Content-Type": "application/json"})

def download_telegram_file(file_id: str, dest_path: Path) -> tuple:
    res = call_telegram_api("getFile", params={"file_id": file_id})
    if not res.get("ok"):
        desc = res.get("description") or res.get("error") or "file is too big or unavailable"
        if "file is too big" in str(desc).lower():
            desc = "ឯកសារធំជាង 20MB (ដែនកំណត់ដោនឡូតរបស់ Telegram Bot API)"
        return False, desc

    file_path = res["result"]["file_path"]
    download_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
    try:
        urllib.request.urlretrieve(download_url, str(dest_path))
        return True, ""
    except Exception as e:
        logger.error(f"Failed to download file from Telegram: {e}")
        return False, str(e)

def get_action_inline_keyboard() -> dict:
    """Buttons for 1-click interaction without typing commands."""
    return {
        "inline_keyboard": [
            [
                {"text": "⚡ 1 ពាក្យ (Viral Reels)", "callback_data": "pacing_1"},
                {"text": "🔥 2 ពាក្យ (TikTok)", "callback_data": "pacing_2"},
                {"text": "📄 ឃ្លាពេញ", "callback_data": "pacing_0"}
            ],
            [
                {"text": "✨ បង្កើត Caption & Hashtags ផុស", "callback_data": "gen_caption"}
            ]
        ]
    }

def export_and_send_srt(chat_id: int, pacing_val: int):
    """Generate and send SRT file according to selected pacing."""
    if chat_id not in LAST_PROJECTS:
        return False
    proj = LAST_PROJECTS[chat_id]
    segments = proj["segments"]
    pacing_label = f"{pacing_val} ពាក្យម្តង (Reels / TikTok)" if pacing_val > 0 else "ឃ្លាពេញធម្មតា"

    temp_dir = Path("./temp_telegram_bot")
    temp_dir.mkdir(parents=True, exist_ok=True)
    srt_path = temp_dir / f"reels_{pacing_val}_{chat_id}.srt"

    srt_content = generate_srt(segments, words_per_sub=pacing_val)
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    send_document(
        chat_id,
        srt_path,
        caption=f"🎬 SRT [{pacing_label}] — Import ចូល CapCut ឬ Premiere បានភ្លាម!"
    )
    try:
        srt_path.unlink()
    except Exception:
        pass
    return True

def handle_callback_query(cb: dict):
    cb_id = cb["id"]
    chat_id = cb["message"]["chat"]["id"]
    data = cb.get("data", "")

    if chat_id not in LAST_PROJECTS:
        answer_callback_query(cb_id, text="⚠️ មិនមានគម្រោងសកម្មទេ។ សូមផ្ញើសំឡេងថ្មី!")
        return

    proj = LAST_PROJECTS[chat_id]
    transcript = proj["transcript"]

    if data.startswith("pacing_"):
        pacing_val = int(data.split("_")[1])
        USER_PREFERENCES[chat_id] = pacing_val
        pacing_label = f"{pacing_val} ពាក្យម្តង (Reels)" if pacing_val > 0 else "ឃ្លាពេញធម្មតា"
        answer_callback_query(cb_id, text=f"✅ បានប្តូរទៅជា: {pacing_label}")
        export_and_send_srt(chat_id, pacing_val)

    elif data == "gen_caption":
        answer_callback_query(cb_id, text="✨ កំពុងបង្កើត AI Social Captions...")
        captions = generate_social_captions(transcript, filename=proj.get("filename", ""))
        if not captions:
            send_message(chat_id, "⚠️ មិនមានអត្ថបទគ្រប់គ្រាន់សម្រាប់បង្កើត Caption ឡើយ។")
            return

        for cap in captions:
            msg_text = f"*{cap.get('title', 'Caption')}*\n\n{cap.get('caption', '')}"
            send_message(chat_id, msg_text)

def handle_update(update: dict):
    # Check for inline button clicks
    if "callback_query" in update:
        handle_callback_query(update["callback_query"])
        return

    msg = update.get("message")
    if not msg:
        return

    chat_id = msg["chat"]["id"]
    text = msg.get("text", "").strip()

    # 1. Handle Commands
    if text == "/start" or text == "/help":
        welcome_text = (
            "🇰🇭 *សូមស្វាគមន៍មកកាន់ KhmerSub AI Bot!*\n\n"
            "🎙️ *របៀបប្រើប្រាស់៖*\n"
            "• ផ្ញើសំឡេង *Voice Message*, Audio (MP3, WAV, M4A) ឬ Video (ក្រោម 20MB)\n"
            "• Bot នឹងដំណើរការ ASR ភាសាខ្មែរ រួចផ្ញើជូន File *.SRT* ត្រឡប់មកវិញភ្លាមៗ!\n"
            "• អាចយកទៅ Import ចូល *CapCut, Premiere Pro, ឬ DaVinci Resolve* បានភ្លាមៗ។\n\n"
            "⚙️ *ប៊ូតុង Pacing និង AI Caption នឹងបង្ហាញនៅពេល File ដំណើរការចប់!*\n\n"
            "🌐 *សម្រាប់វីដេអូធំជាង 20MB:* សូមប្រើ Web Studio 👉 https://khmersub-studio.pages.dev"
        )
        send_message(chat_id, welcome_text)
        return

    elif text.startswith("/pacing"):
        parts = text.split()
        if len(parts) > 1 and parts[1].isdigit():
            val = int(parts[1])
            USER_PREFERENCES[chat_id] = val
            label = f"{val} ពាក្យម្តង (Reels / TikTok)" if val > 0 else "ឃ្លាពេញធម្មតា"
            send_message(chat_id, f"✅ បានកំណត់ Pacing: *{label}* រួចរាល់!\nរាល់ឯកសារដែលផ្ញើបន្ទាប់ នឹងចេញ Subtitle ទម្រង់នេះ។")
            # If user already sent a file earlier, re-export immediately!
            export_and_send_srt(chat_id, val)
            return
        elif len(parts) > 1 and parts[1].lower() in ["phrase", "full", "0"]:
            USER_PREFERENCES[chat_id] = 0
            send_message(chat_id, "✅ បានកំណត់ Pacing: *ឃ្លាពេញធម្មតា* រួចរាល់!")
            export_and_send_srt(chat_id, 0)
            return
        else:
            send_message(
                chat_id,
                "⚙️ *ការកំណត់ Pacing:*\n\n"
                "• `/pacing 1` : 1 ពាក្យម្តង (ពេញនិយមខ្លាំងលើ Reels / Shorts)\n"
                "• `/pacing 2` : 2 ពាក្យម្តង (TikTok Dynamic)\n"
                "• `/pacing 3` : 3 ពាក្យម្តង\n"
                "• `/pacing 0` : ឃ្លាពេញធម្មតា (Full Sentence)"
            )
            return

    elif text == "/reels":
        USER_PREFERENCES[chat_id] = 1
        send_message(chat_id, "✅ បានកំណត់ Pacing: *1 ពាក្យម្តង (Viral Reels)* រួចរាល់!")
        export_and_send_srt(chat_id, 1)
        return

    elif text == "/tiktok":
        USER_PREFERENCES[chat_id] = 2
        send_message(chat_id, "✅ បានកំណត់ Pacing: *2 ពាក្យម្តង (TikTok)* រួចរាល់!")
        export_and_send_srt(chat_id, 2)
        return

    # 2. Handle Media (Voice, Audio, Video, Document)
    file_id = None
    file_name = "audio.wav"
    file_size = 0

    if "voice" in msg:
        file_id = msg["voice"]["file_id"]
        file_name = "voice_note.ogg"
        file_size = msg["voice"].get("file_size", 0)
    elif "audio" in msg:
        file_id = msg["audio"]["file_id"]
        file_name = msg["audio"].get("file_name", "audio.mp3")
        file_size = msg["audio"].get("file_size", 0)
    elif "video" in msg:
        file_id = msg["video"]["file_id"]
        file_name = msg["video"].get("file_name", "video.mp4")
        file_size = msg["video"].get("file_size", 0)
    elif "document" in msg:
        doc = msg["document"]
        mime = doc.get("mime_type", "")
        if any(t in mime for t in ["audio", "video", "ogg"]):
            file_id = doc["file_id"]
            file_name = doc.get("file_name", "media.mp4")
            file_size = doc.get("file_size", 0)

    if not file_id:
        return

    # Check Telegram's 20MB download limit
    MAX_TG_LIMIT = 20 * 1024 * 1024  # 20MB
    if file_size > MAX_TG_LIMIT:
        mb = file_size / (1024 * 1024)
        send_message(
            chat_id,
            f"⚠️ *ឯកសារវីដេអូនេះមានទំហំ {mb:.1f} MB (លើសពីកម្រិតកំណត់ 20 MB របស់ Telegram Bot API)*\n\n"
            "💡 *ដំណោះស្រាយងាយៗ៖*\n"
            "1. ផ្ញើតែឯកសារសំឡេង (*MP3, M4A, ឬ Voice Note*) ជំនួសវិញ (សំឡេងមានទំហំត្រឹមតែ 1-3 MB ប៉ុណ្ណោះ)\n"
            "2. ឬ Upload វីដេអូពេញទំហំរហូតដល់ *150 MB* លើវេបសាយ Studio ដោយផ្ទាល់៖\n"
            "👉 https://khmersub-studio.pages.dev"
        )
        return

    send_message(chat_id, "⏳ *កំពុងទាញយកសំឡេង និងដំណើរការ ASR ភាសាខ្មែរ...*\nសូមរង់ចាំពីរបីវិនាទី!")

    temp_dir = Path("./temp_telegram_bot")
    temp_dir.mkdir(parents=True, exist_ok=True)

    input_media = temp_dir / f"{chat_id}_{int(time.time())}_{file_name}"
    wav_target = input_media.with_suffix(".wav")
    srt_target = input_media.with_suffix(".srt")

    try:
        # Download
        ok, err = download_telegram_file(file_id, input_media)
        if not ok:
            send_message(
                chat_id,
                f"⚠️ *មិនអាចទាញយកឯកសារពី Telegram បានទេ៖*\n_{err}_\n\n"
                "📌 *មូលហេតុ៖* Telegram Bot API កំណត់ទំហំទាញយកអតិបរមាត្រឹមតែ **20 MB** ប៉ុណ្ណោះ សម្រាប់ឯកសារនីមួយៗ។\n\n"
                "💡 *ដំណោះស្រាយងាយៗ 2 យ៉ាង៖*\n"
                "1️⃣ *ផ្ញើជា Voice Note ឬ File សំឡេង (MP3 / M4A):* (ទំហំតែ 1-3 MB ប៉ុណ្ណោះ ដំណើរការលឿនខ្លាំង)\n"
                "2️⃣ *ឬ Upload វីដេអូពេញទំហំរហូតដល់ 150 MB លើ Web Studio ដោយផ្ទាល់:* 👉 https://khmersub-studio.pages.dev"
            )
            return

        # Convert to 16kHz WAV
        extract_audio_to_wav(input_media, wav_target)

        # Transcribe
        segments, duration = transcribe_audio_khmer(wav_target, language="km")
        if not segments:
            send_message(chat_id, "⚠️ មិនមានសម្លេងនិយាយខ្មែរច្បាស់លាស់នៅក្នុងឯកសារនេះឡើយ។")
            return

        # Cache project for inline action buttons
        full_text = " ".join(s.text for s in segments)
        LAST_PROJECTS[chat_id] = {
            "segments": segments,
            "transcript": full_text,
            "filename": file_name
        }

        # Pacing
        words_per_sub = USER_PREFERENCES.get(chat_id, 0)
        srt_content = generate_srt(segments, words_per_sub=words_per_sub)

        with open(srt_target, "w", encoding="utf-8") as f:
            f.write(srt_content)

        # Preview message with clickable inline keyboard
        preview_text = (
            f"✅ *ដំណើរការជោគជ័យ!* ({duration:.1f} វិនាទី)\n\n"
            f"📝 *អត្ថបទសង្ខេប៖*\n_{full_text[:350] + ('...' if len(full_text) > 350 else '')}_\n\n"
            f"👇 *ចុចប៊ូតុងខាងក្រោមដើម្បីប្តូរទម្រង់ Subtitle ឬបង្កើត Caption ផុស៖*"
        )
        send_message(chat_id, preview_text, reply_markup=get_action_inline_keyboard())

        # Send .SRT file attachment
        send_document(chat_id, srt_target, caption=f"🎬 {file_name}.srt — អាច Import ចូល CapCut ភ្លាមៗ")

    except Exception as e:
        logger.exception(f"Error processing telegram media: {e}")
        send_message(chat_id, f"❌ មានបញ្ហាបច្ចេកទេសក្នុងការបង្កើត Subtitle: {e}")
    finally:
        # Cleanup temp files
        for p in [input_media, wav_target, srt_target]:
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

def run_polling():
    if not BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN is not set. Please set it in .env to start the bot.")
        return

    logger.info("KhmerSub AI Telegram Bot started polling...")
    offset = 0

    while True:
        try:
            updates = call_telegram_api("getUpdates", params={"offset": offset, "timeout": 30})
            if updates.get("ok"):
                for update in updates.get("result", []):
                    offset = update["update_id"] + 1
                    handle_update(update)
            time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Bot stopped by user.")
            break
        except Exception as e:
            logger.error(f"Polling loop error: {e}")
            time.sleep(3)

if __name__ == "__main__":
    run_polling()
