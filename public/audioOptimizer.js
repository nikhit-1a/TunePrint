/**
 * audioOptimizer.js
 * 
 * Utility for optimizing recorded audio before sending to ACRCloud.
 * Performs:
 * 1. Decoding & Resampling (16kHz Mono)
 * 2. Silence Trimming (based on RMS)
 * 3. Validation (min duration)
 * 4. 16-bit PCM WAV encoding
 */

/**
 * Optimizes the raw audio blob for ACRCloud pitch extraction.
 * @param {Blob|AudioBuffer} inputAudio - The raw audio blob from MediaRecorder or an AudioBuffer
 * @param {Object} options - Configuration options
 * @param {number} options.targetSampleRate - Target sample rate (default: 16000)
 * @param {number} options.silenceThresholdDb - RMS threshold in dB for silence (default: -45)
 * @param {number} options.minDurationSec - Minimum required duration in seconds (default: 8)
 * @returns {Promise<{blob: Blob, duration: number}>} - Processed WAV Blob and duration
 */
export async function optimizeHummingAudio(inputAudio, options = {}) {
  const {
    targetSampleRate = 16000,
    silenceThresholdDb = -45,
    minDurationSec = 8
  } = options;

  let audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let decodedBuffer;

  // 1. Decode Audio
  if (inputAudio instanceof Blob) {
    const arrayBuffer = await inputAudio.arrayBuffer();
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } else if (inputAudio instanceof AudioBuffer) {
    decodedBuffer = inputAudio;
  } else {
    throw new Error("Invalid input: Expected Blob or AudioBuffer");
  }

  // Resample and downmix to Mono using OfflineAudioContext
  const duration = decodedBuffer.duration;
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    1, // 1 channel (Mono)
    targetSampleRate * duration,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  const rawSamples = resampledBuffer.getChannelData(0); // Float32Array

  // 2. Silence Trimming
  // Calculate RMS in chunks (e.g., 50ms)
  const chunkSize = Math.floor(targetSampleRate * 0.05);
  const totalChunks = Math.floor(rawSamples.length / chunkSize);
  const rmsValues = [];

  for (let i = 0; i < totalChunks; i++) {
    let sumSq = 0;
    const start = i * chunkSize;
    for (let j = 0; j < chunkSize; j++) {
      const sample = rawSamples[start + j];
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / chunkSize);
    // Convert RMS to decibels. Avoid log(0).
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    rmsValues.push(db);
  }

  // Find start index (first chunk above threshold)
  let startChunk = 0;
  while (startChunk < totalChunks && rmsValues[startChunk] < silenceThresholdDb) {
    startChunk++;
  }

  // Find end index (last chunk above threshold)
  let endChunk = totalChunks - 1;
  while (endChunk > startChunk && rmsValues[endChunk] < silenceThresholdDb) {
    endChunk--;
  }

  // If the whole file is silence
  if (startChunk >= endChunk) {
    throw new Error("Audio contains mostly silence. Please hum louder and try again.");
  }

  const startSampleIndex = startChunk * chunkSize;
  const endSampleIndex = (endChunk + 1) * chunkSize;
  const trimmedSamples = rawSamples.slice(startSampleIndex, endSampleIndex);

  // 3. Validation Check
  const trimmedDuration = trimmedSamples.length / targetSampleRate;
  if (trimmedDuration < minDurationSec) {
    throw new Error(`Audio is too short (${trimmedDuration.toFixed(1)}s). Please hum continuously for at least ${minDurationSec} seconds.`);
  }

  // 4. Output Encoding (WAV 16-bit PCM)
  const wavBlob = encodeWAV(trimmedSamples, targetSampleRate);

  return {
    blob: wavBlob,
    duration: trimmedDuration
  };
}

/**
 * Encodes Float32Array audio samples to a 16-bit PCM WAV Blob.
 */
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);        // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);        // NumChannels (1 channel)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);        // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true);       // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp sample between -1 and 1
    let s = Math.max(-1, Math.min(1, samples[i]));
    // Convert to 16-bit integer
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}
