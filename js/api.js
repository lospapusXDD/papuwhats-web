const API_BASE = "https://judges-acm-riders-musical.trycloudflare.com/api";

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

  getHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  },

  async login(nick, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");

    if (data.twofaRequired || data.twofa_required) {
      return { twofaRequired: true, tempToken: data.tempToken || data.temp_token };
    }

    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    this.sendHeartbeat(nick);
    return data;
  },

  async confirm2FA(tempToken, code) {
    const res = await fetch(`${API_BASE}/auth/2fa/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Código 2FA inválido");
    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    return data;
  },

  async register(nick, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password, hash: nick })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al registrar usuario");
    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    this.sendHeartbeat(nick);
    return data;
  },

  async sendHeartbeat(nick) {
    if (!nick) return;
    try {
      const profile = await this.getUserProfile(nick);
      if (!profile) return;
      let extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) extra = {};
      extra.last_seen = Date.now();
      await this.updateUser(nick, { secretAchievements: extra });
    } catch (e) {}
  },

  async checkUserOnline(nick) {
    if (!nick) return false;
    try {
      const profile = await this.getUserProfile(nick);
      if (!profile) return false;
      const extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) return false;
      const lastSeen = extra.last_seen || 0;
      // Considerar "En línea" si estuvo activo en los últimos 20 segundos
      return (Date.now() - lastSeen) < 25000;
    } catch (e) {
      return false;
    }
  },

  async getUserProfile(nick) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(nick)}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async getAllUsers() {
    const res = await fetch(`${API_BASE}/users`, {
      headers: this.getHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : Object.values(data);
  },

  async updateUser(nick, userData) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(nick)}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });
    return await res.json();
  },

  async fetchPrivateMessages() {
    const res = await fetch(`${API_BASE}/messages`, {
      headers: this.getHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  },

  async sendPrivateMessage(toNick, messageText, mediaType = "text") {
    const myNick = localStorage.getItem("papuwhats_nick");
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        from: myNick,
        fromNick: myNick,
        from_nick: myNick,
        to: toNick,
        toNick: toNick,
        to_nick: toNick,
        msg: messageText,
        text: messageText,
        mediaType: mediaType,
        timestamp: new Date().toISOString()
      })
    });
    return await res.json();
  },

  async editMessage(messageId, newText) {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ msg: newText, text: newText })
    });
    return await res.json();
  },

  async deleteMessage(messageId) {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: "DELETE",
      headers: this.getHeaders()
    });
    return await res.json();
  }
};
