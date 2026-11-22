import { useEffect, useState } from "react";
import { Bell, BellOff, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus, ShieldCheck, Video, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration, listTime } from "@/lib/papu/format";
import { STORIES } from "@/lib/papu/seed";
import { usePapu } from "@/lib/papu/store";
import type { Story, Tone } from "@/lib/papu/types";
import { Avatar } from "@/components/papu/avatar";

function useSession() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const account = usePapu((s) => s.accounts.find((item) => item.id === sessionUserId));
  return { sessionUserId, data, account };
}

export function Updates() {
  const { account, data } = useSession();
  const setMyStatus = usePapu((s) => s.setMyStatus);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const mine: Story | null = data?.myStatus
    ? { id: "mine", name: account?.name || "Tú", tone: "amber", text: data.myStatus.text, minutesAgo: Math.max(1, Math.round((Date.now() - data.myStatus.at) / 60000)) }
    : null;
  const stories = mine ? [mine, ...STORIES] : STORIES;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <header className="px-5 pt-5 pb-3">
        <h1 className="font-display text-3xl">Novedades</h1>
        <p className="mt-1 text-sm text-mute">Estados de ejemplo. El tuyo se guarda en este navegador.</p>
      </header>
      <div className="flex gap-4 overflow-x-auto px-5 pb-4">
        <button type="button" className="w-20 shrink-0 text-center" onClick={() => setDraft(data?.myStatus?.text ?? "")}>
          <span className="mx-auto flex size-16 items-center justify-center rounded-full border border-dashed border-amber text-amber">
            <Plus className="size-6" aria-hidden="true" />
          </span>
          <span className="mt-2 block text-xs text-bone-dim">Tu estado</span>
        </button>
        {stories.map((story, index) => (
          <button key={story.id} type="button" className="w-20 shrink-0 text-center" onClick={() => setOpen(index)}>
            <span className="mx-auto block rounded-full ring-2 ring-amber ring-offset-2 ring-offset-panel">
              <Avatar name={story.name} tone={story.tone} size="lg" className="mx-auto" />
            </span>
            <span className="mt-2 block truncate text-xs text-bone-dim">{story.id === "mine" ? "Tú" : story.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <form
        className="mx-5 mb-4 rounded-2xl border border-line bg-ink p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          setMyStatus(draft);
          setDraft("");
        }}
      >
        <label className="block text-sm text-bone-dim" htmlFor="status">
          Publicar un estado
        </label>
        <textarea
          id="status"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={140}
          rows={2}
          placeholder="Qué estás haciendo"
          className="mt-2 w-full resize-none bg-transparent text-base text-bone outline-none placeholder:text-mute"
        />
        <button type="submit" className="mt-2 h-10 rounded-full bg-amber px-4 text-sm font-semibold text-ink active:scale-[0.96]">
          Publicar
        </button>
      </form>
      <ul className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {stories.map((story) => (
          <li key={story.id} className="border-b border-line py-4">
            <p className="font-semibold">{story.name}</p>
            <p className="mt-1 text-sm text-pretty text-bone-dim">{story.text}</p>
            <p className="mt-2 text-xs text-mute">hace {story.minutesAgo} min</p>
          </li>
        ))}
      </ul>
      {open != null ? <StoryView stories={stories} index={open} onClose={() => setOpen(null)} onIndex={setOpen} /> : null}
    </div>
  );
}

function StoryView({
  stories,
  index,
  onClose,
  onIndex,
}: {
  stories: Story[];
  index: number;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const story = stories[index];
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setTimeout(() => {
      if (index + 1 < stories.length) onIndex(index + 1);
      else onClose();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [index, onClose, onIndex, stories.length]);

  if (!story) return null;
  const wash: Record<Tone, string> = {
    amber: "bg-amber text-ink",
    bone: "bg-bone text-ink",
    moss: "bg-moss text-bone",
    clay: "bg-clay text-bone",
  };

  return (
    <div className={cn("fixed inset-0 z-40 flex flex-col px-5 py-6", wash[story.tone])}>
      <div className="flex gap-1">
        {stories.map((item, itemIndex) => (
          <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/30">
            <span className={cn("block h-full bg-ink", itemIndex < index && "w-full", itemIndex === index && "story-fill w-full")} />
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="font-semibold">{story.name}</p>
        <button type="button" aria-label="Cerrar estado" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-full">
          <X className="size-5" />
        </button>
      </div>
      <button
        type="button"
        className="flex flex-1 items-center text-left"
        onClick={(event) => {
          const next = event.clientX > window.innerWidth / 2;
          if (next) {
            if (index + 1 < stories.length) onIndex(index + 1);
            else onClose();
          } else if (index > 0) onIndex(index - 1);
        }}
      >
        <span className="font-display text-4xl leading-tight text-balance">{story.text}</span>
      </button>
    </div>
  );
}

export function Calls() {
  const { data } = useSession();
  const startOutgoing = usePapu((s) => s.startOutgoing);
  const records = data?.calls ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <header className="px-5 pt-5 pb-3">
        <h1 className="font-display text-3xl">Llamadas</h1>
        <p className="mt-1 text-sm text-mute">Historial de ejemplo. Toca una para devolverla.</p>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {records.length === 0 ? <li className="px-5 py-8 text-sm text-mute">Todavía no hay llamadas.</li> : null}
        {records.map((record) => {
          const missed = record.result === "missed";
          const Icon = missed ? PhoneMissed : record.direction === "in" ? PhoneIncoming : PhoneOutgoing;
          return (
            <li key={record.id} className="flex items-center gap-3 border-b border-line px-5 py-3">
              <Avatar name={record.title} tone={record.tone} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", missed && "text-clay-bright")}>{record.title}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-mute">
                  <Icon className="size-4" aria-hidden="true" />
                  {record.kind === "video" ? "Video" : "Voz"}
                  {record.durationMs ? ` · ${formatDuration(record.durationMs)}` : ""}
                  {" · "}
                  {listTime(record.at)}
                </p>
              </div>
              <button
                type="button"
                aria-label={record.kind === "video" ? "Videollamar" : "Llamar"}
                className="inline-flex size-11 items-center justify-center rounded-full text-amber"
                onClick={() => startOutgoing(record.chatId, record.kind)}
              >
                {record.kind === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Settings() {
  const { account, data } = useSession();
  const updateProfile = usePapu((s) => s.updateProfile);
  const toggleSound = usePapu((s) => s.toggleSound);
  const resetDemo = usePapu((s) => s.resetDemo);
  const logout = usePapu((s) => s.logout);
  const [name, setName] = useState(account?.name ?? "");
  const [about, setAbout] = useState(data?.about ?? "");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setName(account?.name ?? "");
    setAbout(data?.about ?? "");
  }, [account?.name, data?.about]);

  return (
    <div className="h-full overflow-y-auto bg-panel">
      <header className="px-5 pt-5 pb-2">
        <h1 className="font-display text-3xl">Ajustes</h1>
      </header>
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 py-4">
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-ink p-4">
          <Avatar name={name || "Tú"} tone="amber" size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{account?.name}</p>
            <p className="truncate text-sm text-mute">{account?.email}</p>
          </div>
        </div>
        <form
          className="rounded-3xl border border-line bg-ink p-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile(name, about);
          }}
        >
          <label className="block text-sm text-bone-dim" htmlFor="profile-name">
            Nombre
          </label>
          <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-panel px-4 text-base outline-none focus:border-amber" />
          <label className="mt-4 block text-sm text-bone-dim" htmlFor="profile-about">
            Info
          </label>
          <input id="profile-about" value={about} onChange={(event) => setAbout(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-panel px-4 text-base outline-none focus:border-amber" />
          <button type="submit" className="mt-4 h-11 rounded-full bg-amber px-5 text-sm font-semibold text-ink active:scale-[0.96]">
            Guardar
          </button>
        </form>
        <div className="flex items-center justify-between rounded-3xl border border-line bg-ink p-4">
          <div className="flex items-center gap-3">
            {data?.sound ? <Bell className="size-5 text-amber" /> : <BellOff className="size-5 text-mute" />}
            <div>
              <p className="font-semibold">Sonidos</p>
              <p className="text-sm text-mute">Envío, recepción y timbre</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data?.sound !== false}
            aria-label="Sonidos"
            onClick={toggleSound}
            className={cn("flex h-7 w-12 items-center rounded-full p-1 transition-colors", data?.sound !== false ? "bg-amber" : "bg-line")}
          >
            <span className={cn("size-5 rounded-full bg-bone transition-transform duration-150", data?.sound !== false && "translate-x-5")} />
          </button>
        </div>
        <div className="flex items-start gap-3 rounded-3xl border border-line bg-ink p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <div>
            <p className="font-semibold">Verificación en dos pasos</p>
            <p className="mt-1 text-sm text-pretty text-bone-dim">Activa en este acceso de ejemplo. El código se muestra en pantalla porque no hay un correo real detrás.</p>
          </div>
        </div>
        <button
          type="button"
          className="h-12 rounded-full border border-line text-sm font-semibold"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            resetDemo();
            setConfirmReset(false);
          }}
        >
          {confirmReset ? "Confirmar restauración" : "Restaurar conversaciones de ejemplo"}
        </button>
        <button type="button" className="h-12 rounded-full bg-clay text-sm font-semibold text-bone active:scale-[0.96]" onClick={logout}>
          Cerrar sesión
        </button>
        <p className="pb-6 text-center text-xs text-mute">PapuWhats · demostración local</p>
      </div>
    </div>
  );
}

export function InfoDrawer() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const activeChatId = usePapu((s) => s.activeChatId);
  const setInfo = usePapu((s) => s.setInfo);
  const toggleMute = usePapu((s) => s.toggleMute);
  const chat = data?.chats.find((item) => item.id === activeChatId);
  if (!chat) return null;
  const images = chat.messages.filter((message) => message.kind === "image" && message.mediaUrl);
  const files = chat.messages.filter((message) => message.kind === "file");

  return (
    <aside className="absolute inset-0 z-20 flex flex-col overflow-y-auto border-line bg-panel xl:static xl:z-auto xl:w-80 xl:shrink-0 xl:border-l">
      <header className="flex items-center justify-between px-3 py-2">
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full" aria-label="Cerrar datos" onClick={() => setInfo(false)}>
          <X className="size-5" />
        </button>
        <p className="font-semibold">Datos</p>
        <span className="size-11" />
      </header>
      <div className="flex flex-col items-center px-6 pb-6">
        <Avatar name={chat.title} tone={chat.tone} size="xl" online={chat.presence === "online"} />
        <h2 className="mt-4 text-center font-display text-3xl text-balance">{chat.title}</h2>
        <p className="mt-2 text-center text-sm text-bone-dim">{chat.about}</p>
      </div>
      {chat.kind === "group" ? (
        <ul className="border-t border-line px-5 py-3">
          {chat.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2">
              <Avatar name={member.name} tone={member.tone} size="sm" />
              <span>
                <span className="block text-sm font-semibold">{member.name}</span>
                <span className="block text-xs text-mute">{member.about}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="border-t border-line px-5 py-4">
        <button type="button" className="text-sm font-semibold text-amber" onClick={() => toggleMute(chat.id)}>
          {chat.muted ? "Activar notificaciones" : "Silenciar notificaciones"}
        </button>
      </div>
      {images.length ? (
        <div className="border-t border-line px-5 py-4">
          <p className="text-sm font-semibold">Imágenes</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {images.map((message) => (
              <img key={message.id} src={message.mediaUrl} alt={message.body || "Imagen"} className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      ) : null}
      {files.length ? (
        <ul className="border-t border-line px-5 py-4">
          {files.map((message) => (
            <li key={message.id} className="py-1 text-sm text-bone-dim">
              {message.mediaName || message.body}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
