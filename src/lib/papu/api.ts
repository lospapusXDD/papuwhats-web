/**
 * PapuWhats API Client
 * Conecta el frontend de PapuWhats directamente con el backend de PapusBank.
 */

function getBaseUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:3001";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.")) {
    return "";
  }
  return "https://papusbank.serveousercontent.com";
}

export type ApiMessage = {
  id: number;
  from_nick: string;
  to_nick: string;
  msg: string;
  created_at: string;
  read: boolean;
};

export type ApiConversation = {
  contact: string;
  last_message_at: string;
  unread_count: number;
};

export type ApiFriend = {
  friend_nick: string;
  created_at: string;
};

export type LoginResult =
  | { ok: true; accessToken: string; nick: string }
  | { ok: false; error: string; twofaRequired?: false }
  | { ok: false; twofaRequired: true; tempToken: string; email: string | null; twofaType: string };

export const PapuApi = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("papuwhats_jwt") || localStorage.getItem("papubank_jwt");
  },

  setToken(token: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem("papuwhats_jwt", token);
    localStorage.setItem("papubank_jwt", token);
  },

  clearToken() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("papuwhats_jwt");
    localStorage.removeItem("papubank_jwt");
    localStorage.removeItem("papuwhats_nick");
  },

  getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
  },

  async login(nick: string, password: string): Promise<LoginResult> {
    try {
      const url = getBaseUrl() + "/papuwhats/login";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: nick.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || data.reason || "Credenciales incorrectas" };
      }
      if (data.twofaRequired || data.twofa_required) {
        return {
          ok: false,
          twofaRequired: true,
          tempToken: data.tempToken || data.temp_token,
          email: data.email || null,
          twofaType: data.twofaType || data.twofa_type || "email",
        };
      }
      if (data.accessToken) {
        this.setToken(data.accessToken);
        localStorage.setItem("papuwhats_nick", data.nick || nick.trim());
        return { ok: true, accessToken: data.accessToken, nick: data.nick || nick.trim() };
      }
      return { ok: false, error: "No se recibió token de acceso" };
    } catch (e: any) {
      return { ok: false, error: e.message || "Error conectando al servidor" };
    }
  },

  async confirm2FA(tempToken: string, code: string): Promise<{ ok: true; accessToken: string; nick: string } | { ok: false; error: string }> {
    try {
      const url = getBaseUrl() + "/papuwhats/2fa/confirm";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Código 2FA incorrecto" };
      }
      if (data.accessToken) {
        this.setToken(data.accessToken);
        localStorage.setItem("papuwhats_nick", data.nick);
        return { ok: true, accessToken: data.accessToken, nick: data.nick };
      }
      return { ok: false, error: "Error de verificación" };
    } catch (e: any) {
      return { ok: false, error: e.message || "Error conectando al servidor" };
    }
  },

  async register(nick: string, password: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const url = getBaseUrl() + "/api/auth/register";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: nick.trim(), password, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "No se pudo registrar la cuenta" };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Error conectando al servidor" };
    }
  },

  async getProfile(): Promise<{ nick: string; balance?: number; is_admin?: boolean } | null> {
    try {
      const url = getBaseUrl() + "/api/users/profile";
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getConversations(): Promise<ApiConversation[]> {
    try {
      const url = getBaseUrl() + "/papuwhats/conversations";
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.conversations || [];
    } catch {
      return [];
    }
  },

  async getMessages(withNick: string): Promise<ApiMessage[]> {
    try {
      const url = getBaseUrl() + "/papuwhats/messages?with=" + encodeURIComponent(withNick) + "&limit=150";
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.messages || []).reverse();
    } catch {
      return [];
    }
  },

  async sendMessage(toNick: string, text: string): Promise<ApiMessage | null> {
    try {
      const url = getBaseUrl() + "/papuwhats/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ to: toNick.trim(), text: text.trim() }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async deleteMessage(messageId: number | string): Promise<boolean> {
    try {
      const url = getBaseUrl() + "/papuwhats/messages/" + messageId;
      const res = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getFriends(): Promise<{ friends: ApiFriend[]; incoming: any[]; outgoing: any[] }> {
    try {
      const url = getBaseUrl() + "/papuwhats/friends";
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return { friends: [], incoming: [], outgoing: [] };
      return await res.json();
    } catch {
      return { friends: [], incoming: [], outgoing: [] };
    }
  },

  async sendFriendRequest(toNick: string): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const url = getBaseUrl() + "/papuwhats/friends/request";
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ to: toNick.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true, message: data.message };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },

  async startCall(toNick: string, kind: "voice" | "video"): Promise<{ ok: boolean; call?: any; error?: string }> {
    try {
      const url = getBaseUrl() + "/papuwhats/call/start";
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ to: toNick.trim(), kind }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { ok: false, error: data.error || "No se pudo iniciar la llamada" };
      return { ok: true, call: data.call };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },

  async checkCalls(): Promise<{ incoming?: any; active?: any } | null> {
    try {
      const url = getBaseUrl() + "/papuwhats/call/check";
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async respondCall(callId: string, action: "accept" | "decline" | "end"): Promise<{ ok: boolean; call?: any; error?: string }> {
    try {
      const url = getBaseUrl() + "/papuwhats/call/respond";
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { ok: false, error: data.error || "Error al responder llamada" };
      return { ok: true, call: data.call };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },

  async sendCallSignal(callId: string, signal: any): Promise<boolean> {
    try {
      const url = getBaseUrl() + "/papuwhats/call/signal";
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, signal }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getCallSignals(callId: string): Promise<any[]> {
    try {
      const url = getBaseUrl() + "/papuwhats/call/signals?callId=" + encodeURIComponent(callId);
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.signals || [];
    } catch {
      return [];
    }
  },
};
