let ctx: AudioContext | null = null;
let ringTimer: number | null = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio() {
  try {
    const c = getCtx();
    if (c.state === "suspended") void c.resume();
  } catch {
    /* autoplay policies vary */
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number) {
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export function playSend() {
  unlockAudio();
  const t = getCtx().currentTime;
  tone(620, t, 0.07, "sine", 0.04);
  tone(880, t + 0.06, 0.09, "sine", 0.035);
}

export function playReceive() {
  unlockAudio();
  const t = getCtx().currentTime;
  tone(494, t, 0.08, "triangle", 0.04);
  tone(740, t + 0.08, 0.12, "sine", 0.03);
}

export function playSuccess() {
  unlockAudio();
  const t = getCtx().currentTime;
  tone(523, t, 0.1, "sine", 0.04);
  tone(659, t + 0.09, 0.1, "sine", 0.04);
  tone(784, t + 0.18, 0.18, "sine", 0.045);
}

export function playError() {
  unlockAudio();
  const t = getCtx().currentTime;
  tone(196, t, 0.12, "triangle", 0.04);
  tone(164, t + 0.1, 0.16, "triangle", 0.035);
}

export function playConnect() {
  unlockAudio();
  const t = getCtx().currentTime;
  tone(440, t, 0.08, "sine", 0.035);
  tone(660, t + 0.07, 0.12, "sine", 0.03);
}

export function startRing() {
  stopRing();
  unlockAudio();
  const tick = () => {
    try {
      const t = getCtx().currentTime;
      tone(440, t, 0.16, "sine", 0.045);
      tone(554, t + 0.16, 0.2, "sine", 0.04);
    } catch {
      /* ignore */
    }
  };
  tick();
  ringTimer = window.setInterval(tick, 1500);
}

export function stopRing() {
  if (ringTimer != null) window.clearInterval(ringTimer);
  ringTimer = null;
}

export function makeVoiceSample(seconds = 2.2) {
  const sr = 8000;
  const n = Math.floor(sr * seconds);
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const time = i / sr;
    const env = Math.min(1, time * 10) * Math.min(1, (seconds - time) * 5);
    const freq = time < seconds * 0.45 ? 392 : time < seconds * 0.75 ? 494 : 330;
    const sample = Math.sin(2 * Math.PI * freq * time) * 0.32 * env;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  const bytes = new Uint8Array(buffer);
  let bin = "";
  const size = 4096;
  for (let i = 0; i < bytes.length; i += size) {
    bin += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return `data:audio/wav;base64,${btoa(bin)}`;
}
