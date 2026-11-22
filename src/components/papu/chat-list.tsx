import { useMemo, useState } from "react";
import { BellOff, Check, CheckCheck, Pin, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { lastMessage, listTime, previewText, unreadCount } from "@/lib/papu/format";
import { usePapu } from "@/lib/papu/store";
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
          <p className="px-5 py-10 text-sm text-mute">Nada coincide con esa búsqueda.</p>
        ) : (
          chats.map((chat, index) => (
            <ChatRow key={chat.id} chat={chat} index={index} active={chat.id === activeChatId} onOpen={() => openChat(chat.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function ChatRow({ chat, index, active, onOpen }: { chat: Chat; index: number; active: boolean; onOpen: () => void }) {
  const last = lastMessage(chat);
  const unread = unreadCount(chat);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "row-in flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-150",
        active ? "bg-ink" : "hover:bg-panel-2",
      )}
      style={{ animationDelay: `${index * 45}ms` }}
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
