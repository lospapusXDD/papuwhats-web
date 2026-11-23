import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Check, Copy, Download, Laptop, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus, ShieldCheck, Smartphone, Terminal, Video, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration, listTime } from "@/lib/papu/format";
import { STORIES } from "@/lib/papu/seed";
import { usePapu, nickToTone } from "@/lib/papu/store";
import { PapuApi } from "@/lib/papu/api";
import { notifyUser, requestNotificationPermission } from "@/lib/papu/notify";
import type { Story, Tone } from "@/lib/papu/types";
import { Avatar } from "@/components/papu/avatar";

function useSession() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const account = usePapu((s) => s.accounts.find((item) => item.id === sessionUserId));
  return { sessionUserId, data, account };
}

export function Updates() {
  const { account, data, sessionUserId } = useSession();
  const setMyStatus = usePapu((s) => s.setMyStatus);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [apiStatuses, setApiStatuses] = useState<Array<{ id: number | string; nick: string; text: string; created_at: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const currentNick = (sessionUserId && sessionUserId !== "demo") ? sessionUserId : (typeof window !== "undefined" ? localStorage.getItem("papuwhats_nick") : null);

  useEffect(() => {
    const fetchStatuses = () => {
      void PapuApi.getStatuses().then((res) => {
        if (Array.isArray(res)) {
          setApiStatuses(res);
        }
      });
    };
    fetchStatuses();
    const timer = window.setInterval(fetchStatuses, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const stories: Story[] = useMemo(() => {
    if (!apiStatuses.length) {
      const mine: Story | null = data?.myStatus
        ? { id: "mine", name: account?.name || "Tú", tone: "amber", text: data.myStatus.text, minutesAgo: Math.max(1, Math.round((Date.now() - data.myStatus.at) / 60000)) }
        : null;
      return mine ? [mine, ...STORIES] : STORIES;
    }

    return apiStatuses.map((s) => ({
      id: String(s.id),
      name: (currentNick && s.nick.toLowerCase() === currentNick.toLowerCase()) ? "Tú" : s.nick,
      tone: nickToTone(s.nick),
      text: s.text,
      minutesAgo: Math.max(1, Math.round((Date.now() - new Date(s.created_at).getTime()) / 60000)),
    }));
  }, [apiStatuses, data?.myStatus, account?.name, currentNick]);

  async function handlePublish(event: React.FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || submitting) return;
    setSubmitting(true);
    setMyStatus(clean);

    if (PapuApi.getToken()) {
      const res = await PapuApi.postStatus(clean);
      if (res.ok && res.status) {
        setApiStatuses((prev) => [res.status, ...prev.filter((item) => String(item.id) !== String(res.status.id))]);
      } else if (!res.ok) {
        alert(res.error || "No se pudo publicar el estado");
      }
    }
    setDraft("");
    setSubmitting(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <header className="px-5 pt-5 pb-3">
        <h1 className="font-display text-3xl">Novedades</h1>
        <p className="mt-1 text-sm text-mute">Estados de tus contactos de PapusBank (últimas 24 horas).</p>
      </header>
      <div className="flex gap-4 overflow-x-auto px-5 pb-4">
        <button type="button" className="w-20 shrink-0 text-center cursor-pointer" onClick={() => setDraft(data?.myStatus?.text ?? "")}>
          <span className="mx-auto flex size-16 items-center justify-center rounded-full border border-dashed border-amber text-amber hover:bg-amber/10 transition">
            <Plus className="size-6" aria-hidden="true" />
          </span>
          <span className="mt-2 block text-xs text-bone-dim">Tu estado</span>
        </button>
        {stories.map((story, index) => (
          <button key={story.id} type="button" className="w-20 shrink-0 text-center cursor-pointer" onClick={() => setOpen(index)}>
            <span className="mx-auto block rounded-full ring-2 ring-amber ring-offset-2 ring-offset-panel">
              <Avatar name={story.name} tone={story.tone} size="lg" className="mx-auto" />
            </span>
            <span className="mt-2 block truncate text-xs text-bone-dim">{story.name === "Tú" ? "Tú" : story.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <form
        className="mx-5 mb-4 rounded-2xl border border-line bg-ink p-4"
        onSubmit={(event) => void handlePublish(event)}
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
          placeholder="¿Qué estás pensando?"
          className="mt-2 w-full resize-none bg-transparent text-base text-bone outline-none placeholder:text-mute"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="mt-2 h-10 rounded-full bg-amber px-4 text-sm font-semibold text-ink active:scale-[0.96] disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Publicando…" : "Publicar"}
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-mute">
            <p className="text-sm font-medium text-bone-dim">Aún no hay estados recientes</p>
            <p className="mt-1 text-xs">Publica uno arriba para que tus contactos de PapusBank puedan verlo.</p>
          </div>
        ) : (
          <ul>
            {stories.map((story) => (
              <li key={story.id} className="border-b border-line py-4">
                <p className="font-semibold">{story.name}</p>
                <p className="mt-1 text-sm text-pretty text-bone-dim">{story.text}</p>
                <p className="mt-2 text-xs text-mute">hace {story.minutesAgo} min</p>
              </li>
            ))}
          </ul>
        )}
      </div>
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
        <p className="mt-1 text-sm text-mute">Registro de llamadas recientes. Toca una para devolverla.</p>
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

function InstallSection() {
  const [selectedOs, setSelectedOs] = useState<"linux" | "windows" | "android" | "mac">("linux");
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const curlLinux = "curl -fsSL https://raw.githubusercontent.com/lospapusXDD/papuwhats-web/main/install.sh | bash";
  const psWindows = "irm https://raw.githubusercontent.com/lospapusXDD/papuwhats-web/main/install.ps1 | iex";

  const handleCopy = (cmd: string) => {
    void navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePwaInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallPrompt(null);
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-ink p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-amber/20 text-amber">
          <Terminal className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold text-bone">Instalar PapuWhats</h2>
          <p className="text-xs text-mute">Comando curl de 1 clic para escritorio o app móvil</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 rounded-2xl bg-panel p-1">
        {(["linux", "windows", "android", "mac"] as const).map((os) => (
          <button
            key={os}
            type="button"
            onClick={() => {
              setSelectedOs(os);
              setCopied(false);
            }}
            className={cn(
              "flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize transition-colors",
              selectedOs === os ? "bg-amber text-ink" : "text-mute hover:text-bone"
            )}
          >
            {os === "mac" ? "macOS" : os}
          </button>
        ))}
      </div>

      {selectedOs === "linux" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-bone-dim">Pega este comando en tu terminal para instalar y crear el acceso directo:</p>
          <div className="relative flex items-center rounded-xl border border-line bg-panel p-2.5 font-mono text-xs text-amber-dim">
            <span className="truncate pr-8 select-all">{curlLinux}</span>
            <button
              type="button"
              onClick={() => handleCopy(curlLinux)}
              aria-label="Copiar comando"
              className="absolute right-2 top-2 p-1 text-mute hover:text-bone"
            >
              {copied ? <Check className="size-4 text-moss" /> : <Copy className="size-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleCopy(curlLinux)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-amber px-3 text-xs font-semibold text-ink active:scale-[0.98]"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "¡Comando copiado!" : "Copiar comando curl"}
            </button>
            <a
              href="https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0.AppImage"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-bone hover:border-amber"
            >
              <Download className="size-3.5" />
              AppImage
            </a>
          </div>
        </div>
      )}

      {selectedOs === "windows" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-bone-dim">Ejecuta en PowerShell para descargar, extraer e iniciar en 1 clic:</p>
          <div className="relative flex items-center rounded-xl border border-line bg-panel p-2.5 font-mono text-xs text-amber-dim">
            <span className="truncate pr-8 select-all">{psWindows}</span>
            <button
              type="button"
              onClick={() => handleCopy(psWindows)}
              aria-label="Copiar comando"
              className="absolute right-2 top-2 p-1 text-mute hover:text-bone"
            >
              {copied ? <Check className="size-4 text-moss" /> : <Copy className="size-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleCopy(psWindows)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-amber px-3 text-xs font-semibold text-ink active:scale-[0.98]"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "¡Comando copiado!" : "Copiar comando PowerShell"}
            </button>
            <a
              href="https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0-win.zip"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-bone hover:border-amber"
            >
              <Download className="size-3.5" />
              ZIP (exe)
            </a>
          </div>
        </div>
      )}

      {selectedOs === "android" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-bone-dim">Instala PapuWhats como aplicación nativa en tu móvil Android:</p>
          {installPrompt ? (
            <button
              type="button"
              onClick={handlePwaInstall}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber text-xs font-semibold text-ink active:scale-[0.98]"
            >
              <Smartphone className="size-4" />
              Instalar PapuWhats en Android
            </button>
          ) : installed ? (
            <div className="rounded-xl border border-moss/40 bg-moss/10 p-3 text-xs text-moss">
              ✓ ¡PapuWhats ya está instalada en tu dispositivo!
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-panel p-3 text-xs text-mute space-y-1.5">
              <p className="font-semibold text-bone">Instrucciones para Chrome / Brave / Edge:</p>
              <p>1. Toca en el menú de 3 puntos (⋮) en la esquina superior derecha.</p>
              <p>
                2. Selecciona <span className="font-semibold text-amber">"Instalar aplicación"</span> o{" "}
                <span className="font-semibold text-amber">"Añadir a pantalla de inicio"</span>.
              </p>
              <p>3. ¡Listo! Se creará el acceso directo con icono oficial.</p>
            </div>
          )}
        </div>
      )}

      {selectedOs === "mac" && (
        <div className="mt-3 space-y-3 text-xs text-mute">
          <p className="text-bone-dim">Para macOS puedes usar la versión web con todas las funciones o compilar con Electron:</p>
          <div className="rounded-xl border border-line bg-panel p-2.5 font-mono text-amber-dim">
            git clone https://github.com/lospapusXDD/papuwhats-web.git
            <br />
            cd papuwhats-web && npm install && npm run electron:build:mac
          </div>
          <a
            href="https://github.com/lospapusXDD/papuwhats-web/releases/tag/v1.0.0"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-line text-xs font-semibold text-bone hover:border-amber"
          >
            <Download className="size-3.5" />
            Ver Releases en GitHub
          </a>
        </div>
      )}
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
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-ink p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="size-5 shrink-0 text-amber" />
              <div>
                <p className="font-semibold">Notificaciones en segundo plano</p>
                <p className="text-sm text-mute">Recibe llamadas y mensajes al minimizar o bloquear pantalla</p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full bg-amber/20 px-3.5 py-1.5 text-xs font-semibold text-amber hover:bg-amber hover:text-ink transition active:scale-95 cursor-pointer"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                if (granted) {
                  void notifyUser("🔔 PapuWhats", {
                    body: "¡Las notificaciones en segundo plano están activas y funcionando!",
                  });
                } else {
                  alert("Permiso denegado. Permite las notificaciones en el icono de candado o en los ajustes del navegador.");
                }
              }}
            >
              Probar aviso
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-3xl border border-line bg-ink p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <div>
            <p className="font-semibold">Verificación en dos pasos (2FA)</p>
            <p className="mt-1 text-sm text-pretty text-bone-dim">Protegida mediante código de autenticación y vinculada a tu cuenta de PapusBank.</p>
          </div>
        </div>

        <InstallSection />

        <button type="button" className="h-12 rounded-full bg-clay text-sm font-semibold text-bone active:scale-[0.96]" onClick={logout}>
          Cerrar sesión
        </button>
        <p className="pb-6 text-center text-xs text-mute">PapuWhats v1.0.0 · PapusBank Official Messenger</p>
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
