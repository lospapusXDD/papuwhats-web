/**
 * WebRTC Peer-to-Peer Calling Engine for PapuWhats
 */
import { PapuApi } from "./api";

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let pollTimer: any = null;
const processedSignals = new Set<number>();
let streamListeners: Array<(s: MediaStream | null) => void> = [];
let localStreamListeners: Array<(s: MediaStream | null) => void> = [];

export function getRemoteStream(): MediaStream | null {
  return remoteStream;
}

export function getLocalStream(): MediaStream | null {
  return localStream;
}

export function onRemoteStreamChange(listener: (s: MediaStream | null) => void) {
  streamListeners.push(listener);
  listener(remoteStream);
  return () => {
    streamListeners = streamListeners.filter((l) => l !== listener);
  };
}

export function onLocalStreamChange(listener: (s: MediaStream | null) => void) {
  localStreamListeners.push(listener);
  listener(localStream);
  return () => {
    localStreamListeners = localStreamListeners.filter((l) => l !== listener);
  };
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

async function acquireLocalStream(kind: "voice" | "video"): Promise<MediaStream | null> {
  const getMedia =
    navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
    (navigator as any).getUserMedia?.bind(navigator) ||
    (navigator as any).webkitGetUserMedia?.bind(navigator) ||
    (navigator as any).mozGetUserMedia?.bind(navigator);

  if (!getMedia) {
    console.warn("[WebRTC] getUserMedia no soportado en este entorno");
    return null;
  }

  if (kind === "video") {
    // 1. Intentar obtener ambos: audio y cámara
    try {
      return await getMedia({ audio: true, video: true });
    } catch (err) {
      console.warn("[WebRTC] Falló audio+video juntos (dispositivo sin cámara o permiso denegado). Intentando solo micrófono...", err);
    }

    // 2. Si no tiene cámara (ej: PC de escritorio con micrófono/auriculares), obtener solo micrófono
    try {
      return await getMedia({ audio: true, video: false });
    } catch (audioErr) {
      console.warn("[WebRTC] Falló micrófono. Intentando solo cámara...", audioErr);
    }

    // 3. Si tiene cámara pero no micrófono
    try {
      return await getMedia({ audio: false, video: true });
    } catch (videoErr) {
      console.warn("[WebRTC] No se pudo obtener ningún dispositivo de medios:", videoErr);
      return null;
    }
  } else {
    // Llamada solo de voz
    try {
      return await getMedia({ audio: true, video: false });
    } catch (err) {
      console.warn("[WebRTC] No se pudo obtener micrófono para llamada de voz:", err);
      return null;
    }
  }
}

export async function initCallPeer(
  callId: string,
  isCaller: boolean,
  kind: "voice" | "video",
  onRemoteStream?: (stream: MediaStream) => void
): Promise<MediaStream | null> {
  cleanupCall();

  localStream = await acquireLocalStream(kind);
  localStreamListeners.forEach((fn) => fn(localStream));

  pc = new RTCPeerConnection(RTC_CONFIG);

  if (localStream) {
    localStream.getTracks().forEach((track) => pc?.addTrack(track, localStream!));
  }

  // Si no tenemos cámara local pero es videollamada, agregamos un transceptor recvonly para poder recibir video de la otra persona
  if (kind === "video" && (!localStream || localStream.getVideoTracks().length === 0)) {
    try {
      pc.addTransceiver("video", { direction: "recvonly" });
    } catch {}
  }
  // Si no tenemos micrófono local, agregamos un transceptor recvonly para poder recibir audio
  if (!localStream || localStream.getAudioTracks().length === 0) {
    try {
      pc.addTransceiver("audio", { direction: "recvonly" });
    } catch {}
  }

  pc.ontrack = (event) => {
    let stream = event.streams[0];
    if (!stream) {
      if (!remoteStream) {
        remoteStream = new MediaStream();
      }
      remoteStream.addTrack(event.track);
      stream = remoteStream;
    } else {
      remoteStream = stream;
    }

    streamListeners.forEach((fn) => fn(stream));

    if (!remoteAudio) {
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      (remoteAudio as any).playsInline = true;
      document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = stream;
    void remoteAudio.play().catch(() => {});
    if (onRemoteStream) onRemoteStream(stream);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void PapuApi.sendCallSignal(callId, { type: "ice", candidate: event.candidate });
    }
  };

  // Si somos quien llama, creamos la oferta inicial
  if (isCaller) {
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === "video" });
    await pc.setLocalDescription(offer);
    void PapuApi.sendCallSignal(callId, { type: "offer", sdp: offer.sdp });
  }

  // Polling de señales de la otra persona cada 800ms
  pollTimer = setInterval(async () => {
    if (!pc) return;
    const signals = await PapuApi.getCallSignals(callId);
    for (let i = 0; i < signals.length; i++) {
      if (processedSignals.has(i)) continue;
      processedSignals.add(i);

      const item = signals[i];
      const sig = item.signal;
      if (!sig) continue;

      if (sig.type === "offer" && !isCaller) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: sig.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void PapuApi.sendCallSignal(callId, { type: "answer", sdp: answer.sdp });
      } else if (sig.type === "answer" && isCaller) {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: sig.sdp }));
        }
      } else if (sig.type === "ice" && sig.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
        } catch {}
      }
    }
  }, 800);

  return localStream;
}

export function cleanupCall() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  processedSignals.clear();

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (pc) {
    try { pc.close(); } catch {}
    pc = null;
  }
  if (remoteAudio) {
    remoteAudio.pause();
    remoteAudio.srcObject = null;
    remoteAudio.remove();
    remoteAudio = null;
  }
  remoteStream = null;
  streamListeners.forEach((fn) => fn(null));
  localStreamListeners.forEach((fn) => fn(null));
}

export function setLocalAudioMuted(muted: boolean) {
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }
}

export function setLocalCameraEnabled(enabled: boolean) {
  if (localStream) {
    localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }
}
