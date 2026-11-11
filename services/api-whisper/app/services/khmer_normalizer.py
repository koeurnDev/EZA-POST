import re
import unicodedata
from typing import List
from ..schemas.jobs import SubtitleSegmentItem

# Khmer Unicode Ranges:
# Consonants: \u1780 - \u17A2
# Independent vowels: \u17A3 - \u17B3
# Dependent vowels (sr): \u17B6 - \u17C5
# Diacritics & signs: \u17C6 - \u17D3
# Coeng: \u17D2
# Currency/Numbers/Symbols: \u17D4 - \u17F9

# Common phonetic mapping for Romanized Khmer speech from Whisper
PHONETIC_PHRASES = [
    # 1. Multi-word Code-switching phrases from actual user speech
    (r'(?i)\b(haj|hai)\s*ចង់', 'ហើយចង់ឱ្យ'),
    (r'(?i)\bAI\s*និយាយគ្នា', 'និយាយគ្នា'),
    (r'(?i)\btwagajomui(k)?niy(e|a)\b', 'ធ្វើការជាមួយគ្នា'),
    (r'(?i)\b(AI\s+)?kniom\s+tpraap\s+viye\s+madaom\s+hui\s+mui\b', 'ទៅប្រាប់វាម្តងមួយៗ'),
    (r'(?i)\b(tpra|pra)\s+AI\s+(tpraap|praap)\s*បន្ត', 'ឱ្យ AI ធ្វើបន្ត'),
    (r'(?i)\bkye\s*ប្រើ\s*ប្រើ', 'គេប្រើប្រាស់'),
    (r'(?i)\bmawbi\s+(bi|pi)\s+Agent\s+(twu|to)\s+Agent\s+Protocol\b', 'មកពី Agent-to-Agent Protocol'),
    (r'(?i)\bmawbi\s+(bi|pi)\b', 'មកពី'),
    (r'(?i)\bAgent\s+(twu|to)\s+Agent(\s+Protocol)?\b', 'Agent-to-Agent Protocol'),
    (r'(?i)\bbi\s+agi\s+Protocol\b', 'ជា Protocol'),
    (r'(?i)\bsomraap\s+AI\s+Agent\b', 'សម្រាប់ AI Agent'),
    (r'(?i)\bsomraap\b', 'សម្រាប់'),
    (r'(?i)\bi\s*spine\s+rocks?\s+on\s+matapip\s+kni(e|ya|ye)\b', 'អាចចែករំលែកសមត្ថភាពគ្នា'),
    (r'(?i)\bi\s*spine\s+rocks?\b', 'អាចចែករំលែក'),
    (r'(?i)\b(on\s+)?matapip\s+kni(e|ya|ye)\b', 'សមត្ថភាពគ្នា'),
    (r'(?i)\bndetong\s+kni(e|ya|ye)\s+benjoon\s+task\b', 'ទាក់ទងគ្នា បញ្ជូន Task'),
    (r'(?i)\bndetong\s+kni(e|ya|ye)\b', 'ទាក់ទងគ្នា'),
    (r'(?i)\bbenjoon\s+task\b', 'បញ្ជូន Task'),
    (r'(?i)\bnangadur\s+resolve\s+kni(e|ya|ye)\b', 'និងទទួល Result ពីគ្នា'),
    (r'(?i)\bijs\s+royul\s+q\s*ai\s+agent\s+muei\b', 'និយាយឱ្យស្រួល គឺ AI Agent មួយ'),
    (r'(?i)\bijs\s+royul\b', 'និយាយឱ្យស្រួល'),
    (r'(?i)\bq\s*ai\s+agent\s+muei\b', 'គឺ AI Agent មួយ'),
    (r'(?i)\biturkage\s+muei\s+agent\s+mwytitban\b', 'អាចធ្វើការជាមួយ AI Agent មួយទៀតបាន'),
    (r'(?i)\biturkage\b', 'អាចធ្វើការជាមួយ'),
    (r'(?i)\bmwytitban\b', 'មួយទៀតបាន'),
    (r'(?i)\byomchong\s+magad\s+software\s+project\s+muei\b', 'ខ្ញុំចង់បង្កើត Software Project មួយ'),
    (r'(?i)\byomchong\s+magad\b', 'ខ្ញុំចង់បង្កើត'),
    (r'(?i)\byom\s*chong\b', 'ខ្ញុំចង់'),
    (r'(?i)\bmagad\b', 'បង្កើត'),
    (r'(?i)\bchomad\s+(មិន|ប្រើ|pra)?\s*(chachibitit|chatgpt)\b', 'ខ្ញុំអាចប្រើ ChatGPT'),
    (r'(?i)\bchomad\b', 'ខ្ញុំអាចប្រើ'),
    (r'(?i)\bchachibitit\b', 'ChatGPT'),
    (r'(?i)\bjim\s+manager\s+agent\b', 'ជា Manager Agent'),
    (r'(?i)\bbombay\s+task\s+nung\s+plan\s+kangiya\b', 'បំបែក Task និង Plan ការងារ'),
    (r'(?i)\bbombay\s+task\b', 'បំបែក Task'),
    (r'(?i)\bnung\s+plan\s+kangi(y)?a\b', 'និង Plan ការងារ'),
    (r'(?i)\bnung\s+top\s+mark\b', 'ទៅមុខទៀត'),

    # Multi-word tech phrases & slides
    (r'(?i)\ba\s*2\s*a\s*protocol\b', 'A2A Protocol'),
    (r'(?i)\ba\s*2\s*a\b', 'A2A'),
    (r'(?i)\bma(u)?bi(b)?bi\b', 'មកពី'),
    (r'(?i)\bmabi\b', 'មកពី'),
    (r'(?i)\b(manager\s+)?(ai\s+)?agen(t|i)?\b', lambda m: 'Manager Agent' if 'manager' in m.group(0).lower() else ('AI Agent' if 'ai' in m.group(0).lower() else 'Agent')),
    (r'(?i)\bagen(t)?\s+to\s+agent(\s+protocol)?\b', 'Agent-to-Agent Protocol'),
    (r'(?i)\bcha(d|t)\s*gpt\b', 'ChatGPT'),
    (r'(?i)\bclaude\b', 'Claude'),
    (r'(?i)\bgemin(i|ae)\b', 'Gemini'),
    # Standardized Tech Loanwords & Domain Vocabulary
    (r'(?i)\bchat[\s\-_]*gpt\b', 'ChatGPT'),
    (r'(?i)\bclaude\b', 'Claude'),
    (r'(ក្លរត់|ក្លោត|ខ្លោត|ខូឡត)', 'Claude'),
    (r'(?i)\bgemini\b', 'Gemini'),
    (r'(ចេមន័យ|ជេមីណៃ|ជេមីនី|ជំនាយ)', 'Gemini'),
    (r'(?i)\bcodex\b', 'Codex'),
    (r'(?i)\ba2a\s*protocol\b', 'A2A Protocol'),
    (r'(?i)\bagent[\s\-_]*to[\s\-_]*agent(\s*protocol)?\b', 'Agent-to-Agent Protocol'),
    (r'(?i)\bmanager\s*agent\b', 'Manager Agent'),
    (r'(?i)\bsoftware\s*project\b', 'Software Project'),
    (r'(?i)\bgit[\s\-_]*hub(\s*repo)?\b', 'GitHub Repo'),
    (r'(រីពរ\s*គីតហាប់|គីតហាប់)', 'GitHub'),
    (r'(?i)\brequirement(s)?\b', 'Requirement'),
    (r'(?i)\b(tuset|task(s)?)\b', 'Task'),
    (r'(ទូសេត|ថាស)', 'Task'),
    (r'(?i)\bresult(s)?\b', 'Result'),
    (r'(រីសាល់|រ៉េសាល់)', 'Result'),
    (r'(ប្រូតូកូល|ប្រូថូខូល)', 'Protocol'),
    (r'(សូហ្វវែរ|សូហ្វែរ|សបវែ)', 'Software'),
    (r'(ប្រូជេក|ប្រូជិក)', 'Project'),
    (r'(សាប់ថៃថល|សាប់ថាយថល)', 'Subtitle'),
    (r'(អាប់ឡូត|អាបឡូត)', 'Upload'),
    (r'(អេកស្ព័ត|អិចស្ព័ត)', 'Export'),
    (r'ប៊ុតតុន', 'ប៊ូតុង'),
    (r'(ហ្វុន|ហ្វុង)', 'Font'),
    (r'អេអាយ', 'AI'),
    (r'(អាក្សេស|អាក់សេស|សេស(?=ចូល)|(?<=អោយវា)សេស)', 'Access'),
    (r'(ប្រើសរណ៍|ប្រោស័រ|ប្រាវស័រ|ប្រូស័រ|ប្រើសិល)', 'Browser'),
    (r'បោះខ្ញុំ', 'របស់ខ្ញុំ'),
    (r'ពិចនល់អីជី|ស្ពីចណាឡូជី|speakknowlegy', 'Speech Technology')
]

