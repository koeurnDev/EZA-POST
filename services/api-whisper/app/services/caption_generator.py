"""
KhmerSub AI - Multi-Language Social Caption & Hashtag Generator
Generates viral social media post captions and trending hashtags in Khmer, English, and Chinese.
Optimized for Facebook, TikTok, YouTube Shorts, and Instagram Reels.
"""

import os
import re
import json
import urllib.request
from typing import List, Dict

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

def generate_local_fallback_captions(transcript: str, filename: str = "", language: str = "km") -> List[Dict[str, str]]:
    """
    Intelligent NLP template generator supporting Khmer, English, and Chinese.
    """
    clean_text = " ".join(transcript.replace("\u200b", " ").split())
    sentences = [s.strip() for s in re.split(r"[.!?។\n]+", clean_text) if len(s.strip()) > 6]
    
    first_sentence = sentences[0] if sentences else "ការចែករំលែកចំណេះដឹងថ្មីៗដ៏មានតម្លៃ!"
    second_sentence = sentences[1] if len(sentences) > 1 else ""
    third_sentence = sentences[2] if len(sentences) > 2 else ""

    lower = clean_text.lower()
    is_tech = any(k in lower for k in ["ai", "chatgpt", "claude", "agent", "python", "code", "tech"])
    is_biz = any(k in lower for k in ["business", "លុយ", "រកស៊ី", "លក់", "brand", "marketing"])

    # 1. English Templates
    if language == "en":
        tags = "#KhmerAI #Cambodia #ContentCreator #ViralReels #CapCut #TechInsights"
        if is_tech:
            tags = "#ArtificialIntelligence #KhmerTech #AI #ChatGPT #FutureTech " + tags
        elif is_biz:
            tags = "#BusinessGrowth #Entrepreneurship #MarketingTips " + tags

        return [
            {
                "id": "viral_reels_en",
                "title": "⚡ Viral Reels / TikTok Style (English)",
                "caption": (
                    f"🔥 Mind-blowing takeaway you can't afford to miss!\n\n"
                    f"👉 Key highlights from this talk:\n"
                    f"• {first_sentence}\n"
                    f"• {second_sentence or 'Smart strategies for faster results.'}\n\n"
                    f"💬 What are your thoughts on this? Let us know in the comments below!\n\n"
                    f"{tags}"
                )
            },
            {
                "id": "professional_fb_en",
                "title": "📘 Professional Facebook Post (English)",
                "caption": (
                    f"【 Essential Insight & Key Takeaway 】\n\n"
                    f"Excited to share this valuable breakdown with everyone today!\n\n"
                    f"📌 \"{first_sentence}\"\n\n"
                    f"Taking actionable steps and embracing new innovations is key to staying ahead. "
                    f"{second_sentence}\n\n"
                    f"❤️ Found this useful? Drop a like, share with a friend, and save for later!\n\n"
                    f"{tags}"
                )
            },
            {
                "id": "short_punchy_en",
                "title": "✨ Short & Punchy (English)",
                "caption": (
                    f"Watch until the end for this game-changing insight! 🚀✨\n\n"
                    f"\"{first_sentence}\"\n\n"
                    f"{tags}"
                )
            }
        ]

    # 2. Chinese Templates
    elif language == "zh":
        tags = "#柬埔寨 #AI科技 #短视频字幕 #内容创作 #实用干货"
        return [
            {
                "id": "viral_reels_zh",
                "title": "⚡ 爆款短视频文案 (中文 TikTok / Reels)",
                "caption": (
                    f"🔥 不容错过的干货分享！\n\n"
                    f"👉 视频核心要点：\n"
                    f"• {first_sentence}\n"
                    f"• {second_sentence or '高效实用的技巧分享'}\n\n"
                    f"💬 欢迎在评论区留下你的看法！\n\n"
                    f"{tags}"
                )
            },
            {
                "id": "professional_fb_zh",
                "title": "📘 深度长文分享 (中文 Facebook / 微信)",
                "caption": (
                    f"【 今日干货精华分享 】\n\n"
                    f"今天与大家分享一段非常有价值的内容：\n\n"
                    f"📌 \"{first_sentence}\"\n\n"
                    f"深入理解并付诸实践，才能在快节奏的时代保持竞争力。{second_sentence}\n\n"
                    f"❤️ 如果对你有启发，欢迎点赞、收藏并转发给更多朋友！\n\n"
                    f"{tags}"
                )
            }
        ]

    # 3. Khmer Default Templates
    hashtags = ["#KhmerSubAI", "#Cambodia", "#ContentCreator", "#CapCut", "#VideoEditing", "#Reels"]
    if is_tech:
        hashtags = ["#AI", "#KhmerAI", "#Technology", "#ChatGPT", "#Programming", "#KhmerTech"] + hashtags[:3]
    if is_biz:
        hashtags = ["#Business", "#Marketing", "#Motivation", "#Entrepreneur"] + hashtags[:3]

    tag_str = " ".join(hashtags)

    return [
        {
            "id": "viral_reels_km",
            "title": "⚡ ស្ទីល Viral Reels / TikTok (ទាក់ទាញខ្លាំង)",
            "caption": (
                f"🔥 {first_sentence}!\n\n"
                f"👉 នេះជាគន្លឹះសំខាន់ដែលអ្នកមិនគួររំលង៖\n"
                f"• {second_sentence or first_sentence}\n"
                f"• {third_sentence or 'អនុវត្តភ្លាមៗដើម្បីទទួលបានលទ្ធផលល្អ!'}\n\n"
                f"💬 តើបងប្អូនយល់យ៉ាងណាដែរ? Comment មតិខាងក្រោមទាំងអស់គ្នា!\n\n"
                f"{tag_str}"
            )
        },
        {
            "id": "professional_fb_km",
            "title": "📘 ស្ទីល Facebook Post (អាជីព និងស៊ីជម្រៅ)",
            "caption": (
                f"【 ចំណេះដឹងល្អៗដែលគួរស្វែងយល់ 】\n\n"
                f"សួស្ដីបងប្អូនទាំងអស់គ្នា! ថ្ងៃនេះខ្ញុំសូមលើកយកចំណុចពិសេសមួយចំនួនមកចែករំលែក៖\n\n"
                f"📌 \"{first_sentence}\"\n\n"
                f"តាមរយៈខ្លឹមសារនេះ យើងអាចមើលឃើញថាការរៀបចំ និងការយល់ដឹងច្បាស់លាស់ គឺជាកត្តាកំណត់ជោគជ័យ។ "
                f"{second_sentence}\n\n"
                f"❤️ បើគិតថាមានប្រយោជន៍ កុំភ្លេច Like & Share ទៅកាន់មិត្តភក្តិរបស់អ្នកផងណា!\n\n"
                f"{tag_str}"
            )
        },
        {
            "id": "short_punchy_km",
            "title": "✨ ស្ទីលខ្លីខ្លឹម (Short & Punchy)",
            "caption": (
                f"{first_sentence} ✨\n\n"
                f"ទស្សនាវីដេអូពេញដើម្បីដឹងពីវិធីសាស្ត្រលម្អិត! 🚀\n\n"
                f"{tag_str}"
            )
        }
    ]

