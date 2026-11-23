export type Tone = "amber" | "clay" | "moss" | "bone";

export type Member = {
  id: string;
  name: string;
  about: string;
  tone: Tone;
};

export type Message = {
  id: string;
  author: "me" | "them";
  senderName?: string;
  kind: "text" | "image" | "file" | "voice" | "call" | "video";
  body: string;
  createdAt: number;
  status: "sent" | "delivered" | "read";
  replyId?: string;
  mediaUrl?: string;
  mediaName?: string;
  durationMs?: number;
  callKind?: "voice" | "video";
  callResult?: "missed" | "ended" | "declined" | "canceled";
};

export type Chat = {
  id: string;
  title: string;
  kind: "dm" | "group";
  tone: Tone;
  members: Member[];
  about: string;
  presence: "online" | "away";
  pinned: boolean;
  muted: boolean;
  messages: Message[];
  lastReadAt: number;
};

export type Account = {
  id: string;
  name: string;
  email: string;
  password: string;
  about: string;
};

export type CallRecord = {
  id: string;
  chatId: string;
  title: string;
  tone: Tone;
  kind: "voice" | "video";
  direction: "in" | "out";
  result: "missed" | "ended" | "declined" | "canceled";
  at: number;
  durationMs: number;
};

export type UserData = {
  about: string;
  sound: boolean;
  chats: Chat[];
  calls: CallRecord[];
  myStatus: { text: string; at: number } | null;
};

export type PendingAuth = {
  mode: "login" | "register";
  name: string;
  email: string;
  password: string;
  code: string;
  tempToken?: string;
};

export type LiveCall = {
  id: string;
  chatId: string;
  kind: "voice" | "video";
  direction: "in" | "out";
  phase: "outgoing" | "incoming" | "active";
  startedAt: number | null;
  muted: boolean;
  cameraOn: boolean;
};

export type AppView = "chats" | "updates" | "calls" | "settings";

export type Story = {
  id: string;
  name: string;
  tone: Tone;
  text: string;
  minutesAgo: number;
};
