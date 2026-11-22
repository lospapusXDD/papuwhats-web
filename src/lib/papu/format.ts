import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import type { Chat, Message } from "@/lib/papu/types";

export function listTime(ts: number) {
  if (isToday(ts)) return format(ts, "HH:mm");
  if (isYesterday(ts)) return "Ayer";
  return format(ts, "d MMM", { locale: es });
}

export function dayLabel(ts: number) {
  if (isToday(ts)) return "Hoy";
  if (isYesterday(ts)) return "Ayer";
  return format(ts, "d 'de' MMMM", { locale: es });
}

export function clock(ts: number) {
  return format(ts, "HH:mm");
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function previewText(message: Message) {
  if (message.kind === "image") return "Imagen";
  if (message.kind === "voice") return "Nota de voz";
  if (message.kind === "file") return message.mediaName || "Archivo";
  if (message.kind === "call") {
    if (message.callResult === "missed") return "Llamada perdida";
    if (message.callResult === "declined") return "Llamada rechazada";
    if (message.callResult === "canceled") return "Llamada cancelada";
    const kind = message.callKind === "video" ? "Videollamada" : "Llamada de voz";
    return message.durationMs ? `${kind} · ${formatDuration(message.durationMs)}` : kind;
  }
  return message.body;
}

export function lastMessage(chat: Chat) {
  return chat.messages[chat.messages.length - 1];
}

export function unreadCount(chat: Chat) {
  return chat.messages.filter((m) => m.author === "them" && m.createdAt > chat.lastReadAt).length;
}

export function presenceLabel(chat: Chat) {
  if (chat.kind === "group") {
    return chat.members.map((m) => m.name.split(" ")[0]).join(", ");
  }
  return chat.presence === "online" ? "en línea" : "últ. vez recientemente";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