def generate_social_captions(transcript: str, filename: str = "", language: str = "km") -> List[Dict[str, str]]:
    """
    Generates social captions in the requested language (km, en, zh) via Gemini Flash if available,
    otherwise uses intelligent local multi-language generator.
    """
    if not transcript or len(transcript.strip()) < 5:
        return []

    lang_name_map = {"km": "Khmer", "en": "English", "zh": "Chinese"}
    target_lang_name = lang_name_map.get(language, "Khmer")

    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            prompt = (
                f"Based on this spoken transcript:\n\"\"\"{transcript[:2500]}\"\"\"\n\n"
                f"Generate 3 diverse, highly engaging social media captions for Facebook, TikTok, and YouTube in {target_lang_name} language.\n"
                f"Each caption must include an eye-catching hook, bullet points, call to action, and 5-8 relevant hashtags in {target_lang_name}.\n"
                f"Return ONLY valid JSON array with format:\n"
                f'[\n'
                f'  {{"id": "viral_reels", "title": "⚡ Viral Style", "caption": "..."}},\n'
                f'  {{"id": "professional_fb", "title": "📘 Professional Style", "caption": "..."}},\n'
                f'  {{"id": "short_punchy", "title": "✨ Short Style", "caption": "..."}}\n'
                f']'
            )
            data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                raw_text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                parsed = json.loads(raw_text)
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed
        except Exception:
            pass

    return generate_local_fallback_captions(transcript, filename, language=language)
