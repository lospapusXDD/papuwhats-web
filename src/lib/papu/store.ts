import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { playConnect, playReceive, playSend, startRing, stopRing } from "@/lib/papu/audio";
import { craftReply } from "@/lib/papu/replies";
import { DEMO_EMAIL, DEMO_ID, DEMO_PASSWORD, demoAccount, demoData, freshData } from "@/lib/papu/seed";
import { PapuApi, type ApiMessage } from "@/lib/papu/api";
import { initCallPeer, cleanupCall, setLocalAudioMuted, setLocalCameraEnabled } from "@/lib/papu/webrtc";
import type { Account, AppView, Chat, LiveCall, Message, PendingAuth, Tone, UserData } from "@/lib/papu/types";

type PapuState = {
  accounts: Account[];
  sessionUserId: string | null;
  pending: PendingAuth | null;
  data: Record<string, UserData>;
  view: AppView;
  activeChatId: string | null;
  infoOpen: boolean;
  replyId: string | null;
  typingId: string | null;
  call: LiveCall | null;
  beginAuth: (input: {
    mode: "login" | "register";
    name: string;
    email: string;
    password: string;
    confirm?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  resendCode: () => void;
  cancelAuth: () => void;
  completeAuth: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  setView: (view: AppView) => void;
  openChat: (id: string) => void;
  closeChat: () => void;
  setInfo: (open: boolean) => void;
  setReply: (id: string | null) => void;
  togglePin: (id: string) => void;
  toggleMute: (id: string) => void;
  toggleSound: () => void;
  updateProfile: (name: string, about: string) => void;
  setMyStatus: (text: string) => void;
  sendText: (body: string) => void;
  sendMedia: (input: { kind: "image" | "file" | "voice"; body: string; mediaUrl?: string; mediaName?: string; durationMs?: number }) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  startOutgoing: (chatId: string, kind: "voice" | "video") => void;
  startIncoming: (chatId: string) => void;
  acceptCall: () => void;
  endCall: () => void;
  setCallMuted: (muted: boolean) => void;
  setCamera: (on: boolean) => void;
  resetDemo: () => void;
  syncFromApi: () => Promise<void>;
};

const memory = new Map<string, string>();

const safeStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return memory.get(name) ?? null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") {
      memory.set(name, value);
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") {
      memory.delete(name);
      return;
    }
    localStorage.removeItem(name);
  },
};

export function nickToTone(nick: string): Tone {
  const tones: Tone[] = ["amber", "clay", "moss", "bone"];
  let hash = 0;
  for (let i = 0; i < nick.length; i++) hash = (hash << 5) - hash + nick.charCodeAt(i);
  return tones[Math.abs(hash) % tones.length];
}

export function parseApiMessage(m: ApiMessage, myNick: string): Message {
  let kind: Message["kind"] = "text";
  let body = m.msg || "";
  let mediaUrl: string | undefined = undefined;
  let mediaName: string | undefined = undefined;
  let durationMs: number | undefined = undefined;
  let callKind: Message["callKind"] = undefined;
  let callResult: Message["callResult"] = undefined;
  let replyId: string | undefined = undefined;

  const raw = (m.msg || "").trim();
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.kind) {
        kind = parsed.kind;
        body = parsed.body || (kind === "voice" ? "Nota de voz" : kind === "image" ? "Imagen" : "");
        mediaUrl = parsed.mediaUrl;
        mediaName = parsed.mediaName;
        durationMs = parsed.durationMs;
        callKind = parsed.callKind;
        callResult = parsed.callResult;
        replyId = parsed.replyId;
      }
    } catch {
      // no es JSON válido
    }
  }

  if (kind === "text") {
    if (raw.startsWith("data:audio/") || /\.webm$|\.ogg$|\.mp3$|\.wav$/i.test(raw)) {
      kind = "voice";
      mediaUrl = raw;
      body = "Nota de voz";
    } else if (raw.startsWith("data:image/") || /^https?:\/\/.*\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(raw)) {
      kind = "image";
      mediaUrl = raw;
      body = "Imagen";
    }
  }

  return {
    id: String(m.id),
    author: m.from_nick === myNick ? "me" : "them",
    senderName: m.from_nick,
    kind,
    body,
    mediaUrl,
    mediaName,
    durationMs,
    callKind,
    callResult,
    replyId,
    createdAt: new Date(m.created_at).getTime(),
    status: m.read ? "read" : "delivered",
  };
}