def clean_garbled_unicode(text: str) -> str:
    """
    Remove tofu boxes, replacement characters, illegal vowel clusters,
    and foreign script hallucinations (Georgian, Cyrillic, Thai, etc.)
    while strictly preserving valid Khmer characters, sub-consonants, and ZWJ/ZWNJ shaping.
    """
    if not text:
        return ""

    # 1. Canonical Unicode NFC Normalization
    text = unicodedata.normalize("NFC", text)

    # 2. Preserve ZWJ (\u200d) and ZWNJ (\u200c) for Khmer coeng shaping, strip invisible Cc controls
    text = "".join(
        char for char in text
        if char in ("\u200c", "\u200d") or unicodedata.category(char) != "Cc"
    )

    # 3. Remove Unicode replacement character and tofu boxes (\uFFFD, [])
    text = text.replace('\uFFFD', '').replace('[]', '')

    # 4. Remove foreign script hallucinations (Georgian \u10A0-\u10FF, Cyrillic \u0400-\u04FF, Thai \u0E00-\u0E7F)
    text = re.sub(r'[\u10A0-\u10FF\u0400-\u04FF\u0E00-\u0E7F]+', ' ', text)

    # 5. Collapse illegal consecutive Khmer dependent vowels (e.g. \u17B8\u17B6)
    # In valid Khmer script, a consonant may only take ONE dependent vowel (\u17B6-\u17C5)
    text = re.sub(r'([\u17B6-\u17C5]){2,}', r'\1', text)

    # 6. Remove orphan diacritics/signs that appear without a base consonant or vowel
    # Signs: \u17C6-\u17D3
    text = re.sub(r'(^|\s)([\u17B6-\u17D3]+)', r'\1', text)

    # 7. Collapse duplicate zero-width spaces & repeated whitespace
    text = re.sub(r'[\u200B\uFEFF]+', ' ', text)
    text = re.sub(r'([A-Za-z0-9])Protocol\b', r'\1 Protocol', text)
    text = re.sub(r'\bProtocol\s+Protocol\b', 'Protocol', text)
    text = re.sub(r'[ \t]+', ' ', text)

    # 8. Remove severe character repetitions (3+ same chars in a row)
    text = re.sub(r'(.)\1{3,}', r'\1\1', text)

    return text.strip()

