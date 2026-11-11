export interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

// Domain vocabulary & tech loanword mappings
const PHONETIC_PHRASES: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\bchat[\s\-_]*gpt\b/gi, 'ChatGPT'],
  [/\bclaude\b/gi, 'Claude'],
  [/\bgemini\b/gi, 'Gemini'],
  [/\bcodex\b/gi, 'Codex'],
  [/\ba2a\s*protocol\b/gi, 'A2A Protocol'],
  [/\ba\s*2\s*a\b/gi, 'A2A'],
  [/\bagent[\s\-_]*to[\s\-_]*agent(\s*protocol)?\b/gi, 'Agent-to-Agent Protocol'],
  [/\bmanager\s*agent\b/gi, 'Manager Agent'],
  [/\bsoftware\s*project\b/gi, 'Software Project'],
  [/\bgit[\s\-_]*hub(\s*repo)?\b/gi, 'GitHub Repo'],
  [/\brequirement(s)?\b/gi, 'Requirement'],
  [/\btask(s)?\b/gi, 'Task'],
  [/\bresult(s)?\b/gi, 'Result']
];

export function cleanGarbledUnicode(text: string): string {
  if (!text) return '';

  // 1. Canonical Unicode NFC Normalization
  try {
    text = text.normalize('NFC');
  } catch (e) {
    // fallback if environment doesn't support normalize
  }

  // 2. Remove Unicode replacement character and tofu boxes (\uFFFD, [])
  text = text.replace(/\uFFFD/g, '').replace(/\[\]/g, '');

  // 3. Remove foreign script hallucinations (Georgian \u10A0-\u10FF, Cyrillic \u0400-\u04FF, Thai \u0E00-\u0E7F)
  text = text.replace(/[\u10A0-\u10FF\u0400-\u04FF\u0E00-\u0E7F]+/g, ' ');

  // 4. Collapse illegal consecutive Khmer dependent vowels ([\u17B6-\u17C5])
  text = text.replace(/([\u17B6-\u17C5]){2,}/g, '$1');

  // 4.5 Repair common ASR omitted base 'អ' before 'ីក៏' (e.g. 'ីក៏ IT ដែរ' -> 'អីក៏ IT ដែរ')
  text = text.replace(/(^|\s)\u17B8ក៏/g, '$1អីក៏');

  // 5. Remove orphan diacritics/signs that appear without a base consonant or vowel
  text = text.replace(/(^|\s)([\u17B6-\u17D3]+)/g, '$1');

  // 6. Clean whitespace & protocol spacing
  text = text.replace(/[\u200B\uFEFF]+/g, ' ');
  text = text.replace(/([A-Za-z0-9])Protocol\b/g, '$1 Protocol');
  text = text.replace(/\bProtocol\s+Protocol\b/g, 'Protocol');
  text = text.replace(/[ \t]+/g, ' ');

  // 7. Remove severe character repetitions (3+ same chars in a row)
  text = text.replace(/(.)\1{3,}/g, '$1$1');

  return text.trim();
}

