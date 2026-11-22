import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  CornerUpLeft,
  FileText,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Phone,
  Play,
  Send,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { unlockAudio } from "@/lib/papu/audio";
import { clock, dayLabel, formatDuration, presenceLabel, previewText } from "@/lib/papu/format";
import { blobToDataUrl, fileToImageUrl, formatBytes } from "@/lib/papu/media";
import { usePapu } from "@/lib/papu/store";
import type { Message } from "@/lib/papu/types";
import { Avatar } from "@/components/papu/avatar";

export function Thread() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const activeChatId = usePapu((s) => s.activeChatId);
  const typingId = usePapu((s) => s.typingId);
  const replyId = usePapu((s) => s.replyId);
  const infoOpen = usePapu((s) => s.infoOpen);
  const closeChat = usePapu((s) => s.closeChat);
  const setInfo = usePapu((s) => s.setInfo);
  const setReply = usePapu((s) => s.setReply);
  const sendText = usePapu((s) => s.sendText);
  const sendMedia = usePapu((s) => s.sendMedia);
  const deleteMessage = usePapu((s) => s.deleteMessage);
  const startOutgoing = usePapu((s) => s.startOutgoing);
  const startIncoming = usePapu((s) => s.startIncoming);
  const togglePin = usePapu((s) => s.togglePin);
  const toggleMute = usePapu((s) => s.toggleMute);
  const chat = data?.chats.find((item) => item.id === activeChatId);
  const scroller = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [attach, setAttach] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<{ stop: () => Promise<Blob | null>; cancel: () => void } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    setText("");
    setSelected(null);
    setMenu(false);
    setAttach(false);
  }, [activeChatId]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chat?.messages.length, typingId, activeChatId]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [recording]);

  if (!chat) {
    return (
      <div className="thread-bg flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="font-display text-4xl text-balance">PapuWhats</p>
        <p className="mt-3 max-w-sm text-bone-dim">Elige una conversación. Los mensajes de ejemplo ya están en la bandeja.</p>
      </div>
    );
  }

  const reply = chat.messages.find((message) => message.id === replyId);

  async function onImage(file: File | undefined) {
    if (!file) return;
    try {
      const mediaUrl = await fileToImageUrl(file);
      sendMedia({ kind: "image", body: "Imagen", mediaUrl, mediaName: file.name });
    } catch {
      setNotice("No pude leer esa imagen.");
    }
  }

  async function startRecording() {
    unlockAudio();
    setNotice("");
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setNotice("El micrófono requiere HTTPS o localhost en navegadores modernos.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Este navegador no admite grabación de audio directa.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType: string | undefined = undefined;
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
        else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
      }
      const media = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      media.start();
      startedAt.current = Date.now();
      recorder.current = {
        cancel: () => {
          media.onstop = () => stream.getTracks().forEach((track) => track.stop());
          if (media.state !== "inactive") media.stop();
        },
        stop: () =>
          new Promise((resolve) => {
            media.onstop = () => {
              stream.getTracks().forEach((track) => track.stop());
              if (!chunks.length) {
                resolve(null);
                return;
              }
              resolve(new Blob(chunks, { type: media.mimeType || "audio/webm" }));
            };
            if (media.state !== "inactive") media.stop();
            else resolve(null);
          }),
      };
      setElapsed(0);
      setRecording(true);
      window.setTimeout(() => {
        if (Date.now() - startedAt.current > 59000) void finishRecording();
      }, 60000);
    } catch (err: any) {
      console.warn("[Mic] Error accediendo al micrófono:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setNotice("Permiso denegado: haz clic en el candado 🔒 de tu navegador y permite el micrófono.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setNotice("No se detectó ningún micrófono conectado a tu equipo.");
      } else {
        setNotice("Error de micrófono: " + (err?.message || "comprueba los permisos del navegador"));
      }
    }
  }

  async function finishRecording() {
    const current = recorder.current;
    recorder.current = null;
    setRecording(false);
    if (!current) return;
    const blob = await current.stop();
    if (!blob) return;
    const mediaUrl = await blobToDataUrl(blob);
    sendMedia({ kind: "voice", body: "Nota de voz", mediaUrl, durationMs: Math.max(Date.now() - startedAt.current, 600) });
  }

  function cancelRecording() {
    recorder.current?.cancel();
    recorder.current = null;
    setRecording(false);
  }

  return (
    <div
      key={chat.id}
      className="animate-thread-in flex h-full min-h-0 flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) void onImage(file);
      }}
    >
      <header className="flex items-center gap-1 border-b border-line bg-panel px-2 py-2">
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-bone md:hidden" aria-label="Volver" onClick={closeChat}>
          <ArrowLeft className="size-5" />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left" onClick={() => setInfo(!infoOpen)}>
          <Avatar name={chat.title} tone={chat.tone} size="sm" online={chat.presence === "online"} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{chat.title}</span>
            <span className={cn("block truncate text-xs", chat.presence === "online" ? "text-amber" : "text-mute")}>
              {typingId === chat.id ? "escribiendo…" : presenceLabel(chat)}
            </span>
          </span>
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-bone-dim hover:text-bone" aria-label="Llamada de voz" onClick={() => startOutgoing(chat.id, "voice")}>
          <Phone className="size-5" />
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-bone-dim hover:text-bone" aria-label="Videollamada" onClick={() => startOutgoing(chat.id, "video")}>
          <Video className="size-5" />
        </button>
        <div className="relative">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-bone-dim hover:text-bone"
            aria-label="Más opciones"
            onClick={() => setMenu((value) => !value)}
          >
            <MoreVertical className="size-5" />
          </button>
          {menu ? (
            <div className="absolute right-0 z-20 w-56 rounded-2xl border border-line bg-panel-2 p-1 shadow-lg">
              <MenuItem label="Datos del chat" onClick={() => { setInfo(true); setMenu(false); }} />
              <MenuItem label={chat.pinned ? "Quitar fijado" : "Fijar chat"} onClick={() => { togglePin(chat.id); setMenu(false); }} />
              <MenuItem label={chat.muted ? "Activar sonido" : "Silenciar"} onClick={() => { toggleMute(chat.id); setMenu(false); }} />
              <MenuItem label="Probar llamada entrante" onClick={() => { startIncoming(chat.id); setMenu(false); }} />
            </div>
          ) : null}
        </div>
      </header>

      <div ref={scroller} className="thread-bg min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {chat.messages.map((message, index) => {
            const prev = chat.messages[index - 1];
            const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
            return (
              <div key={message.id}>
                {showDay ? (
                  <p className="mx-auto my-3 w-fit rounded-full bg-panel px-3 py-1 text-xs text-bone-dim">{dayLabel(message.createdAt)}</p>
                ) : null}
                <Bubble
                  message={message}
                  mine={message.author === "me"}
                  quoted={chat.messages.find((item) => item.id === message.replyId)}
                  selected={selected === message.id}
                  onSelect={() => setSelected((id) => (id === message.id ? null : message.id))}
                  onZoom={setZoom}
                />
              </div>
            );
          })}
          {typingId === chat.id ? (
            <div className="w-fit rounded-2xl rounded-bl-md bg-panel-2 px-4 py-3 text-sm text-mute">escribiendo…</div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="flex items-center gap-2 border-t border-line bg-panel px-3 py-2">
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-bone" onClick={() => { setReply(selected); setSelected(null); }}>
            <CornerUpLeft className="size-4" aria-hidden="true" />
            Responder
          </button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-clay-bright" onClick={() => { deleteMessage(chat.id, selected); setSelected(null); }}>
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar
          </button>
        </div>
      ) : null}

      <footer className="border-t border-line bg-panel px-3 py-3">
        {reply ? (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl border-l-4 border-amber bg-ink px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber">{reply.author === "me" ? "Tú" : reply.senderName || chat.title}</p>
              <p className="truncate text-sm text-bone-dim">{previewText(reply)}</p>
            </div>
            <button type="button" aria-label="Cancelar respuesta" onClick={() => setReply(null)}>
              <X className="size-4 text-mute" />
            </button>
          </div>
        ) : null}
        {notice ? <p className="mx-auto mb-2 max-w-3xl text-sm text-clay-bright">{notice}</p> : null}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {recording ? (
            <div className="flex h-12 flex-1 items-center gap-3 rounded-full bg-ink px-4">
              <span className="rec-dot size-2.5 rounded-full bg-clay-bright" />
              <span className="text-sm tabular-nums">{formatDuration(elapsed)}</span>
              <span className="text-sm text-mute">Grabando</span>
              <button type="button" className="ml-auto text-sm text-bone-dim" onClick={cancelRecording}>
                Cancelar
              </button>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-full bg-amber text-ink" aria-label="Enviar nota" onClick={() => void finishRecording()}>
                <Square className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <button type="button" className="inline-flex size-12 items-center justify-center rounded-full text-bone-dim hover:text-bone" aria-label="Adjuntar" onClick={() => setAttach((value) => !value)}>
                  <Paperclip className="size-5" />
                </button>
                {attach ? (
                  <div className="absolute bottom-14 left-0 z-20 w-48 rounded-2xl border border-line bg-panel-2 p-1">
                    <MenuItem label="Imagen" icon={<ImageIcon className="size-4" />} onClick={() => { setAttach(false); imageRef.current?.click(); }} />
                    <MenuItem label="Cámara" icon={<Camera className="size-4" />} onClick={() => { setAttach(false); cameraRef.current?.click(); }} />
                    <MenuItem label="Archivo" icon={<FileText className="size-4" />} onClick={() => { setAttach(false); fileRef.current?.click(); }} />
                  </div>
                ) : null}
              </div>
              <textarea
                value={text}
                rows={1}
                placeholder="Escribe un mensaje"
                aria-label="Mensaje"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    sendText(text);
                    setText("");
                  }
                }}
                className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-ink px-4 py-3 text-base text-bone outline-none placeholder:text-mute focus:border-amber"
              />
              {text.trim() ? (
                <button
                  type="button"
                  className="inline-flex size-12 items-center justify-center rounded-full bg-amber text-ink transition duration-150 active:scale-[0.96]"
                  aria-label="Enviar"
                  onClick={() => {
                    sendText(text);
                    setText("");
                  }}
                >
                  <Send className="size-5" />
                </button>
              ) : (
                <button type="button" className="inline-flex size-12 items-center justify-center rounded-full bg-amber text-ink transition duration-150 active:scale-[0.96]" aria-label="Nota de voz" onClick={() => void startRecording()}>
                  <Mic className="size-5" />
                </button>
              )}
            </>
          )}
        </div>
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void onImage(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void onImage(event.target.files?.[0]); event.target.value = ""; }} />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.type.startsWith("image/")) {
              void onImage(file);
              return;
            }
            sendMedia({ kind: "file", body: file.name, mediaName: `${file.name} · ${formatBytes(file.size)}` });
          }}
        />
      </footer>
      {zoom ? (
        <button type="button" className="fixed inset-0 z-30 flex items-center justify-center bg-ink/90 p-6" onClick={() => setZoom(null)} aria-label="Cerrar imagen">
          <img src={zoom} alt="Imagen ampliada" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function MenuItem({ label, onClick, icon }: { label: string; onClick: () => void; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-bone hover:bg-ink">
      {icon}
      {label}
    </button>
  );
}

function Bubble({
  message,
  mine,
  quoted,
  selected,
  onSelect,
  onZoom,
}: {
  message: Message;
  mine: boolean;
  quoted?: Message;
  selected: boolean;
  onSelect: () => void;
  onZoom: (src: string) => void;
}) {
  return (
    <div className={cn("flex transition-opacity duration-150", mine ? "justify-end" : "justify-start")}>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSelect();
        }}
        className={cn(
          "max-w-xs rounded-2xl px-3 py-2 text-left sm:max-w-sm",
          mine ? "rounded-br-md bg-moss text-bone" : "rounded-bl-md bg-panel-2 text-bone",
          selected && "ring-2 ring-amber",
        )}
      >
        {message.senderName && !mine ? <span className="mb-1 block text-xs font-semibold text-amber">{message.senderName}</span> : null}
        {quoted ? (
          <span className="mb-2 block rounded-lg border-l-2 border-amber bg-ink/40 px-2 py-1 text-xs text-bone-dim">
            {previewText(quoted)}
          </span>
        ) : null}
        {message.kind === "image" && message.mediaUrl ? (
          <img
            src={message.mediaUrl}
            alt={message.body || "Imagen"}
            className="mb-1 max-h-64 w-full rounded-lg object-cover"
            onClick={(event) => {
              event.stopPropagation();
              onZoom(message.mediaUrl!);
            }}
          />
        ) : null}
        {message.kind === "voice" ? <VoiceNote message={message} /> : null}
        {message.kind === "file" ? (
          <span className="mb-1 flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            {message.mediaName || message.body}
          </span>
        ) : null}
        {message.kind === "call" ? (
          <span className="mb-1 flex items-center gap-2 text-sm">
            <Phone className="size-4" aria-hidden="true" />
            {previewText(message)}
          </span>
        ) : null}
        {message.kind === "text" ? <span className="block text-sm text-pretty whitespace-pre-wrap">{message.body}</span> : null}
        <span className="mt-1 flex items-center justify-end gap-1 text-xs text-bone-dim tabular-nums">
          {clock(message.createdAt)}
          {mine && message.kind !== "call" ? (
            message.status === "read" ? <CheckCheck className="size-3.5 text-amber" /> : message.status === "delivered" ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />
          ) : null}
        </span>
      </div>
    </div>
  );
}

