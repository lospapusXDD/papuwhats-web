let currentAuthTab = "login";

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});

function checkSession() {
  const token = PapuApi.getToken();
  const nick = localStorage.getItem("papuwhats_nick");

  if (token && nick) {
    showMainScreen(nick);
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("main-screen").classList.remove("active");
  document.getElementById("chat-room").classList.remove("active");
}

let globalKnownMsgIds = new Set();
let isInitialMessageLoad = true;

function showMainScreen(nick) {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("main-screen").classList.add("active");

  document.getElementById("my-nick").textContent = nick;
  updateMyAvatarUI(nick);

  // Solicitar permiso de Notificaciones de Escritorio para PC / Web
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  PapuApi.sendHeartbeat(nick);
  setInterval(() => PapuApi.sendHeartbeat(nick), 10000);

  loadRecentChats();
  loadSocialData();

  // Inicializar mensajes existentes para que NO notifique mensajes viejos
  initGlobalMessageTracking();

  // Polling periódico para recibir solicitudes de amistad, estados y notificar mensajes nuevos en segundo plano
  setInterval(() => {
    loadSocialData();
    checkBackgroundNewMessages();
    if (document.getElementById("tab-content-chats").classList.contains("active")) {
      loadRecentChats();
    }
  }, 3000);

  // Inicializar la posición del glow ring de la cápsula
  setTimeout(initCapsuleNav, 150);
}

async function initGlobalMessageTracking() {
  try {
    const allMessages = await PapuApi.fetchPrivateMessages();
    allMessages.forEach(m => {
      globalKnownMsgIds.add(String(m.id || m._id || m.createdAt));
    });
    isInitialMessageLoad = false;
  } catch (e) {}
}

async function checkBackgroundNewMessages() {
  if (isInitialMessageLoad) return;
  const myNick = (localStorage.getItem("papuwhats_nick") || "").toLowerCase();
  if (!myNick) return;

  try {
    const allMessages = await PapuApi.fetchPrivateMessages();
    let deletedIds = JSON.parse(localStorage.getItem("deleted_msg_ids") || "[]");

    allMessages.forEach(msg => {
      const msgId = String(msg.id || msg._id || msg.createdAt);
      if (deletedIds.includes(msgId)) return;

      if (!globalKnownMsgIds.has(msgId)) {
        globalKnownMsgIds.add(msgId);

        const from = (msg.from || msg.fromNick || msg.from_nick || "").toLowerCase();
        const to = (msg.to || msg.toNick || msg.to_nick || "").toLowerCase();
        const text = msg.msg || msg.text || "";

        // Ignorar mis propios mensajes o eventos de reacción
        if (from === myNick || text.startsWith("[REACT:")) return;

        // Solo notificar si va dirigido a mí y NO tengo ese chat abierto con la app activa
        const chatRoomActive = document.getElementById("chat-room").classList.contains("active");
        const isCurrentActiveChat = chatRoomActive && window.activeChatPartner && window.activeChatPartner.toLowerCase() === from && !document.hidden;

        if (to === myNick && !isCurrentActiveChat) {
          let notifText = text;
          if (notifText.startsWith("[QUOTE:")) {
            const endQ = notifText.indexOf("]");
            if (endQ !== -1) notifText = notifText.substring(endQ + 1).trim();
          }
          if (notifText.startsWith("data:audio/")) notifText = "Nota de voz";
          else if (notifText.startsWith("data:image/")) notifText = "Foto";
          else if (notifText.startsWith("STICKER:") || notifText.startsWith("data:sticker/") || msg.mediaType === "sticker") notifText = "Sticker";

          const senderName = msg.from || msg.fromNick || msg.from_nick || "Amigo";
          triggerAppNotification(senderName, notifText);
        }
      }
    });
  } catch (e) {}
}

// Emisor Universal de Notificaciones (PC / Android)
function triggerAppNotification(sender, messageText) {
  // 1. Android Nativo
  if (window.AndroidNative && window.AndroidNative.showNotification) {
    window.AndroidNative.showNotification(sender, messageText);
  }
  // 2. Navegador PC / Web Notifications API
  else if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(`papuWhats - ${sender}`, {
        body: messageText,
        icon: "icon.png"
      });
    } catch (e) {}
  }

  // Sonido suave de notificación web con Web Audio API
  playNotificationSound();
}
window.triggerAppNotification = triggerAppNotification;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function updateMyAvatarUI(nick) {
  const avatarEl = document.getElementById("my-avatar");
  const customAvatar = localStorage.getItem(`avatar_${nick.toLowerCase()}`);
  if (customAvatar) {
    avatarEl.innerHTML = `<img src="${customAvatar}" class="avatar-circle-img">`;
  } else {
    avatarEl.textContent = nick.charAt(0).toUpperCase();
  }
}

function changeMyProfileAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  const nick = localStorage.getItem("papuwhats_nick");
  if (!nick) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    const base64Avatar = event.target.result;
    localStorage.setItem(`avatar_${nick.toLowerCase()}`, base64Avatar);
    updateMyAvatarUI(nick);
    
    try {
      const profile = await PapuApi.getUserProfile(nick);
      let extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) extra = {};
      extra.avatar = base64Avatar;
      await PapuApi.updateUser(nick, { secretAchievements: extra });
      alert("¡Foto de perfil actualizada!");
    } catch (err) {
      console.warn("Avatar guardado localmente:", err);
    }
  };
  reader.readAsDataURL(file);
}

// ─── Capsule Nav: Spring-Physics Glow Ring ───
let capsuleSpring = { x: 0, velocity: 0, target: 0, running: false };
const SPRING_DAMPING = 22;
const SPRING_STIFFNESS = 235;

function initCapsuleNav() {
  const items = document.querySelectorAll('.capsule-item');
  if (!items.length) return;
  // Posicionar el ring sobre el primer ítem activo
  requestAnimationFrame(() => {
    const activeItem = document.querySelector('.capsule-item.active');
    if (activeItem) {
      const pos = getCapsuleItemCenter(activeItem);
      capsuleSpring.x = pos;
      capsuleSpring.target = pos;
      moveGlowRing(pos);
    }
  });
}

function getCapsuleItemCenter(el) {
  const track = document.querySelector('.capsule-track');
  if (!track || !el) return 0;
  const trackRect = track.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return (elRect.left + elRect.width / 2) - trackRect.left;
}

function moveGlowRing(xPx) {
  const ring = document.getElementById('capsule-glow-ring');
  if (ring) ring.style.left = xPx + 'px';
}

function animateCapsuleSpring() {
  if (!capsuleSpring.running) return;

  const dx = capsuleSpring.x - capsuleSpring.target;
  const ax = (-SPRING_STIFFNESS * dx) - (SPRING_DAMPING * capsuleSpring.velocity);
  capsuleSpring.velocity += ax * (1 / 60);
  capsuleSpring.x += capsuleSpring.velocity * (1 / 60);

  moveGlowRing(capsuleSpring.x);

  // Frenar cuando ya está cerca del destino
  if (Math.abs(capsuleSpring.velocity) < 0.1 && Math.abs(dx) < 0.2) {
    capsuleSpring.x = capsuleSpring.target;
    capsuleSpring.velocity = 0;
    capsuleSpring.running = false;
    moveGlowRing(capsuleSpring.target);
    return;
  }

  requestAnimationFrame(animateCapsuleSpring);
}

function switchNavTab(tab) {
  // Actualizar clases active en los botones capsule
  const items = document.querySelectorAll('.capsule-item');
  items.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Mover glow ring con spring hacia el ítem seleccionado
  const activeBtn = document.querySelector(`.capsule-item[data-tab="${tab}"]`);
  if (activeBtn) {
    const targetX = getCapsuleItemCenter(activeBtn);
    capsuleSpring.target = targetX;
    if (!capsuleSpring.running) {
      capsuleSpring.running = true;
      requestAnimationFrame(animateCapsuleSpring);
    }
  }

  // Mostrar/ocultar tab-views
  document.getElementById("tab-content-chats").classList.toggle("active", tab === "chats");
  document.getElementById("tab-content-statuses").classList.toggle("active", tab === "statuses");
  document.getElementById("tab-content-starred").classList.toggle("active", tab === "starred");
  document.getElementById("tab-content-friends").classList.toggle("active", tab === "friends");
  const tabSettings = document.getElementById("tab-content-settings");
  if (tabSettings) tabSettings.classList.toggle("active", tab === "settings");

  if (tab === "chats") loadRecentChats();
  if (tab === "statuses") loadStatuses();
  if (tab === "starred") loadStarredMessages();
  if (tab === "friends") loadSocialData();
}