export function phoneticKhmerToUnicode(text: string): string {
  if (!text) return '';

  let processed = text;
  for (const [pattern, replacement] of PHONETIC_PHRASES) {
    if (typeof replacement === 'function') {
      processed = processed.replace(pattern, replacement);
    } else {
      processed = processed.replace(pattern, replacement);
    }
  }

  // Standardize tech loanwords
  processed = processed.replace(/\bcha(d|t|chi)[\s\-_]*(g|b)p?t(it|t)?\b/gi, 'ChatGPT');
  processed = processed.replace(/\bclaude\b/gi, 'Claude');
  processed = processed.replace(/(ក្លរត់|ក្លោត|ខ្លោត|ខូឡត)/g, 'Claude');
  processed = processed.replace(/\bgemin(i|ae)\b/gi, 'Gemini');
  processed = processed.replace(/(ចេមន័យ|ជេមីណៃ|ជេមីនី|ជំនាយ)/g, 'Gemini');
  processed = processed.replace(/\b(tuset|task(s)?)\b/gi, 'Task');
  processed = processed.replace(/(ទូសេត|ថាស)/g, 'Task');
  processed = processed.replace(/\bresult(s)?\b/gi, 'Result');
  processed = processed.replace(/(រីសាល់|រ៉េសាល់)/g, 'Result');
  processed = processed.replace(/(ប្រូតូកូល|ប្រូថូខូល)/g, 'Protocol');
  processed = processed.replace(/(សូហ្វវែរ|សូហ្វែរ|សបវែ)/g, 'Software');
  processed = processed.replace(/(ប្រូជេក|ប្រូជិក)/g, 'Project');
  processed = processed.replace(/(សាប់ថៃថល|សាប់ថាយថល)/g, 'Subtitle');
  processed = processed.replace(/(អាប់ឡូត|អាបឡូត)/g, 'Upload');
  processed = processed.replace(/(អេកស្ព័ត|អិចស្ព័ត)/g, 'Export');
  processed = processed.replace(/ប៊ុតតុន/g, 'ប៊ូតុង');
  processed = processed.replace(/(ហ្វុន|ហ្វុង)/g, 'Font');
  processed = processed.replace(/អេអាយ/g, 'AI');
  processed = processed.replace(/(អាក្សេស|អាក់សេស|សេស(?=ចូល)|(?<=អោយវា)សេស)/g, 'Access');
  processed = processed.replace(/(ប្រើសរណ៍|ប្រោស័រ|ប្រាវស័រ|ប្រូស័រ|ប្រើសិល)/g, 'Browser');
  processed = processed.replace(/(រីពរ\s*គីតហាប់|គីតហាប់)/g, 'GitHub');
  processed = processed.replace(/បោះខ្ញុំ/g, 'របស់ខ្ញុំ');
  processed = processed.replace(/កាហ្វោ/g, 'កាហ្វេ');
  processed = processed.replace(/(ពិចនល់អីជី|ស្ពីចណាឡូជី|speakknowlegy)/gi, 'Speech Technology');
  processed = processed.replace(/\bmanager\s*agent\b/gi, 'Manager Agent');
  processed = processed.replace(/\bsoftware\s*project\b/gi, 'Software Project');
  processed = processed.replace(/\ba2a\b/gi, 'A2A');

  // Spacing between Khmer characters and English words
  processed = processed.replace(/([\u1780-\u17FF])([A-Za-z0-9])/g, '$1 $2');
  processed = processed.replace(/([A-Za-z0-9])([\u1780-\u17FF])/g, '$1 $2');
  processed = processed.replace(/(ChatGPT)(Claude)/g, '$1, $2');
  processed = processed.replace(/A2A\s*Protocol\s*Protocol/gi, 'A2A Protocol');

  // Clean redundant punctuation and spaces
  processed = processed.replace(/និង,\s*/g, 'និង ');
  processed = processed.replace(/\s*,\s*/g, ', ');

  return processed.replace(/\s+/g, ' ').trim();
}

export function insertKhmerZeroWidthSpaces(text: string): string {
  if (!text) return '';
  return text.replace(/([\s,៕]+)/g, '$1\u200B');
}

export function normalizeKhmerText(text: string, addSyllableBreaks: boolean = false): string {
  if (!text) return '';
  const preCleaned = text.replace(/\uFFFD/g, '').replace(/\[\]/g, '').trim();
  if (!preCleaned) return '';

  const translated = phoneticKhmerToUnicode(preCleaned);
  const finalCleaned = cleanGarbledUnicode(translated);

  if (addSyllableBreaks) {
    return insertKhmerZeroWidthSpaces(finalCleaned).trim();
  }
  return finalCleaned.trim();
}

export function mergeShortSubtitleSegments(
  segments: SubtitleSegment[],
  minDuration: number = 1.0,
  maxDuration: number = 4.5,
  maxGap: number = 0.5
): SubtitleSegment[] {
  if (!segments || segments.length === 0) return [];

  const merged: SubtitleSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const nextSeg = segments[i];
    const currDuration = current.end - current.start;
    const gap = nextSeg.start - current.end;

    // Deduplicate identical consecutive segments
    if (current.text === nextSeg.text && gap <= 1.0) {
      current.end = nextSeg.end;
      continue;
    }

    // Merge short segments
    if (currDuration < minDuration && gap <= maxGap && (nextSeg.end - current.start) <= maxDuration) {
      current.text = `${current.text} ${nextSeg.text}`.trim();
      current.end = nextSeg.end;
    } else {
      merged.push(current);
      current = { ...nextSeg };
    }
  }

  merged.push(current);

  // Re-index IDs
  return merged.map((seg, idx) => ({
    ...seg,
    id: idx + 1
  }));
}