function VoiceNote({ message }: { message: Message }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = useRef<number[]>([]);
  if (!bars.current.length) {
    let seed = 0;
    for (const char of message.id) seed += char.charCodeAt(0);
    bars.current = Array.from({ length: 18 }, (_, index) => 30 + Math.round(Math.abs(Math.sin(seed + index)) * 70));
  }

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    if (!message.mediaUrl) return;
    unlockAudio();
    if (!audio.current) {
      const node = new Audio(message.mediaUrl);
      node.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      node.ontimeupdate = () => {
        if (node.duration) setProgress(node.currentTime / node.duration);
      };
      audio.current = node;
    }
    if (playing) {
      audio.current.pause();
      setPlaying(false);
      return;
    }
    void audio.current.play();
    setPlaying(true);
  }

  return (
    <span className="flex items-center gap-3">
      <span
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pausar nota" : "Reproducir nota"}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter") toggle(event as unknown as MouseEvent);
        }}
        className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-amber"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </span>
      <span className="flex h-8 items-end gap-0.5">
        {bars.current.map((height, index) => (
          <span
            key={index}
            className={cn("w-0.5 rounded-full", index / bars.current.length < progress ? "bg-amber" : "bg-bone-dim")}
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
      <span className="text-xs tabular-nums">{formatDuration(message.durationMs ?? 0)}</span>
    </span>
  );
}
