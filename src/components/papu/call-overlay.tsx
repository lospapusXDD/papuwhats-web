import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { formatDuration } from "@/lib/papu/format";
import { usePapu } from "@/lib/papu/store";
import { Avatar } from "@/components/papu/avatar";

export function CallOverlay() {
  const call = usePapu((s) => s.call);
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const acceptCall = usePapu((s) => s.acceptCall);
  const endCall = usePapu((s) => s.endCall);
  const setCallMuted = usePapu((s) => s.setCallMuted);
  const setCamera = usePapu((s) => s.setCamera);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [camError, setCamError] = useState(false);
  const chat = data?.chats.find((item) => item.id === call?.chatId);

  useEffect(() => {
    if (call?.phase !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [call?.phase, call?.id]);

  useEffect(() => {
    if (!call?.cameraOn) {
      setCamError(false);
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
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
  }, [call?.cameraOn, call?.id]);

  if (!call || !chat) return null;
  const status =
    call.phase === "incoming" ? "Llamada entrante" : call.phase === "outgoing" ? "Llamando…" : formatDuration(now - (call.startedAt ?? now));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink text-bone">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="relative">
          <span className="pulse-ring absolute -inset-4 rounded-full border border-amber/70" />
          <span className="pulse-ring absolute -inset-8 rounded-full border border-amber/40 [animation-delay:0.8s]" />
          <Avatar name={chat.title} tone={chat.tone} size="xl" />
        </div>
        <h2 className="mt-8 font-display text-4xl text-balance">{chat.title}</h2>
        <p className="mt-2 text-bone-dim">
          {call.kind === "video" ? "Video" : "Voz"} · <span className="tabular-nums">{status}</span>
        </p>
        {call.muted ? <p className="mt-2 text-sm text-mute">Micrófono en silencio</p> : null}
        {call.cameraOn ? (
          <div className="mt-6 h-40 w-28 overflow-hidden rounded-2xl border border-line bg-panel">
            {camError ? (
              <p className="flex h-full items-center px-3 text-xs text-mute">Cámara no disponible</p>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            )}
          </div>
        ) : null}
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
