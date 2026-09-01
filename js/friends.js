let currentFriends = [];
let pendingRequests = [];

async function loadSocialData() {
  const myNick = localStorage.getItem("papuwhats_nick");
  if (!myNick) return;

  let profileFriends = [];
  try {
    const profile = await PapuApi.getUserProfile(myNick);
    if (profile) {
      let extra = profile.secretAchievements || profile.secret_achievements || {};
      if (Array.isArray(extra)) extra = {};
      profileFriends = extra.friends || [];
      pendingRequests = extra.friend_requests_pending || [];
    }
  } catch (err) {
    console.warn("Error cargando perfil:", err);
  }

  // 1. Intentar obtener amigos desde la API de PapusBank / PapuWhats
  try {
    const backendFriends = await PapuApi.fetchFriends();
    if (backendFriends && Array.isArray(backendFriends)) {
      const apiFriendNicks = backendFriends.map(f => typeof f === "string" ? f : (f.nick || f.username || f.friendNick)).filter(Boolean);
      profileFriends = Array.from(new Set([...profileFriends, ...apiFriendNicks]));
    }
  } catch (e) {}

  // 2. Si no hay amigos en profile/backend, rescatar personas con las que has chateado
  try {
    const msgs = await PapuApi.fetchPrivateMessages();
    if (Array.isArray(msgs)) {
      msgs.forEach(m => {
        const f = m.from || m.fromNick || m.from_nick || "";
        const t = m.to || m.toNick || m.to_nick || "";
        if (f.toLowerCase() === myNick.toLowerCase() && t && !t.includes("AI") && !t.includes("??")) {
          profileFriends.push(t);
        } else if (t.toLowerCase() === myNick.toLowerCase() && f && !f.includes("AI") && !f.includes("??")) {
          profileFriends.push(f);
        }
      });
    }
  } catch (e) {}

  // Filtrar duplicados insensible a mayúsculas
  const uniqueFriendsMap = new Map();
  profileFriends.forEach(f => {
    if (f && f.toLowerCase() !== myNick.toLowerCase()) {
      if (!uniqueFriendsMap.has(f.toLowerCase())) {
        uniqueFriendsMap.set(f.toLowerCase(), f);
      }
    }
  });

  currentFriends = Array.from(uniqueFriendsMap.values());

  // Sincronizar avatares de todos los amigos
  for (const fNick of [...currentFriends, ...pendingRequests]) {
    if (!localStorage.getItem(`avatar_${fNick.toLowerCase()}`)) {
      PapuApi.getUserProfile(fNick).then(p => {
        if (p) {
          const fExtra = p.secretAchievements || p.secret_achievements || {};
          if (fExtra.avatar) {
            localStorage.setItem(`avatar_${fNick.toLowerCase()}`, fExtra.avatar);
          }
        }
      });
    }
  }

  renderFriendsList();
  renderRequestsList();
}