// Inicializar capsule al cargar
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initCapsuleNav, 100);
  // Re-calcular en resize
  window.addEventListener("resize", () => {
    const activeBtn = document.querySelector('.capsule-item.active');
    if (activeBtn) {
      const pos = getCapsuleItemCenter(activeBtn);
      capsuleSpring.x = pos;
      capsuleSpring.target = pos;
      moveGlowRing(pos);
    }
  });
});

/* Sistema de Estados / Historias Remotas (24 horas sincronizadas) */
async function uploadMyStatus(e) {
  const file = e.target.files[0];
  if (!file) return;
  const myNick = localStorage.getItem("papuwhats_nick");
  if (!myNick) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    const base64Img = event.target.result;
    const newStatus = {
      user: myNick,
      image: base64Img,
      time: Date.now()
    };

    // Guardar en la nube (Perfil de usuario) para que todos los amigos lo vean
    try {
      const profile = await PapuApi.getUserProfile(myNick);
      let extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) extra = {};
      extra.current_status = newStatus;
      await PapuApi.updateUser(myNick, { secretAchievements: extra });
    } catch (err) {
      console.warn("Error subiendo estado remoto:", err);
    }

    let allStatuses = JSON.parse(localStorage.getItem("papuwhats_statuses") || "[]");
    allStatuses.unshift(newStatus);
    localStorage.setItem("papuwhats_statuses", JSON.stringify(allStatuses));

    if (window.AndroidNative && window.AndroidNative.vibratePhone) {
      window.AndroidNative.vibratePhone();
    }
    alert("¡Estado publicado en la nube por 24 horas!");
    loadStatuses();
  };
  reader.readAsDataURL(file);
}

async function loadStatuses() {
  const listEl = document.getElementById("statuses-list");
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const myNick = (localStorage.getItem("papuwhats_nick") || "").toLowerCase();

  let statuses = [];

  // 1. Obtener estados de amigos desde la API
  try {
    const allUsers = await PapuApi.getAllUsers();
    allUsers.forEach(u => {
      const uNick = u.nick || u.username || "";
      const extra = u.secretAchievements || u.secret_achievements || {};
      if (extra && extra.current_status && extra.current_status.image) {
        if ((now - (extra.current_status.time || 0)) < TWENTY_FOUR_HOURS) {
          statuses.push(extra.current_status);
        }
      }
    });
  } catch (err) {
    console.warn("Cargando estados locales:", err);
  }

  if (statuses.length === 0) {
    let localStatuses = JSON.parse(localStorage.getItem("papuwhats_statuses") || "[]");
    statuses = localStatuses.filter(s => (now - s.time) < TWENTY_FOUR_HOURS);
  }

  if (statuses.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No hay estados recientes de tus amigos.</div>';
    return;
  }

  listEl.innerHTML = statuses.map(s => {
    const elapsedMinutes = Math.floor((now - s.time) / 60000);
    const timeText = elapsedMinutes < 60 ? `Hace ${elapsedMinutes}m` : `Hace ${Math.floor(elapsedMinutes / 60)}h`;
    const customAvatar = localStorage.getItem(`avatar_${s.user.toLowerCase()}`);
    const avatarHtml = customAvatar 
      ? `<img src="${customAvatar}" class="status-circle-ring">` 
      : `<div class="status-circle-ring-letter">${s.user.charAt(0).toUpperCase()}</div>`;

    return `
      <div class="status-item" onclick="viewStatus('${s.user}', '${s.image}', '${timeText}')">
        ${avatarHtml}
        <div>
          <div style="font-weight:600; font-size:14px;">${s.user}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${timeText}</div>
        </div>
      </div>
    `;
  }).join("");
}

