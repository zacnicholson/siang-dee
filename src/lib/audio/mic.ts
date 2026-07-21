/**
 * Mic capture → 16 kHz mono Float32 PCM, suitable for wav2vec2.
 * Uses AudioWorklet when available, falls back to ScriptProcessor (deprecated
 * but widely supported) on older Safari. See SPEC §5.2.
 */

export interface MicRecorder {
  start(): Promise<void>;
  stop(): Promise<Float32Array>;
  isRecording(): boolean;
  getLevel(): number; // 0..1 instantaneous RMS for visualizer
}

const TARGET_SR = 16000;

export async function createMicRecorder(): Promise<MicRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("navigator.mediaDevices.getUserMedia not available (need HTTPS or localhost)");
  }

  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let scriptNode: ScriptProcessorNode | null = null;
  let chunks: Float32Array[] = [];
  let level = 0;
  let recording = false;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    ctx = new AudioContext({ sampleRate: TARGET_SR });
    if (ctx.state === "suspended") await ctx.resume();

    const src = ctx.createMediaStreamSource(stream);
    chunks = [];
    recording = true;

    // Try AudioWorklet first (modern path)
    try {
      const workletCode = `
        class RecProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const ch = inputs[0] && inputs[0][0];
            if (ch) {
              // copy — the buffer is reused
              const copy = new Float32Array(ch.length);
              copy.set(ch);
              this.port.postMessage(copy, [copy.buffer]);
            }
            return true;
          }
        }
        registerProcessor("rec-processor", RecProcessor);
      `;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      workletNode = new AudioWorkletNode(ctx, "rec-processor", {
        numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1,
      });
      workletNode.port.onmessage = (ev) => {
        if (!recording) return;
        const data = ev.data as Float32Array;
        // level (RMS)
        let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        level = Math.sqrt(sum / data.length);
        chunks.push(data);
      };
      src.connect(workletNode);
      return;
    } catch {
      // fallback: ScriptProcessorNode (Safari legacy)
      scriptNode = ctx.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (ev) => {
        if (!recording) return;
        const input = ev.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        let sum = 0; for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
        level = Math.sqrt(sum / copy.length);
        chunks.push(copy);
      };
      src.connect(scriptNode);
      // ScriptProcessor needs a destination to pull; use a zero-gain to avoid feedback
      const zero = ctx.createGain(); zero.gain.value = 0;
      scriptNode.connect(zero); zero.connect(ctx.destination);
    }
  }

  function stop(): Promise<Float32Array> {
    recording = false;
    if (workletNode) { workletNode.disconnect(); workletNode = null; }
    if (scriptNode) { scriptNode.disconnect(); scriptNode = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    // concat chunks
    let total = 0; for (const c of chunks) total += c.length;
    const out = new Float32Array(total);
    let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
    chunks = [];
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    return Promise.resolve(out);
  }

  return {
    start,
    stop,
    isRecording: () => recording,
    getLevel: () => level,
  };
}

/** Encode Float32 PCM → WAV Blob (16-bit) for storage/replay in IndexedDB.
 *  Applies a short fade-out to the last 5ms to prevent speaker clicks/pops
 *  from an abrupt discontinuity at the end of the recording. */
export function pcmToWav(pcm: Float32Array, sampleRate = TARGET_SR): Blob {
  // Apply a 5ms linear fade-out to the tail to prevent speaker pops.
  // The click happens because the recording ends mid-waveform at full
  // amplitude — the sudden jump to zero creates an audible transient.
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.005), pcm.length); // 5ms
  if (fadeSamples > 0) {
    for (let i = 0; i < fadeSamples; i++) {
      const gain = 1.0 - (i / fadeSamples);
      pcm[pcm.length - fadeSamples + i] *= gain;
    }
  }
  // Also fade-in the first 2ms to prevent any startup click
  const fadeInSamples = Math.min(Math.floor(sampleRate * 0.002), pcm.length);
  if (fadeInSamples > 0) {
    for (let i = 0; i < fadeInSamples; i++) {
      pcm[i] *= i / fadeInSamples;
    }
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, pcm.length * 2, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