function renderFriendsList() {
  const container = document.getElementById("friends-list");
  if (!currentFriends || currentFriends.length === 0) {
    container.innerHTML = '<div class="empty-state">No has agregado amigos aún.</div>';
    return;
  }

  container.innerHTML = currentFriends.map(friendNick => {
    const customAvatar = localStorage.getItem(`avatar_${friendNick.toLowerCase()}`);
    const avatarHtml = customAvatar 
      ? `<img src="${customAvatar}" class="avatar-circle-img">`
      : `<div class="avatar-circle">${friendNick.charAt(0).toUpperCase()}</div>`;

    return `
      <div class="friend-item" onclick="openChatRoom('${friendNick}')">
        ${avatarHtml}
        <div class="chat-info">
          <div class="chat-name">${friendNick}</div>
          <div class="chat-last-msg">Toca para enviar un mensaje privado</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRequestsList() {
  const container = document.getElementById("requests-list");
  const badge = document.getElementById("badge-requests");

  if (!pendingRequests || pendingRequests.length === 0) {
    container.innerHTML = '<div class="empty-state">No tienes solicitudes pendientes.</div>';
    badge.classList.add("hidden");
    return;
  }

  badge.textContent = pendingRequests.length;
  badge.classList.remove("hidden");

  container.innerHTML = pendingRequests.map(fromNick => {
    const customAvatar = localStorage.getItem(`avatar_${fromNick.toLowerCase()}`);
    const avatarHtml = customAvatar 
      ? `<img src="${customAvatar}" class="avatar-circle-img">`
      : `<div class="avatar-circle">${fromNick.charAt(0).toUpperCase()}</div>`;

    return `
      <div class="friend-item">
        ${avatarHtml}
        <div class="chat-info">
          <div class="chat-name">${fromNick}</div>
          <div class="chat-last-msg">Te ha enviado una solicitud</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="primary-btn" style="padding:6px 12px; font-size:12px;" onclick="acceptFriendRequest('${fromNick}')">Aceptar</button>
        </div>
      </div>
    `;
  }).join("");
}

function showAddFriendModal() {
  document.getElementById("modal-add-friend").classList.remove("hidden");
  document.getElementById("input-friend-nick").focus();
}

function hideAddFriendModal() {
  document.getElementById("modal-add-friend").classList.add("hidden");
  document.getElementById("input-friend-nick").value = "";
  document.getElementById("modal-friend-error").classList.add("hidden");
}

async function sendFriendRequest() {
  const targetNick = document.getElementById("input-friend-nick").value.trim();
  const errorEl = document.getElementById("modal-friend-error");
  const myNick = localStorage.getItem("papuwhats_nick");

  if (!targetNick) return;
  if (targetNick.toLowerCase() === myNick.toLowerCase()) {
    errorEl.textContent = "No puedes enviarte una solicitud a ti mismo.";
    errorEl.classList.remove("hidden");
    return;
  }

  const targetProfile = await PapuApi.getUserProfile(targetNick);
  if (!targetProfile) {
    errorEl.textContent = "El usuario no existe en PapusBank.";
    errorEl.classList.remove("hidden");
    return;
  }

  let targetExtra = targetProfile.secretAchievements || targetProfile.secret_achievements || {};
  if (Array.isArray(targetExtra)) targetExtra = {};

  let reqs = targetExtra.friend_requests_pending || [];
  if (!reqs.includes(myNick)) {
    reqs.push(myNick);
  }
  targetExtra.friend_requests_pending = reqs;

  // 1. Intentar llamar al backend nativo de PapusBank
  try {
    await PapuApi.sendFriendRequest(targetNick);
  } catch (e) {}

  // 2. Mantener sincronizado en secretAchievements
  await PapuApi.updateUser(targetNick, { secretAchievements: targetExtra });
  hideAddFriendModal();

  if (window.AndroidNative && window.AndroidNative.vibratePhone) {
    window.AndroidNative.vibratePhone();
  }
  alert("Solicitud de amistad enviada exitosamente.");
}

async function acceptFriendRequest(fromNick) {
  const myNick = localStorage.getItem("papuwhats_nick");
  const myProfile = await PapuApi.getUserProfile(myNick);
  const fromProfile = await PapuApi.getUserProfile(fromNick);

  let myExtra = myProfile.secretAchievements || myProfile.secret_achievements || {};
  let fromExtra = fromProfile.secretAchievements || fromProfile.secret_achievements || {};
  if (Array.isArray(myExtra)) myExtra = {};
  if (Array.isArray(fromExtra)) fromExtra = {};

  // 1. Intentar aceptar en el backend nativo de PapusBank
  try {
    await PapuApi.acceptFriendRequest(fromNick);
  } catch (e) {}

  // 2. Agregar a lista de amigos mutua en secretAchievements
  let myFriends = myExtra.friends || [];
  if (!myFriends.includes(fromNick)) myFriends.push(fromNick);
  myExtra.friends = myFriends;

  // Remover de solicitudes pendientes
  myExtra.friend_requests_pending = (myExtra.friend_requests_pending || []).filter(n => n !== fromNick);

  let fromFriends = fromExtra.friends || [];
  if (!fromFriends.includes(myNick)) fromFriends.push(myNick);
  fromExtra.friends = fromFriends;

  await PapuApi.updateUser(myNick, { secretAchievements: myExtra });
  await PapuApi.updateUser(fromNick, { secretAchievements: fromExtra });

  await loadSocialData();
}
