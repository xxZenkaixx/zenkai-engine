// Client-side video compression via mediabunny + WebCodecs.
// Hardware-accelerated H.264 encoding where supported (Chrome, Edge,
// Safari 17+, recent Firefox). Roughly an order of magnitude faster
// than ffmpeg.wasm because all heavy lifting runs on the GPU/ASIC
// rather than in a single wasm thread.
//
// Locked preset for Zenkai gym exercise videos:
//   H.264 / AVC, QUALITY_HIGH (visually clean speech + motion),
//   max 1080p height (never upscales), AAC 128k, MP4 container.
//
// Behavior:
//   - Skips compression (returns original) when the source is too
//     small to benefit, too large to safely process, or when WebCodecs
//     /AVC encode isn't available in this browser.
//   - Reports progress 0..1 through onProgress.
//   - Optional AbortSignal for cancel support.
//   - If the encoded output ends up larger than the input (rare, e.g.
//     pre-compressed source), we return the original file instead.

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  ALL_FORMATS,
  Conversion,
  canEncodeVideo,
  QUALITY_HIGH,
} from 'mediabunny';

// --- Tunables -------------------------------------------------------
const DEFAULT_MAX_HEIGHT = 1080;       // px; never upscales
const DEFAULT_QUALITY    = QUALITY_HIGH;
const DEFAULT_AUDIO_BR   = 128_000;    // 128 kbps AAC

const SKIP_BELOW_BYTES   = 8   * 1024 * 1024;   // <8MB: not worth it
const SKIP_ABOVE_BYTES   = 1024 * 1024 * 1024;  // >1GB: hard ceiling
const MOBILE_SKIP_BYTES  = 600 * 1024 * 1024;   // mobile: 600MB cap
// --------------------------------------------------------------------

const isMobile = () =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Cached one-time support probe.
let supportPromise = null;
function checkSupport() {
  if (supportPromise) return supportPromise;
  supportPromise = (async () => {
    if (typeof window === 'undefined') return false;
    if (typeof VideoEncoder === 'undefined') return false;
    try { return await canEncodeVideo('avc'); }
    catch { return false; }
  })();
  return supportPromise;
}

/**
 * Compress a video file in the browser using WebCodecs.
 *
 * @param {File} file
 * @param {{
 *   onProgress?: (n: number) => void,
 *   onPhase?:    (p: 'loading'|'compressing'|'done') => void,
 *   signal?:     AbortSignal,
 *   maxHeight?:  number,
 *   quality?:    any,        // mediabunny Quality constant or number (bps)
 *   audioBitrate?: number,
 * }} [options]
 * @returns {Promise<{
 *   compressedFile: File,
 *   skipped: boolean,
 *   reason?: string,
 *   originalSize: number,
 *   compressedSize: number,
 * }>}
 */
export async function compressVideo(file, options = {}) {
  const {
    onProgress   = () => {},
    onPhase      = () => {},
    signal,
    maxHeight    = DEFAULT_MAX_HEIGHT,
    quality      = DEFAULT_QUALITY,
    audioBitrate = DEFAULT_AUDIO_BR,
  } = options;

  if (!file || !file.type?.startsWith('video/'))   return passthrough(file, 'not-video');
  if (file.size < SKIP_BELOW_BYTES)                return passthrough(file, 'too-small');
  if (file.size > SKIP_ABOVE_BYTES)                return passthrough(file, 'too-large');
  if (isMobile() && file.size > MOBILE_SKIP_BYTES) return passthrough(file, 'mobile-too-large');

  if (!(await checkSupport())) return passthrough(file, 'unsupported');

  onPhase('loading');

  const input = new Input({
    formats: ALL_FORMATS,
    source:  new BlobSource(file),
  });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  // Decide target height: only downscale, never upscale.
  let targetHeight;
  try {
    const track = await input.getPrimaryVideoTrack();
    const srcH = await track.getDisplayHeight();
    if (srcH > maxHeight) targetHeight = maxHeight;
  } catch {
    targetHeight = maxHeight; // safe default if probe fails
  }

  const videoOpts = {
    codec: 'avc',
    bitrate: quality,
    fit: 'contain',
    hardwareAcceleration: 'prefer-hardware',
  };
  if (targetHeight) videoOpts.height = targetHeight;

  const conversion = await Conversion.init({
    input,
    output,
    video: videoOpts,
    audio: { codec: 'aac', bitrate: audioBitrate },
  });

  conversion.onProgress = (p) => {
    if (typeof p === 'number' && p >= 0 && p <= 1) onProgress(p);
  };

  // Wire AbortSignal → conversion.cancel()
  let canceled = false;
  const onAbort = () => {
    canceled = true;
    try { conversion.cancel(); } catch {}
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort);
  }

  onPhase('compressing');

  try {
    await conversion.execute();
  } catch (err) {
    if (canceled) throw new Error('Compression canceled');
    throw err;
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  const buf = output.target.buffer;
  if (!buf) throw new Error('Conversion produced no output');

  const blob = new Blob([buf], { type: 'video/mp4' });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const compressedFile = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' });

  onPhase('done');

  // If output isn't meaningfully smaller (e.g. source already optimized),
  // return the original so we don't upload a same-size re-encode.
  if (compressedFile.size >= file.size * 0.98) {
    return {
      compressedFile: file,
      skipped: true,
      reason: 'no-savings',
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  return {
    compressedFile,
    skipped: false,
    originalSize: file.size,
    compressedSize: compressedFile.size,
  };
}

function passthrough(file, reason) {
  return {
    compressedFile: file,
    skipped: true,
    reason,
    originalSize:   file?.size ?? 0,
    compressedSize: file?.size ?? 0,
  };
}
