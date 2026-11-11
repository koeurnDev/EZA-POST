import { SubtitleSegment } from './khmer_normalizer';

function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatVttTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatAssTimestamp(seconds: number): string {
  const totalCs = Math.round(seconds * 100);
  const hours = Math.floor(totalCs / 360000);
  const minutes = Math.floor((totalCs % 360000) / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function generateSrt(segments: SubtitleSegment[]): string {
  const blocks: string[] = [];
  for (let idx = 0; idx < segments.length; idx++) {
    const s = segments[idx];
    const startStr = formatSrtTimestamp(s.start);
    const endStr = formatSrtTimestamp(s.end);
    blocks.push(`${idx + 1}\n${startStr} --> ${endStr}\n${s.text}`);
  }
  return blocks.join('\n\n') + '\n';
}

export function generateVtt(segments: SubtitleSegment[]): string {
  const blocks: string[] = ['WEBVTT\n'];
  for (let idx = 0; idx < segments.length; idx++) {
    const s = segments[idx];
    const startStr = formatVttTimestamp(s.start);
    const endStr = formatVttTimestamp(s.end);
    blocks.push(`${idx + 1}\n${startStr} --> ${endStr}\n${s.text}`);
  }
  return blocks.join('\n\n') + '\n';
}

export function generateAss(segments: SubtitleSegment[], fontName: string = 'Kantumruy Pro'): string {
  const header = `[Script Info]
Title: KhmerSub AI Edge Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines: string[] = [header];
  for (const s of segments) {
    const startStr = formatAssTimestamp(s.start);
    const endStr = formatAssTimestamp(s.end);
    const textEscaped = s.text.replace(/\n/g, '\\N');
    lines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${textEscaped}`);
  }

  return lines.join('\n') + '\n';
}