def phonetic_khmer_to_unicode(text: str) -> str:
    """
    Translates Romanized phonetic Khmer speech (common output of Whisper on code-switching)
    into standard Khmer Unicode script and clean English tech loanwords.
    """
    if not text:
        return ""

    processed = text

    # Process all phonetic & code-switching replacements
    for pattern, replacement in PHONETIC_PHRASES:
        if callable(replacement):
            processed = re.sub(pattern, replacement, processed)
        else:
            processed = re.sub(pattern, replacement, processed)

    # Polish tech loanwords and names
    processed = re.sub(r'(?i)\bcha(d|t|chi)[\s\-_]*(g|b)p?t(it|t)?\b', 'ChatGPT', processed)
    processed = re.sub(r'(?i)\bclaude\b', 'Claude', processed)
    processed = re.sub(r'(?i)\bgemin(i|ae)\b', 'Gemini', processed)
    processed = re.sub(r'(?i)\bmanager\s*agent\b', 'Manager Agent', processed)
    processed = re.sub(r'(?i)\bsoftware\s*project\b', 'Software Project', processed)
    processed = re.sub(r'(?i)\ba2a\b', 'A2A', processed)

    # Spacing between Khmer characters and English words
    processed = re.sub(r'([\u1780-\u17FF])([A-Za-z0-9])', r'\1 \2', processed)
    processed = re.sub(r'([A-Za-z0-9])([\u1780-\u17FF])', r'\1 \2', processed)
    processed = re.sub(r'(ChatGPT)(Claude)', r'\1, \2', processed)
    processed = re.sub(r'(?i)A2A\s*Protocol\s*Protocol', 'A2A Protocol', processed)

    # Polish punctuation and whitespace
    processed = re.sub(r'និង,\s*', 'និង ', processed)
    processed = re.sub(r'\s*,\s*', ', ', processed)
    processed = re.sub(r'\s+', ' ', processed).strip()
    return processed

def insert_khmer_zero_width_spaces(text: str) -> str:
    """
    Inserts Zero-Width Space (\u200B) at clean phrase boundaries.
    Avoids inserting between base consonants and final consonants to prevent font glyph distortion.
    """
    if not text:
        return ""
    # Safe ZWSP insertion only after spaces or punctuation boundaries
    return re.sub(r'([\s,៕]+)', r'\1\u200b', text)

def normalize_khmer_text(text: str, add_syllable_breaks: bool = False) -> str:
    """
    Full pipeline:
    1. Pre-clean replacement glyphs
    2. Translate phonetics/loanwords to clean Khmer script
    3. Remove invalid vowel stacking and orphan signs
    4. Insert natural Zero-Width Space syllable breaks for responsive line-wrapping
    """
    if not text:
        return ""

    pre_cleaned = text.replace('\uFFFD', '').replace('[]', '').strip()
    if not pre_cleaned:
        return ""

    translated = phonetic_khmer_to_unicode(pre_cleaned)
    final_cleaned = clean_garbled_unicode(translated)

    if add_syllable_breaks:
        return insert_khmer_zero_width_spaces(final_cleaned).strip()
    return final_cleaned.strip()