function six() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function uid(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function current(get: () => PapuState) {
  const id = get().sessionUserId;
  if (!id) return null;
  const data = get().data[id];
  if (!data) return null;
  return { id, data };
}

function patchUser(set: (fn: (s: PapuState) => Partial<PapuState>) => void, get: () => PapuState, recipe: (data: UserData) => UserData) {
  const cur = current(get);
  if (!cur) return;
  const next = recipe(cur.data);
  set((s) => ({
    data: {
      ...s.data,
      [cur.id]: next,
    },
  }));
}

function soundOn(get: () => PapuState) {
  return current(get)?.data.sound ?? true;
}

function finishCall(set: (fn: (s: PapuState) => Partial<PapuState>) => void, get: () => PapuState) {
  const call = get().call;
  if (!call) return;
  stopRing();
  const result = call.phase === "active" ? "ended" : call.phase === "incoming" ? "declined" : "canceled";
  const durationMs = call.startedAt ? Math.max(1000, Date.now() - call.startedAt) : 0;
  const cur = current(get);
  const chat = cur?.data.chats.find((c) => c.id === call.chatId);
  if (cur && chat) {
    const at = Date.now();
    const label =
      result === "declined" ? "Llamada rechazada" : result === "canceled" ? "Llamada cancelada" : call.kind === "video" ? "Videollamada" : "Llamada de voz";
    const entry: Message = {
      id: uid("m"),
      author: call.direction === "out" ? "me" : "them",
      kind: "call",
      body: label,
      createdAt: at,
      status: "read",
      callKind: call.kind,
      callResult: result,
      durationMs,
    };
    patchUser(set, get, (data) => ({
      ...data,
      calls: [
        {
          id: uid("call"),
          chatId: chat.id,
          title: chat.title,
          tone: chat.tone,
          kind: call.kind,
          direction: call.direction,
          result,
          at,
          durationMs,
        },
        ...data.calls,
      ],
      chats: data.chats.map((c) => (c.id === chat.id ? { ...c, messages: c.messages.concat(entry) } : c)),
    }));
  }
  set(() => ({ call: null }));
}

export const usePapu = create<PapuState>()(
  persist(
    (set, get) => ({
      accounts: [demoAccount()],
      sessionUserId: null,
      pending: null,
      data: { [DEMO_ID]: demoData() },
      view: "chats",
      activeChatId: null,
      infoOpen: false,
      replyId: null,
      typingId: null,
      call: null,

      beginAuth: async (input) => {
        const cleanIdentifier = input.email.trim();
        const password = input.password;
        const name = input.name.trim();

        if (!cleanIdentifier) return { ok: false, error: "Ingresa tu usuario o correo." };
        if (password.length < 4) return { ok: false, error: "La clave necesita al menos 4 caracteres." };

        // Caso cuenta de demostración local
        if (cleanIdentifier.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
          set({
            pending: {
              mode: input.mode,
              name: DEMO_ID,
              email: DEMO_EMAIL,
              password: DEMO_PASSWORD,
              code: six(),
            },
          });
          return { ok: true };
        }

        // Registro en la base de datos real
        if (input.mode === "register") {
          if (name.length < 2) return { ok: false, error: "El nombre queda muy corto." };
          if (password !== (input.confirm ?? "")) return { ok: false, error: "Las claves no coinciden." };

          const reg = await PapuApi.register(name, password, cleanIdentifier);
          if (!reg.ok) return { ok: false, error: reg.error };
        }

        // Login en la API real de PapusBank
        const loginRes = await PapuApi.login(input.mode === "register" ? name : cleanIdentifier, password);
        if (!loginRes.ok) {
          if (loginRes.twofaRequired) {
            set({
              pending: {
                mode: "login",
                name: cleanIdentifier,
                email: loginRes.email || cleanIdentifier,
                password,
                code: "",
                tempToken: loginRes.tempToken,
              },
            });
            return { ok: true };
          }
          return { ok: false, error: loginRes.error };
        }

        // Login completado exitosamente sin 2FA
        const nick = loginRes.nick;
        const userAccount: Account = {
          id: nick,
          name: nick,
          email: cleanIdentifier.includes("@") ? cleanIdentifier : nick + "@papusbank.app",
          password: "",
          about: "En PapuWhats.",
        };

        const existingData = get().data[nick] || {
          ...freshData(),
          chats: [],
          calls: [],
          about: "En PapuWhats.",
        };

        set((s) => ({
          accounts: s.accounts.some((a) => a.id === nick) ? s.accounts : s.accounts.concat(userAccount),
          data: { ...s.data, [nick]: existingData },
          sessionUserId: nick,
          pending: null,
          view: "chats",
          activeChatId: null,
          infoOpen: false,
        }));

        void get().syncFromApi();
        return { ok: true };
      },

      resendCode: () => {
        const pending = get().pending;
        if (!pending) return;
        set({ pending: { ...pending, code: six() } });
      },

      cancelAuth: () => set({ pending: null }),

      completeAuth: async (code) => {
        const pending = get().pending;
        if (!pending) return { ok: false, error: "No hay una verificación abierta." };

        // Verificación 2FA con API real
        if (pending.tempToken) {
          const res = await PapuApi.confirm2FA(pending.tempToken, code);
          if (!res.ok) return { ok: false, error: res.error };

          const nick = res.nick;
          const userAccount: Account = {
            id: nick,
            name: nick,
            email: pending.email,
            password: "",
            about: "En PapuWhats.",
          };

          const existingData = get().data[nick] || {
            ...freshData(),
            chats: [],
            calls: [],
            about: "En PapuWhats.",
          };

          set((s) => ({
            accounts: s.accounts.some((a) => a.id === nick) ? s.accounts : s.accounts.concat(userAccount),
            data: { ...s.data, [nick]: existingData },
            sessionUserId: nick,
            pending: null,
            view: "chats",
            activeChatId: null,
            infoOpen: false,
          }));

          void get().syncFromApi();
          return { ok: true };
        }

        // Verificación de cuenta demo local
        if (code.trim() !== pending.code) return { ok: false, error: "El código no coincide." };
        const id = DEMO_ID;
        set((s) => ({
          sessionUserId: id,
          pending: null,
          view: "chats",
          activeChatId: null,
          infoOpen: false,
        }));
        return { ok: true };
      },

      logout: () => {
        stopRing();
        cleanupCall();
        PapuApi.clearToken();
        set({
          sessionUserId: null,
          pending: null,
          call: null,
          typingId: null,
          activeChatId: null,
          infoOpen: false,
          view: "chats",
          replyId: null,
        });
      },

      setView: (view) => set({ view, infoOpen: false, ...(view !== "chats" ? { activeChatId: null } : {}) }),

      openChat: (id) => {
        const now = Date.now();
        patchUser(set, get, (data) => {
          const exists = data.chats.some((c) => c.id === id);
          const tone = nickToTone(id);
          const chats = exists
            ? data.chats.map((c) =>
                c.id !== id
                  ? c
                  : {
                      ...c,
                      lastReadAt: now,
                      messages: c.messages.map((m) => (m.author === "me" ? { ...m, status: "read" as const } : m)),
                    },
              )
            : [
                {
                  id,
                  title: id,
                  kind: "dm" as const,
                  tone,
                  presence: "online" as const,
                  pinned: false,
                  muted: false,
                  about: "Usuario de PapusBank",
                  members: [{ id, name: id, about: "Usuario de PapusBank", tone }],
                  messages: [],
                  lastReadAt: now,
                },
                ...data.chats,
              ];
          return { ...data, chats };
        });
        set({ activeChatId: id, view: "chats", replyId: null });

        // Sincronizar mensajes inmediatamente para este chat
        const token = PapuApi.getToken();
        if (token && id !== "valeria" && id !== "mateo") {
          void (async () => {
            const apiMsgs = await PapuApi.getMessages(id);
            if (apiMsgs && apiMsgs.length > 0) {
              const myNick = get().sessionUserId || "";
              const formattedMsgs: Message[] = apiMsgs.map((m) => parseApiMessage(m, myNick));
              patchUser(set, get, (data) => ({
                ...data,
                chats: data.chats.map((c) => (c.id === id ? { ...c, messages: formattedMsgs, lastReadAt: Date.now() } : c)),
              }));
            }
          })();
        }
      },

      closeChat: () => set({ activeChatId: null, infoOpen: false, replyId: null }),
      setInfo: (open) => set({ infoOpen: open }),
      setReply: (id) => set({ replyId: id }),
      togglePin: (id) =>
        patchUser(set, get, (data) => ({
          ...data,
          chats: data.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
        })),
      toggleMute: (id) =>
        patchUser(set, get, (data) => ({
          ...data,
          chats: data.chats.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c)),
        })),
      toggleSound: () => patchUser(set, get, (data) => ({ ...data, sound: !data.sound })),

      updateProfile: (name, about) => {
        const id = get().sessionUserId;
        if (!id) return;
        const clean = name.trim();
        const aboutClean = about.trim();
        if (clean.length < 2) return;
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, name: clean, about: aboutClean } : a)),
        }));
        patchUser(set, get, (data) => ({ ...data, about: aboutClean }));
      },

      setMyStatus: (text) => {
        const clean = text.trim();
        if (!clean) return;
        patchUser(set, get, (data) => ({ ...data, myStatus: { text: clean, at: Date.now() } }));
      },

      sendText: async (body) => {
        const clean = body.trim();
        if (!clean) return;
        const chatId = get().activeChatId;
        const cur = current(get);
        if (!cur || !chatId) return;

        const replyId = get().replyId ?? undefined;
        const tempId = uid("m");
        const tempMsg: Message = {
          id: tempId,
          author: "me",
          kind: "text",
          body: clean,
          createdAt: Date.now(),
          status: "sent",
          replyId,
        };

        // Mostrar de inmediato en UI
        patchUser(set, get, (data) => ({
          ...data,
          chats: data.chats.map((c) => (c.id === chatId ? { ...c, messages: c.messages.concat(tempMsg) } : c)),
        }));
        set(() => ({ replyId: null }));
        if (soundOn(get)) playSend();

        // Enviar a la base de datos de PapusBank
        const token = PapuApi.getToken();
        if (token) {
          const apiMsg = await PapuApi.sendMessage(chatId, clean);
          if (apiMsg) {
            patchUser(set, get, (data) => ({
              ...data,
              chats: data.chats.map((c) =>
                c.id !== chatId
                  ? c
                  : {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === tempId ? { ...m, id: String(apiMsg.id), status: "delivered" } : m,
                      ),
                    },
              ),
            }));
          }
        } else {
          // Si es cuenta de demostración local, simular respuesta
          const chat = cur.data.chats.find((c) => c.id === chatId);
          if (chat) {
            window.setTimeout(() => {
              const reply = craftReply(chat, tempMsg);
              const incoming: Message = {
                id: uid("m"),
                author: "them",
                senderName: reply.senderName,
                kind: "text",
                body: reply.body,
                createdAt: Date.now(),
                status: "delivered",
              };
              patchUser(set, get, (data) => ({
                ...data,
                chats: data.chats.map((c) => (c.id === chatId ? { ...c, messages: c.messages.concat(incoming) } : c)),
              }));
              if (soundOn(get) && !chat.muted) playReceive();
            }, 1200);
          }
        }
      },

      sendMedia: async (input) => {
        const cur = current(get);
        const chatId = get().activeChatId;
        if (!cur || !chatId) return;

        const replyId = get().replyId ?? undefined;
        const tempId = uid("m");
        const message: Message = {
          ...input,
          id: tempId,
          author: "me",
          createdAt: Date.now(),
          status: "sent",
          replyId,
        };

        patchUser(set, get, (data) => ({
          ...data,
          chats: data.chats.map((c) => (c.id === chatId ? { ...c, messages: c.messages.concat(message) } : c)),
        }));
        set(() => ({ replyId: null }));
        if (soundOn(get)) playSend();

        const token = PapuApi.getToken();
        if (token && chatId !== "valeria" && chatId !== "mateo") {
          const payload = JSON.stringify({
            kind: input.kind,
            body: input.body,
            mediaUrl: input.mediaUrl,
            mediaName: input.mediaName,
            durationMs: input.durationMs,
            replyId,
          });
          const apiMsg = await PapuApi.sendMessage(chatId, payload);
          if (apiMsg) {
            patchUser(set, get, (data) => ({
              ...data,
              chats: data.chats.map((c) =>
                c.id !== chatId
                  ? c
                  : {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === tempId ? { ...m, id: String(apiMsg.id), status: "delivered" } : m,
                      ),
                    },
              ),
            }));
          }
        }
      },

      deleteMessage: async (chatId, messageId) => {
        const token = PapuApi.getToken();
        if (token) {
          void PapuApi.deleteMessage(messageId);
        }
        patchUser(set, get, (data) => ({
          ...data,
          chats: data.chats.map((c) => (c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c)),
        }));
      },

      startOutgoing: async (chatId, kind) => {
        stopRing();
        cleanupCall();
        const token = PapuApi.getToken();
        if (token && chatId !== "valeria" && chatId !== "mateo") {
          const res = await PapuApi.startCall(chatId, kind);
          if (!res.ok || !res.call) {
            return;
          }
          const callSession = res.call;
          set({
            call: {
              id: callSession.id,
              chatId,
              kind,
              direction: "out",
              phase: "outgoing",
              startedAt: null,
              muted: false,
              cameraOn: kind === "video",
            },
          });
          if (soundOn(get)) startRing();
          void initCallPeer(callSession.id, true, kind);
        } else {
          const id = uid("live");
          set({
            call: { id, chatId, kind, direction: "out", phase: "outgoing", startedAt: null, muted: false, cameraOn: false },
          });
          if (soundOn(get)) startRing();
          window.setTimeout(() => {
            const call = get().call;
            if (!call || call.id !== id || call.phase !== "outgoing") return;
            stopRing();
            playConnect();
            set({ call: { ...call, phase: "active", startedAt: Date.now() } });
          }, 1700);
        }
      },

      startIncoming: (chatId) => {
        stopRing();
        const id = uid("live");
        set({
          call: { id, chatId, kind: "voice", direction: "in", phase: "incoming", startedAt: null, muted: false, cameraOn: false },
        });
        if (soundOn(get)) startRing();
        window.setTimeout(() => {
          const call = get().call;
          if (!call || call.id !== id || call.phase !== "incoming") return;
          stopRing();
          const cur = current(get);
          const chat = cur?.data.chats.find((c) => c.id === chatId);
          if (cur && chat) {
            const at = Date.now();
            patchUser(set, get, (data) => ({
              ...data,
              calls: [
                { id: uid("call"), chatId, title: chat.title, tone: chat.tone, kind: "voice", direction: "in", result: "missed", at, durationMs: 0 },
                ...data.calls,
              ],
              chats: data.chats.map((c) =>
                c.id !== chatId
                  ? c
                  : {
                      ...c,
                      messages: c.messages.concat({
                        id: uid("m"),
                        author: "them",
                        kind: "call",
                        body: "Llamada perdida",
                        createdAt: at,
                        status: "delivered",
                        callKind: "voice",
                        callResult: "missed",
                        durationMs: 0,
                      }),
                    },
              ),
            }));
            if (soundOn(get) && !chat.muted) playReceive();
          }
          set({ call: null });
        }, 20000);
      },

      acceptCall: async () => {
        const call = get().call;
        if (!call) return;
        stopRing();
        playConnect();
        set({ call: { ...call, phase: "active", startedAt: Date.now() } });

        const token = PapuApi.getToken();
        if (token && call.chatId !== "valeria" && call.chatId !== "mateo") {
          void PapuApi.respondCall(call.id, "accept");
          void initCallPeer(call.id, false, call.kind);
        }
      },

      endCall: async () => {
        const call = get().call;
        if (!call) return;
        stopRing();
        cleanupCall();
        const token = PapuApi.getToken();
        if (token && call.chatId !== "valeria" && call.chatId !== "mateo") {
          const action = call.phase === "incoming" ? "decline" : "end";
          void PapuApi.respondCall(call.id, action);
        }
        finishCall(set, get);
      },

      setCallMuted: (muted) => {
        const call = get().call;
        if (!call) return;
        setLocalAudioMuted(muted);
        set({ call: { ...call, muted } });
      },

      setCamera: (on) => {
        const call = get().call;
        if (!call) return;
        setLocalCameraEnabled(on);
        set({ call: { ...call, cameraOn: on } });
      },

      resetDemo: () => {
        const id = get().sessionUserId;
        if (!id) return;
        const account = get().accounts.find((a) => a.id === id);
        const next = id === DEMO_ID ? demoData() : freshData();
        if (account) next.about = account.about;
        set((s) => ({
          data: { ...s.data, [id]: next },
          activeChatId: null,
          infoOpen: false,
          replyId: null,
          typingId: null,
          call: null,
        }));
      },

      syncFromApi: async () => {
        const token = PapuApi.getToken();
        const myNick = get().sessionUserId;
        if (!token || !myNick || myNick === DEMO_ID) return;

        try {
          const [convs, friendsData, callInfo] = await Promise.all([
            PapuApi.getConversations(),
            PapuApi.getFriends(),
            PapuApi.checkCalls(),
          ]);

          // Señalización de llamadas en tiempo real
          const currentCall = get().call;
          if (callInfo?.incoming) {
            const inc = callInfo.incoming;
            if (!currentCall || currentCall.id !== inc.id) {
              set({
                call: {
                  id: inc.id,
                  chatId: inc.from,
                  kind: inc.kind || "voice",
                  direction: "in",
                  phase: "incoming",
                  startedAt: null,
                  muted: false,
                  cameraOn: false,
                },
              });
              if (soundOn(get)) startRing();
            }
          } else if (currentCall) {
            if (currentCall.phase === "outgoing") {
              if (callInfo?.active && callInfo.active.id === currentCall.id) {
                if (callInfo.active.status === "active") {
                  stopRing();
                  playConnect();
                  set({
                    call: {
                      ...currentCall,
                      phase: "active",
                      startedAt: callInfo.active.startedAt || Date.now(),
                    },
                  });
                } else if (callInfo.active.status === "declined" || callInfo.active.status === "ended") {
                  stopRing();
                  cleanupCall();
                  finishCall(set, get);
                }
              } else if (!callInfo?.active) {
                stopRing();
                cleanupCall();
                set({ call: null });
              }
            } else if (currentCall.phase === "active") {
              if (!callInfo?.active || callInfo.active.id !== currentCall.id || callInfo.active.status === "ended" || callInfo.active.status === "declined") {
                stopRing();
                cleanupCall();
                finishCall(set, get);
              }
            }
          }

          const contactNicks = new Set<string>();
          convs.forEach((c) => contactNicks.add(c.contact));
          friendsData.friends.forEach((f) => contactNicks.add(f.friend_nick));
          if (callInfo?.incoming?.from) contactNicks.add(callInfo.incoming.from);

          patchUser(set, get, (data) => {
            const existingMap = new Map(data.chats.map((c) => [c.id, c]));

            const nextChats: Chat[] = Array.from(contactNicks).map((nick) => {
              const existing = existingMap.get(nick);
              const tone = existing?.tone || nickToTone(nick);
              return {
                id: nick,
                title: nick,
                kind: "dm",
                tone,
                presence: "online",
                pinned: existing ? existing.pinned : false,
                muted: existing ? existing.muted : false,
                about: "Usuario de PapusBank",
                members: [{ id: nick, name: nick, about: "Usuario de PapusBank", tone }],
                messages: existing ? existing.messages : [],
                lastReadAt: existing ? existing.lastReadAt : 0,
              };
            });

            return {
              ...data,
              chats: nextChats.length > 0 ? nextChats : data.chats,
            };
          });

          // Si hay chat activo, traer los mensajes
          const activeChat = get().activeChatId;
          if (activeChat && activeChat !== "valeria" && activeChat !== "mateo") {
            const apiMsgs = await PapuApi.getMessages(activeChat);
            if (apiMsgs && apiMsgs.length > 0) {
              const formattedMsgs: Message[] = apiMsgs.map((m) => parseApiMessage(m, myNick));

              const curChat = current(get)?.data.chats.find((c) => c.id === activeChat);
              const prevMsgCount = curChat?.messages.length || 0;
              const lastPrev = curChat?.messages[prevMsgCount - 1];
              const lastNew = formattedMsgs[formattedMsgs.length - 1];

              if (lastNew && lastNew.author === "them" && (!lastPrev || String(lastPrev.id) !== String(lastNew.id))) {
                if (soundOn(get) && !curChat?.muted) {
                  playReceive();
                }
              }

              patchUser(set, get, (data) => ({
                ...data,
                chats: data.chats.map((c) =>
                  c.id === activeChat
                    ? {
                        ...c,
                        messages: formattedMsgs,
                        lastReadAt: Date.now(),
                      }
                    : c,
                ),
              }));
            }
          }
        } catch {}
      },
    }),
    {
      name: "papuwhats.v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({
        accounts: s.accounts,
        sessionUserId: s.sessionUserId,
        pending: s.pending,
        data: s.data,
        view: s.view,
        activeChatId: s.activeChatId,
      }),
    },
  ),
);

// Polling en segundo plano cada 2s para recibir mensajes y llamadas en tiempo real
if (typeof window !== "undefined") {
  setInterval(() => {
    const state = usePapu.getState();
    if (state.sessionUserId && !document.hidden) {
      void state.syncFromApi();
    }
  }, 2000);
}
