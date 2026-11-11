/**
 * Browser-side Web Audio Extractor
 * Decodes video files (MP4, MOV, WEBM) and extracts a pure 16kHz mono WAV
 * to prevent Whisper decoding errors (Cloudflare 8007) and speed up upload.
 */

export function audioBufferToWavBlob(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = audioBuffer.getChannelData(0);
  const numSamples = channelData.length;
  const dataSize = numSamples * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM 16-bit Samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function extractAudioFromVideo(file, maxDurationSeconds = 300) {
  let audioCtx = null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    const arrayBuffer = await file.arrayBuffer();
    audioCtx = new AudioContextClass();

    // Decode audio safely with dual promise/callback compatibility
    const decodedAudio = await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err)
      );
    });

    if (!decodedAudio || decodedAudio.length === 0) {
      return null;
    }

    // Limit duration to avoid exceeding memory (up to maxDurationSeconds)
    const duration = Math.min(decodedAudio.duration, maxDurationSeconds);
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(duration * targetSampleRate));

    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedAudio;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampledBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(resampledBuffer);
  } catch (err) {
    console.warn('Client-side audio extraction warning:', err);
    return null;
  } finally {
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch (_) {}
    }
  }
}