def merge_short_subtitle_segments(
    segments: List[SubtitleSegmentItem],
    min_duration: float = 1.0,
    max_duration: float = 4.5,
    max_gap: float = 0.5
) -> List[SubtitleSegmentItem]:
    """
    Merges overly short micro-segments (< 1.0s) into coherent, natural subtitle sentences
    for professional video playback and CapCut/Premiere export.
    """
    if not segments:
        return []

    merged: List[SubtitleSegmentItem] = []
    current = segments[0]

    for next_seg in segments[1:]:
        curr_duration = current.end - current.start
        gap = next_seg.start - current.end

        # Deduplicate consecutive identical text
        if current.text == next_seg.text and gap <= 1.0:
            current = SubtitleSegmentItem(
                id=current.id,
                start=current.start,
                end=next_seg.end,
                text=current.text
            )
            continue

        # If current segment is too short and gap to next is small, merge them
        if curr_duration < min_duration and gap <= max_gap and (next_seg.end - current.start) <= max_duration:
            combined_text = f"{current.text} {next_seg.text}".strip()
            current = SubtitleSegmentItem(
                id=current.id,
                start=current.start,
                end=next_seg.end,
                text=combined_text
            )
        else:
            merged.append(current)
            current = next_seg

    # Handle the final segment: if too short and previous segment has room, merge backwards
    if merged and (current.end - current.start) < min_duration:
        last = merged[-1]
        if (current.end - last.start) <= max_duration and (current.start - last.end) <= max_gap:
            merged[-1] = SubtitleSegmentItem(
                id=last.id,
                start=last.start,
                end=current.end,
                text=f"{last.text} {current.text}".strip()
            )
        else:
            merged.append(current)
    else:
        merged.append(current)

    # Re-index IDs sequentially
    for idx, seg in enumerate(merged, start=1):
        seg.id = idx

    return merged

def split_long_subtitle_segments(
    segments: List[SubtitleSegmentItem],
    max_duration: float = 4.5
) -> List[SubtitleSegmentItem]:
    """
    Splits long segments (> max_duration) into clean, naturally paced subtitle lines.
    Uses space and Khmer clause boundary markers (particles/conjunctions) to avoid awkward splits.
    """
    if not segments:
        return []

    split_list: List[SubtitleSegmentItem] = []
    for seg in segments:
        dur = seg.end - seg.start
        if dur <= max_duration:
            split_list.append(seg)
            continue

        raw_text = seg.text.strip()
        # Tokenize by spaces and natural Khmer conjunctions/prepositions
        tokens = [p.strip() for p in re.split(r'(\s+|(?=(?:ហើយ|និង|ដែល|ដើម្បី|ព្រោះ|ប៉ុន្តែ|គឺ|នេះ|របស់|ចូលទៅ|ទៅក្នុង|ក្នុងការ)))', raw_text) if p.strip()]

        if len(tokens) <= 1:
            chunk_len = max(18, int(len(raw_text) * (3.5 / dur)))
            tokens = [raw_text[i:i+chunk_len].strip() for i in range(0, len(raw_text), chunk_len) if raw_text[i:i+chunk_len].strip()]

        if len(tokens) <= 1:
            split_list.append(seg)
            continue

        total_chars = max(1, len(raw_text))
        max_chunk_chars = max(14, int(total_chars * (3.8 / dur)))

        chunks = []
        cur_tokens = []
        cur_chars = 0
        for t in tokens:
            if cur_tokens and (cur_chars + len(t) > max_chunk_chars):
                chunks.append(' '.join(cur_tokens).strip())
                cur_tokens = [t]
                cur_chars = len(t)
            else:
                cur_tokens.append(t)
                cur_chars += len(t)
        if cur_tokens:
            chunks.append(' '.join(cur_tokens).strip())

        cur_t = seg.start
        for idx, chunk_text in enumerate(chunks):
            if not chunk_text:
                continue
            fraction = len(chunk_text) / total_chars
            chunk_dur = dur * fraction
            end_t = round(seg.end if idx == len(chunks) - 1 else min(seg.end, cur_t + chunk_dur), 2)
            split_list.append(
                SubtitleSegmentItem(
                    id=len(split_list) + 1,
                    start=round(cur_t, 2),
                    end=end_t,
                    text=chunk_text
                )
            )
            cur_t = end_t

    # Re-index IDs sequentially
    for idx, seg in enumerate(split_list, start=1):
        seg.id = idx

    return split_list
