import { useEffect, useMemo, useState } from "react";
import { BellOff, Check, CheckCheck, Loader2, MessageSquare, Pin, Search, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { lastMessage, listTime, previewText, unreadCount } from "@/lib/papu/format";
import { usePapu } from "@/lib/papu/store";
import { PapuApi } from "@/lib/papu/api";
import type { Chat } from "@/lib/papu/types";
import { Avatar } from "@/components/papu/avatar";

const chips = [
  { id: "all", label: "Todos" },
  { id: "unread", label: "No leídos" },
  { id: "groups", label: "Grupos" },
] as const;

export function ChatList() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const activeChatId = usePapu((s) => s.activeChatId);
  const openChat = usePapu((s) => s.openChat);
  const account = usePapu((s) => s.accounts.find((item) => item.id === sessionUserId));
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<(typeof chips)[number]["id"]>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const chats = useMemo(() => {
    const list = data?.chats ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((chat) => {
        if (chip === "unread" && unreadCount(chat) === 0) return false;
        if (chip === "groups" && chat.kind !== "group") return false;
        if (!q) return true;
        const blob = `${chat.title} ${chat.messages.map((m) => m.body).join(" ")}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (lastMessage(b)?.createdAt ?? 0) - (lastMessage(a)?.createdAt ?? 0);
      });
  }, [chip, data?.chats, query]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-2xl">Chats</p>
            <p className="text-sm text-mute">{account?.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title="Añadir contacto / Nuevo chat"
            className="inline-flex size-10 items-center justify-center rounded-full bg-amber text-ink transition-transform hover:scale-105 active:scale-95 shadow-md"
          >
            <UserPlus className="size-5" />
          </button>
        </div>
        <label className="mt-4 flex h-11 items-center gap-2 rounded-full border border-line bg-ink px-4">
          <Search className="size-4 text-mute" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            className="h-full w-full bg-transparent text-base text-bone outline-none placeholder:text-mute"
            aria-label="Buscar conversaciones"
          />
        </label>
        <div className="mt-3 flex gap-2">
          {chips.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChip(item.id)}
              className={cn(
                "h-9 rounded-full px-4 text-sm font-semibold transition duration-150 active:scale-[0.96]",
                chip === item.id ? "bg-amber text-ink" : "bg-ink text-bone-dim",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-mute">
            <p className="text-base font-medium text-bone-dim">No hay chats aún</p>
            <p className="mt-1 text-xs">Usa el botón de arriba (+) para añadir contactos o iniciar una conversación.</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber/15 px-4 py-2 text-xs font-semibold text-amber hover:bg-amber/25 transition cursor-pointer"
            >
              <UserPlus className="size-4" />
              Añadir contacto
            </button>
          </div>
        ) : (
          chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} active={chat.id === activeChatId} onOpen={() => openChat(chat.id)} />
          ))
        )}
      </div>

      {modalOpen ? <AddContactModal onClose={() => setModalOpen(false)} onSelect={(nick) => openChat(nick)} /> : null}
    </div>
  );
}

function ChatRow({ chat, active, onOpen }: { chat: Chat; active: boolean; onOpen: () => void }) {
  const last = lastMessage(chat);
  const unread = unreadCount(chat);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-150 cursor-pointer",
        active ? "bg-ink" : "hover:bg-panel-2",
      )}
    >
      <Avatar name={chat.title} tone={chat.tone} online={chat.presence === "online"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("truncate font-semibold", unread ? "text-bone" : "text-bone")}>{chat.title}</span>
          <span className={cn("shrink-0 text-xs tabular-nums", unread ? "text-amber" : "text-mute")}>
            {last ? listTime(last.createdAt) : ""}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          {last?.author === "me" && last.kind !== "call" ? (
            last.status === "read" ? (
              <CheckCheck className="size-4 shrink-0 text-amber" aria-label="Leído" />
            ) : last.status === "delivered" ? (
              <CheckCheck className="size-4 shrink-0 text-mute" aria-label="Entregado" />
            ) : (
              <Check className="size-4 shrink-0 text-mute" aria-label="Enviado" />
            )
          ) : null}
          <span className={cn("truncate text-sm", unread ? "text-bone-dim" : "text-mute")}>{last ? previewText(last) : "Sin mensajes"}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {chat.muted ? <BellOff className="size-3.5 text-mute" aria-label="Silenciado" /> : null}
            {chat.pinned ? <Pin className="size-3.5 text-mute" aria-label="Fijado" /> : null}
            {unread > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-xs font-semibold text-ink tabular-nums">
                {unread}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}

function AddContactModal({ onClose, onSelect }: { onClose: () => void; onSelect: (nick: string) => void }) {
  const [targetNick, setTargetNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [friendsData, setFriendsData] = useState<{ friends: any[]; incoming: any[] }>({ friends: [], incoming: [] });
  const syncFromApi = usePapu((s) => s.syncFromApi);

  async function loadFriends() {
    const res = await PapuApi.getFriends();
    setFriendsData({ friends: res.friends || [], incoming: res.incoming || [] });
  }

  useEffect(() => {
    void loadFriends();
  }, []);

  async function handleOpenDirectChat() {
    const clean = targetNick.trim();
    if (!clean) return;
    setLoading(true);
    setFeedback(null);
    try {
      onSelect(clean);
      void PapuApi.sendFriendRequest(clean);
      void syncFromApi();
      onClose();
    } catch (err: any) {
      setFeedback({ text: err?.message || "Error al abrir chat", error: true });
      setLoading(false);
    }
  }

  async function handleSendRequest() {
    const clean = targetNick.trim();
    if (!clean) return;
    setLoading(true);
    setFeedback(null);
    const res = await PapuApi.sendFriendRequest(clean);
    setLoading(false);
    if (!res.ok) {
      setFeedback({ text: res.error || "No se pudo enviar la solicitud", error: true });
    } else {
      setFeedback({ text: res.message || `Solicitud enviada a ${clean}` });
      setTargetNick("");
      void loadFriends();
    }
  }

  async function handleAccept(fromNick: string) {
    const res = await PapuApi.acceptFriendRequest(fromNick);
    if (res.ok) {
      void loadFriends();
      void syncFromApi();
      onSelect(fromNick);
      onClose();
    }
  }

  async function handleReject(fromNick: string) {
    const res = await PapuApi.rejectFriendRequest(fromNick);
    if (res.ok) {
      void loadFriends();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-amber" />
            <h2 className="font-display text-xl">Añadir Contacto / Chat</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-mute hover:bg-panel-2 hover:text-bone cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="nick-input" className="block text-xs font-semibold uppercase tracking-wider text-mute">
            Nick de PapusBank
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="nick-input"
              type="text"
              value={targetNick}
              onChange={(e) => setTargetNick(e.target.value)}
              placeholder="Ej: pepito"
              className="flex-1 rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-bone outline-none focus:border-amber"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleOpenDirectChat();
              }}
            />
            <button
              type="button"
              disabled={loading || !targetNick.trim()}
              onClick={() => void handleOpenDirectChat()}
              className="rounded-2xl bg-amber px-4 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Chatear"}
            </button>
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={loading || !targetNick.trim()}
              onClick={() => void handleSendRequest()}
              className="text-xs text-amber hover:underline disabled:opacity-50 cursor-pointer"
            >
              + Enviar solo solicitud de amistad
            </button>
          </div>

          {feedback ? (
            <p className={cn("mt-2 text-xs", feedback.error ? "text-clay-bright" : "text-amber")}>
              {feedback.text}
            </p>
          ) : null}
        </div>

        {/* Solicitudes de amistad entrantes */}
        {friendsData.incoming.length > 0 ? (
          <div className="mt-5 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber">
              Solicitudes Recibidas ({friendsData.incoming.length})
            </p>
            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
              {friendsData.incoming.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-xl bg-ink p-2.5">
                  <span className="font-medium text-sm text-bone">{req.from_nick}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleAccept(req.from_nick)}
                      title="Aceptar"
                      className="rounded-lg bg-moss px-2.5 py-1 text-xs font-semibold text-bone hover:opacity-90 flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="size-3.5" />
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(req.from_nick)}
                      title="Rechazar"
                      className="rounded-lg bg-clay px-2.5 py-1 text-xs font-semibold text-bone hover:opacity-90 flex items-center gap-1 cursor-pointer"
                    >
                      <UserX className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Amigos ya registrados */}
        {friendsData.friends.length > 0 ? (
          <div className="mt-5 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-mute">
              Mis Amigos ({friendsData.friends.length})
            </p>
            <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
              {friendsData.friends.map((f) => (
                <div key={f.friend_nick} className="flex items-center justify-between rounded-xl p-2 hover:bg-ink">
                  <span className="font-medium text-sm text-bone">{f.friend_nick}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(f.friend_nick);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber/20 px-2.5 py-1 text-xs font-medium text-amber hover:bg-amber/30 cursor-pointer"
                  >
                    <MessageSquare className="size-3.5" />
                    Abrir Chat
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
