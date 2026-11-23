import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { formatDuration } from "@/lib/papu/format";
import { usePapu } from "@/lib/papu/store";
import { Avatar } from "@/components/papu/avatar";
import { onLocalStreamChange, onRemoteStreamChange } from "@/lib/papu/webrtc";

export function CallOverlay() {
  const call = usePapu((s) => s.call);
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const acceptCall = usePapu((s) => s.acceptCall);
  const endCall = usePapu((s) => s.endCall);
  const setCallMuted = usePapu((s) => s.setCallMuted);
  const setCamera = usePapu((s) => s.setCamera);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [camError, setCamError] = useState(false);
  const chat = data?.chats.find((item) => item.id === call?.chatId);

  useEffect(() => {
    return onLocalStreamChange((stream) => {
      setLocalStream(stream);
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    });
  }, []);

  useEffect(() => {
    return onRemoteStreamChange((stream) => {
      setRemoteStream(stream);
      if (remoteVideoRef.current && stream) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current && stream) {
        remoteAudioRef.current.srcObject = stream;
        void remoteAudioRef.current.play().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (call?.phase !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    let wakeLockSentinel: any = null;
    if ("wakeLock" in navigator && typeof (navigator as any).wakeLock?.request === "function") {
      (navigator as any).wakeLock.request("screen").then((sentinel: any) => {
        wakeLockSentinel = sentinel;
      }).catch(() => {});
    }
    return () => {
      window.clearInterval(timer);
      wakeLockSentinel?.release().catch(() => {});
    };
  }, [call?.phase, call?.id]);

  useEffect(() => {
    if (!call?.cameraOn) {
      setCamError(false);
      return;
    }
    // Si ya tenemos track de video en localStream, listo
    if (localStream && localStream.getVideoTracks().length > 0) {
      if (videoRef.current) videoRef.current.srcObject = localStream;
      return;
    }
    // Fallback si no había video iniciado
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        if (videoRef.current) videoRef.current.srcObject = next;
      })
      .catch(() => {
        if (!cancelled) setCamError(true);
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [call?.cameraOn, call?.id, localStream]);

  if (!call || !chat) return null;
  const status =
    call.phase === "incoming" ? "Llamada entrante" : call.phase === "outgoing" ? "Llamando…" : formatDuration(now - (call.startedAt ?? now));

  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink text-bone overflow-hidden">
      {/* Audio remoto oculto para asegurar reproducción de voz */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Video remoto en pantalla completa si la otra persona tiene cámara */}
      {hasRemoteVideo ? (
        <div className="absolute inset-0 z-0">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/30" />
        </div>
      ) : null}

      {/* Cámara local flotante Picture-in-Picture (PiP) en la esquina */}
      {call.cameraOn && localStream && localStream.getVideoTracks().length > 0 ? (
        <div className="fixed bottom-28 right-5 z-30 w-32 sm:w-44 aspect-[3/4] overflow-hidden rounded-2xl border-2 border-amber/70 bg-panel shadow-2xl transition-all">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover -scale-x-100" />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {!hasRemoteVideo ? (
          <div className="relative">
            <span className="pulse-ring absolute -inset-4 rounded-full border border-amber/70" />
            <span className="pulse-ring absolute -inset-8 rounded-full border border-amber/40 [animation-delay:0.8s]" />
            <Avatar name={chat.title} tone={chat.tone} size="xl" />
          </div>
        ) : null}
        <h2 className="mt-8 font-display text-4xl text-balance drop-shadow-md">{chat.title}</h2>
        <p className="mt-2 text-bone-dim drop-shadow-sm">
          {call.kind === "video" ? "Video" : "Voz"} · <span className="tabular-nums">{status}</span>
        </p>
        {call.muted ? <p className="mt-2 text-sm text-mute">Micrófono en silencio</p> : null}
      </div>
      <div className="safe-bottom flex items-center justify-center gap-6 px-6 pt-4 pb-10">
        {call.phase === "incoming" ? (
          <>
            <Round label="Rechazar" className="bg-clay text-bone" onClick={endCall}>
              <PhoneOff className="size-6" />
            </Round>
            <Round label="Contestar" className="bg-moss text-bone" onClick={acceptCall}>
              <Phone className="size-6" />
            </Round>
          </>
        ) : (
          <>
            <Round label={call.muted ? "Activar micrófono" : "Silenciar"} className="bg-panel-2 text-bone" onClick={() => setCallMuted(!call.muted)}>
              {call.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </Round>
            {call.kind === "video" ? (
              <Round label={call.cameraOn ? "Apagar cámara" : "Encender cámara"} className="bg-panel-2 text-bone" onClick={() => setCamera(!call.cameraOn)}>
                {call.cameraOn ? <VideoOff className="size-6" /> : <Video className="size-6" />}
              </Round>
            ) : null}
            <Round label="Colgar" className="bg-clay text-bone" onClick={endCall}>
              <PhoneOff className="size-6" />
            </Round>
          </>
        )}
      </div>
    </div>
  );
}

function Round({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`inline-flex size-16 items-center justify-center rounded-full transition duration-150 active:scale-[0.96] ${className}`}>
      {children}
    </button>
  );
}