let statusTimer = null;
function viewStatus(user, image, timeText) {
  const modal = document.getElementById("modal-status-viewer");
  document.getElementById("status-viewer-nick").textContent = user;
  document.getElementById("status-viewer-time").textContent = timeText;
  document.getElementById("status-viewer-img").src = image;

  const avatarEl = document.getElementById("status-viewer-avatar");
  const customAvatar = localStorage.getItem(`avatar_${user.toLowerCase()}`);
  if (customAvatar) {
    avatarEl.innerHTML = `<img src="${customAvatar}" class="avatar-circle-img">`;
  } else {
    avatarEl.textContent = user.charAt(0).toUpperCase();
  }

  const fill = document.getElementById("status-progress-fill");
  fill.style.width = "0%";
  modal.classList.remove("hidden");

  setTimeout(() => { fill.style.width = "100%"; }, 50);

  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    closeStatusViewer();
  }, 5000);
}

function closeStatusViewer() {
  document.getElementById("modal-status-viewer").classList.add("hidden");
  if (statusTimer) clearTimeout(statusTimer);
}

/* Mensajes Destacados */
function loadStarredMessages() {
  const container = document.getElementById("starred-list");
  let starredList = JSON.parse(localStorage.getItem("starred_messages") || "[]");

  if (starredList.length === 0) {
    container.innerHTML = '<div class="empty-state">No tienes mensajes destacados guardados.</div>';
    return;
  }

  container.innerHTML = starredList.map(m => `
    <div class="starred-item" onclick="openChatRoom('${m.partner}')">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="font-weight:600; color:var(--accent-green); font-size:13px;">${m.partner}</span>
        <span style="font-size:11px; color:var(--text-secondary);">${m.time || ''}</span>
      </div>
      <div style="font-size:13px; color:var(--text-primary);">${m.text}</div>
    </div>
  `).join("");
}

function switchAuthTab(tab) {
  currentAuthTab = tab;
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("btn-auth-text").textContent = tab === "login" ? "Iniciar Sesión" : "Registrarse";
  document.getElementById("auth-error").classList.add("hidden");
}

let pendingTempToken = null;
let currentNickAttempt = null;

async function handleAuthSubmit(e) {
  e.preventDefault();
  const nick = document.getElementById("input-nick").value.trim();
  const password = document.getElementById("input-password").value.trim();
  const twofaCode = document.getElementById("input-2fa").value.trim();
  const errorEl = document.getElementById("auth-error");

  if (!nick || !password) return;

  try {
    errorEl.classList.add("hidden");

    if (currentAuthTab === "login") {
      if (pendingTempToken && twofaCode) {
        await PapuApi.confirm2FA(pendingTempToken, twofaCode);
        pendingTempToken = null;
        localStorage.setItem("papuwhats_nick", currentNickAttempt);
        showMainScreen(currentNickAttempt);
        return;
      }

      const res = await PapuApi.login(nick, password);

      if (res.twofaRequired) {
        pendingTempToken = res.tempToken;
        currentNickAttempt = nick;
        document.getElementById("group-2fa").classList.remove("hidden");
        document.getElementById("input-2fa").focus();
        errorEl.textContent = "Tu cuenta requiere verificación 2FA. Ingresa tu código de 6 dígitos.";
        errorEl.classList.remove("hidden");
        return;
      }

      localStorage.setItem("papuwhats_nick", nick);
      showMainScreen(nick);
    } else {
      await PapuApi.register(nick, password);
      localStorage.setItem("papuwhats_nick", nick);
      showMainScreen(nick);
    }

    if (window.AndroidNative && window.AndroidNative.vibratePhone) {
      window.AndroidNative.vibratePhone();
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
}

function logout() {
  PapuApi.clearToken();
  localStorage.removeItem("papuwhats_nick");
  showAuthScreen();
}

function filterChats() {
  const query = document.getElementById("search-chats").value.toLowerCase();
  const chatItems = document.querySelectorAll(".chat-item");

  chatItems.forEach(item => {
    const nick = item.querySelector(".chat-name").textContent.toLowerCase();
    item.style.display = nick.includes(query) ? "flex" : "none";
  });
}
