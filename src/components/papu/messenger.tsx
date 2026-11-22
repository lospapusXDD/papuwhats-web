import { useEffect, type ReactNode } from "react";
import { MessageCircle, Phone, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { unreadCount } from "@/lib/papu/format";
import { usePapu } from "@/lib/papu/store";
import type { AppView } from "@/lib/papu/types";
import { Mark } from "@/components/papu/logo";
import { ChatList } from "@/components/papu/chat-list";
import { Thread } from "@/components/papu/thread";
import { Calls, InfoDrawer, Settings as SettingsView, Updates } from "@/components/papu/panels";
import { CallOverlay } from "@/components/papu/call-overlay";

const nav: { id: AppView; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "updates", label: "Novedades", icon: Sparkles },
  { id: "calls", label: "Llamadas", icon: Phone },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export function Messenger() {
  const view = usePapu((s) => s.view);
  const activeChatId = usePapu((s) => s.activeChatId);
  const infoOpen = usePapu((s) => s.infoOpen);
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const data = usePapu((s) => (sessionUserId ? s.data[sessionUserId] : undefined));
  const setView = usePapu((s) => s.setView);
  const unread = (data?.chats ?? []).reduce((sum, chat) => sum + unreadCount(chat), 0);
  const missed = (data?.calls ?? []).filter((call) => call.result === "missed").length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const state = usePapu.getState();
      if (state.call) state.endCall();
      else if (state.infoOpen) state.setInfo(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const state = usePapu.getState();
    if (!wide || state.activeChatId || state.view !== "chats") return;
    const id = state.sessionUserId;
    const chats = id ? state.data[id]?.chats : undefined;
    const first = chats?.find((chat) => chat.pinned) ?? chats?.[0];
    if (first) state.openChat(first.id);
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-ink text-bone">
      <div className="app-glow" aria-hidden="true" />
      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-20 shrink-0 flex-col items-center gap-2 border-r border-line bg-panel py-3 md:flex">
          <Mark className="mb-2 size-10" />
          {nav.map((item) => (
            <RailButton
              key={item.id}
              label={item.label}
              active={view === item.id}
              badge={item.id === "chats" ? unread : item.id === "calls" ? missed : 0}
              onClick={() => setView(item.id)}
            >
              <item.icon className="size-5" />
            </RailButton>
          ))}
        </aside>
        <section
          className={cn(
            "min-h-0 min-w-0 flex-col",
            view === "chats" ? "md:w-96 md:shrink-0 md:border-r md:border-line" : "flex-1",
            view === "chats" && activeChatId ? "hidden md:flex" : "flex",
          )}
        >
          {view === "chats" ? <ChatList /> : null}
          {view === "updates" ? <Updates /> : null}
          {view === "calls" ? <Calls /> : null}
          {view === "settings" ? <SettingsView /> : null}
        </section>
        {view === "chats" ? (
          <section className={cn("min-h-0 min-w-0 flex-1 flex-col", activeChatId ? "flex" : "hidden md:flex")}>
            <Thread />
          </section>
        ) : null}
        {infoOpen && view === "chats" && activeChatId ? <InfoDrawer /> : null}
      </div>
      <nav className={cn("safe-bottom grid grid-cols-4 border-t border-line bg-panel md:hidden", view === "chats" && activeChatId && "hidden")}>
        {nav.map((item) => {
          const badge = item.id === "chats" ? unread : item.id === "calls" ? missed : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs", view === item.id ? "text-amber" : "text-mute")}
            >
              <span className="relative">
                <item.icon className="size-5" aria-hidden="true" />
                {badge > 0 ? <span className="absolute -top-1 -right-2 size-2 rounded-full bg-amber" /> : null}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <CallOverlay />
    </div>
  );
}

function RailButton({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  badge: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative inline-flex size-12 items-center justify-center rounded-2xl transition duration-150 active:scale-[0.96]",
        active ? "bg-ink text-amber" : "text-bone-dim hover:bg-ink hover:text-bone",
      )}
    >
      {children}
      {badge > 0 ? (
        <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-xs font-semibold text-ink tabular-nums">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
