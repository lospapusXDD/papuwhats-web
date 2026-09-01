const API_BASE = "https://doozy-cosigner-sandstorm.ngrok-free.dev/api";
const PAPUWHATS_BASE = "https://doozy-cosigner-sandstorm.ngrok-free.dev/papuwhats";

// Ngrok bypass: enviamos BOTH header + query param para compatibilidad total
// Header es obligatorio para Ngrok (evita pagina azul HTML 200), query param asegura bypass aun con CORS estricto
function ngrokUrl(url) {
  return `${url}${url.includes("?") ? "&" : "?"}ngrok-skip-browser-warning=true`;
}

const PapuApi = {
  getToken() {
    return localStorage.getItem("papuwhats_jwt") || localStorage.getItem("papubank_jwt");
  },

  setToken(token) {
    localStorage.setItem("papuwhats_jwt", token);
    localStorage.setItem("papubank_jwt", token);
  },

  clearToken() {
    localStorage.removeItem("papuwhats_jwt");
    localStorage.removeItem("papubank_jwt");
    localStorage.removeItem("papuwhats_user");
  },

  handleAuthFail() {
    this.clearToken();
    localStorage.removeItem("papuwhats_nick");
    // Evitar spam: solo redirigir una vez
    if (!window._authFailHandled) {
      window._authFailHandled = true;
      console.warn("[PapuApi] 401 Unauthorized -> sesion expirada, redirigiendo a login");
      if (typeof showAuthScreen === "function") setTimeout(() => showAuthScreen(), 100);
      else if (window.showAuthScreen) setTimeout(() => window.showAuthScreen(), 100);
      // Limpiar intervalos para parar el bucle 401
      if (typeof clearMainIntervals === "function") try{ clearMainIntervals(); }catch(e){}
      if (typeof chatPollingInterval !== "undefined" && chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null; }
    }
  },

  getHeaders() {
    const headers = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  },

  async login(nick, password) {
    const res = await fetch(ngrokUrl(`${API_BASE}/auth/login`), {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ nick, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesion");
    if (data.twofaRequired || data.twofa_required) {
      return { twofaRequired: true, tempToken: data.tempToken || data.temp_token };
    }
    if (data.accessToken) this.setToken(data.accessToken);
    this.sendHeartbeat(nick);
    return data;
  },

  async confirm2FA(tempToken, code) {
    const res = await fetch(ngrokUrl(`${API_BASE}/auth/2fa/confirm`), {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ tempToken, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Codigo 2FA invalido");
    if (data.accessToken) this.setToken(data.accessToken);
    return data;
  },

  async register(nick, password) {
    const res = await fetch(ngrokUrl(`${API_BASE}/auth/register`), {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ nick, password, hash: nick })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al registrar usuario");
    if (data.accessToken) this.setToken(data.accessToken);
    this.sendHeartbeat(nick);
    return data;
  },

  async sendHeartbeat(nick, statusExtra = {}) {
    if (!nick) return;
    try {
      const profile = await this.getUserProfile(nick);
      if (!profile) return;
      let extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) extra = {};
      extra.last_seen = Date.now();
      if (statusExtra.typing_to !== undefined) extra.typing_to = statusExtra.typing_to;
      if (statusExtra.recording_to !== undefined) extra.recording_to = statusExtra.recording_to;
      await this.updateUser(nick, { secretAchievements: extra });
    } catch (e) {}
  },

  async getUserStatusInfo(nick) {
    if (!nick) return { online: false, typingTo: null, recordingTo: null };
    try {
      const profile = await this.getUserProfile(nick);
      if (!profile) return { online: false, typingTo: null, recordingTo: null };
      const extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) return { online: false, typingTo: null, recordingTo: null };
      const lastSeen = extra.last_seen || 0;
      const isOnline = (Date.now() - lastSeen) < 25000;
      return {
        online: isOnline,
        typingTo: extra.typing_to || null,
        recordingTo: extra.recording_to || null,
        reactions: extra.reactions || {}
      };
    } catch (e) {
      return { online: false, typingTo: null, recordingTo: null };
    }
  },

  async checkUserOnline(nick) {
    const info = await this.getUserStatusInfo(nick);
    return info.online;
  },

  async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally { clearTimeout(id); }
  },

  async getUserProfile(nick) {
    try {
      const res = await this.fetchWithTimeout(ngrokUrl(`${API_BASE}/users/${encodeURIComponent(nick)}`), {
        headers: this.getHeaders()
      });
      if (res.status === 401) { this.handleAuthFail(); return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') console.warn(`[api] getUserProfile timeout ${nick}`);
      throw e;
    }
  },

  async getAllUsers() {
    const res = await fetch(ngrokUrl(`${API_BASE}/users`), {
      headers: this.getHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : Object.values(data);
  },

  async updateUser(nick, userData) {
    const res = await fetch(ngrokUrl(`${API_BASE}/users/${encodeURIComponent(nick)}`), {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });
    if (res.status === 401) { this.handleAuthFail(); throw new Error("Sesion expirada"); }
    return await res.json();
  },

  async fetchPrivateMessages() {
    try {
      const res = await this.fetchWithTimeout(ngrokUrl(`${API_BASE}/messages`), {
        headers: this.getHeaders()
      });
      if (res.status === 401) { this.handleAuthFail(); return []; }
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.messages)) return data.messages;
      return [];
    } catch (e) {
      if (e.name === 'AbortError') console.warn('[api] fetchPrivateMessages timeout');
      throw e;
    }
  },

  async sendPrivateMessage(toNick, messageText, mediaType = "text") {
    const myNick = localStorage.getItem("papuwhats_nick");
    const res = await fetch(ngrokUrl(`${API_BASE}/messages`), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        from: myNick, fromNick: myNick, from_nick: myNick,
        to: toNick, toNick: toNick, to_nick: toNick,
        msg: messageText, text: messageText,
        mediaType: mediaType,
        timestamp: new Date().toISOString()
      })
    });
    return await res.json();
  },

  async editMessage(messageId, newText) {
    const res = await fetch(ngrokUrl(`${API_BASE}/messages/${messageId}`), {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ msg: newText, text: newText })
    });
    return await res.json();
  },

  async deleteMessage(messageId) {
    const res = await fetch(ngrokUrl(`${API_BASE}/messages/${messageId}`), {
      method: "DELETE",
      headers: this.getHeaders()
    });
    return await res.json();
  },

  async transferToFriend(toNick, amount, note = "") {
    const res = await fetch(ngrokUrl(`${API_BASE}/bank/transfer-friend`), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ to: toNick, amount: Number(amount), note: note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al realizar transferencia");
    return data;
  },

  async getFriendBalances() {
    const res = await fetch(ngrokUrl(`${API_BASE}/friends/balances`), {
      headers: this.getHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  },

  async fetchFriends() {
    try {
      const res = await this.fetchWithTimeout(ngrokUrl(`${PAPUWHATS_BASE}/friends`), {
        headers: this.getHeaders()
      }, 6000);
      if (res.status === 401) { this.handleAuthFail(); return null; }
      if (res.ok) return await res.json();
    } catch (e) {}
    try {
      const res2 = await this.fetchWithTimeout(ngrokUrl(`${API_BASE}/friends/balances`), {
        headers: this.getHeaders()
      }, 6000);
      if (res2 && res2.status === 401) { this.handleAuthFail(); return null; }
      if (res2 && res2.ok) return await res2.json();
    } catch (e) {}
    return null;
  },

  async sendFriendRequest(targetNick) {
    try {
      const res = await fetch(ngrokUrl(`${API_BASE}/friends/request`), {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ to: targetNick, toNick: targetNick })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  async acceptFriendRequest(fromNick) {
    try {
      const res = await fetch(ngrokUrl(`${API_BASE}/friends/accept`), {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ from: fromNick, fromNick: fromNick })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  async shutdownServer() {
    const res = await fetch(ngrokUrl(`${API_BASE}/admin/power/shutdown`), {
      method: "POST",
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al apagar servidor");
    return data;
  },

  async wakeOnLanServer() {
    const res = await fetch(ngrokUrl(`${API_BASE}/admin/power/wol`), {
      method: "POST",
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar paquete WoL");
    return data;
  }
};
