let activeChatPartner = null;
let chatPollingInterval = null;
let seenMessageIds = new Set();
let selectedMessageId = null;
let selectedMessageData = null;
let userIsScrolledUp = false;
let currentQuotedMessage = null; // Mensaje citado/respondido

// Grabador de Voz WhatsApp Custom HD
let voiceRecorderStream = null;
let voiceMediaRecorder = null;
let voiceAudioChunks = [];
let voiceRecordingStartTime = 0;
let voiceTimerInterval = null;
let currentPlayingAudio = null;
let currentAudioPlaybackRate = 1; // 1x, 1.5x, 2x

const PLAY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const PAUSE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

function openChatRoom(targetNick) {
  activeChatPartner = targetNick;
  document.getElementById("chat-target-nick").textContent = targetNick;
  
  const targetAvatarEl = document.getElementById("chat-target-avatar");
  const customAvatar = localStorage.getItem(`avatar_${targetNick.toLowerCase()}`);
  if (customAvatar) {
    targetAvatarEl.innerHTML = `<img src="${customAvatar}" class="avatar-circle-img">`;
  } else {
    targetAvatarEl.textContent = targetNick.charAt(0).toUpperCase();
  }

  // Cargar fondo personalizado si existe
  applyCustomChatWallpaper();

  document.getElementById("chat-room").classList.add("active");
  const chatContainer = document.getElementById("messages-container");
  chatContainer.innerHTML = "";
  seenMessageIds.clear();
  userIsScrolledUp = false;
  cancelReplyQuote();

  chatContainer.onscroll = () => {
    const threshold = 60;
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold;
    userIsScrolledUp = !isAtBottom;
  };

  // Input typing listener
  const chatInput = document.getElementById("chat-input");
  chatInput.oninput = () => {
    broadcastTyping(chatInput.value.length > 0);
  };

  updateChatOnlineStatus(targetNick);
  loadChatMessages(true);
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  chatPollingInterval = setInterval(() => {
    loadChatMessages(false);
    updateChatOnlineStatus(targetNick);
  }, 2000);
}

let typingTimeout = null;
function broadcastTyping(isTyping) {
  const myNick = localStorage.getItem("papuwhats_nick");
  if (!myNick) return;

  if (typingTimeout) clearTimeout(typingTimeout);
  PapuApi.sendHeartbeat(myNick, { typing_to: isTyping ? activeChatPartner : null });

  if (isTyping) {
    typingTimeout = setTimeout(() => {
      PapuApi.sendHeartbeat(myNick, { typing_to: null });
    }, 4000);
  }
}

async function updateChatOnlineStatus(targetNick) {
  const statusEl = document.getElementById("chat-target-sub");
  if (!statusEl) return;

  const info = await PapuApi.getUserStatusInfo(targetNick);
  const myNick = (localStorage.getItem("papuwhats_nick") || "").toLowerCase();

  if (info.recordingTo && info.recordingTo.toLowerCase() === myNick) {
    statusEl.innerHTML = `🎤 <span style="color:#25d366; font-weight:600;">grabando audio...</span>`;
  } else if (info.typingTo && info.typingTo.toLowerCase() === myNick) {
    statusEl.innerHTML = `✍️ <span style="color:#25d366; font-weight:600;">escribiendo...</span>`;
  } else if (info.online) {
    statusEl.textContent = "En línea";
    statusEl.style.color = "#00a884";
  } else {
    statusEl.textContent = "Desconectado";
    statusEl.style.color = "var(--text-secondary)";
  }
}

function closeChatRoom() {
  document.getElementById("chat-room").classList.remove("active");
  activeChatPartner = null;
  cancelReplyQuote();
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio = null;
  }
  const searchBar = document.getElementById("chat-search-bar");
  if (searchBar) searchBar.classList.add("hidden");
  broadcastTyping(false);
  loadRecentChats();
}

function toggleChatSearch() {
  const bar = document.getElementById("chat-search-bar");
  bar.classList.toggle("hidden");
  if (!bar.classList.contains("hidden")) {
    document.getElementById("chat-search-input").focus();
  } else {
    document.getElementById("chat-search-input").value = "";
    filterChatMessages();
  }
}

function filterChatMessages() {
  const query = (document.getElementById("chat-search-input").value || "").toLowerCase();
  const bubbles = document.querySelectorAll("#messages-container .message-bubble");
  bubbles.forEach(b => {
    const text = b.textContent.toLowerCase();
    b.style.display = (!query || text.includes(query)) ? "block" : "none";
  });
}

/* Fondos de Pantalla Personalizados */
function changeChatWallpaper(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const bgUrl = event.target.result;
    localStorage.setItem("papuwhats_chat_bg", bgUrl);
    applyCustomChatWallpaper();
    alert("¡Fondo de chat actualizado!");
  };
  reader.readAsDataURL(file);
}

function applyCustomChatWallpaper() {
  const bg = localStorage.getItem("papuwhats_chat_bg");
  const container = document.getElementById("messages-container");
  if (bg && container) {
    container.style.backgroundImage = `url("${bg}")`;
    container.style.backgroundSize = "cover";
    container.style.backgroundPosition = "center";
  }
}

/* Responder / Citar Mensaje */
function startReplyToMessage() {
  if (!selectedMessageData) return;

  let cleanQuoteText = selectedMessageData.text || "";
  if (cleanQuoteText.startsWith("data:image/")) cleanQuoteText = "📷 Foto";
  else if (cleanQuoteText.startsWith("data:audio/")) cleanQuoteText = "🎤 Nota de voz";
  else if (cleanQuoteText.startsWith("STICKER:") || cleanQuoteText.startsWith("data:sticker/")) cleanQuoteText = "🎨 Sticker";
  else if (cleanQuoteText.length > 50) cleanQuoteText = cleanQuoteText.substring(0, 50) + "...";

  currentQuotedMessage = {
    id: selectedMessageData.id,
    user: selectedMessageData.partner,
    text: cleanQuoteText
  };

  const replyBar = document.getElementById("reply-preview-bar");
  document.getElementById("reply-preview-user").textContent = `Respondiendo a ${currentQuotedMessage.user}`;
  document.getElementById("reply-preview-text").textContent = cleanQuoteText;
  replyBar.classList.remove("hidden");

  hideMsgModal();
  document.getElementById("chat-input").focus();
}

function cancelReplyQuote() {
  currentQuotedMessage = null;
  const replyBar = document.getElementById("reply-preview-bar");
  if (replyBar) replyBar.classList.add("hidden");
}

/* Reaccionar a Mensaje con Emojis (Sincronizado remotamente) */
async function reactToMessage(emoji) {
  if (!selectedMessageId || !activeChatPartner) return;
  let allReactions = JSON.parse(localStorage.getItem("papuwhats_msg_reactions") || "{}");
  allReactions[selectedMessageId] = emoji;
  localStorage.setItem("papuwhats_msg_reactions", JSON.stringify(allReactions));

  hideMsgModal();

  // Transmitir reacción a la conversación como evento
  try {
    await PapuApi.sendPrivateMessage(activeChatPartner, `[REACT:${selectedMessageId}:${emoji}]`, "reaction");
  } catch (err) {}

  loadChatMessages(false);
}

async function loadChatMessages(forceScroll = false) {
  if (!activeChatPartner) return;
  const myNick = (localStorage.getItem("papuwhats_nick") || "").toLowerCase();

  try {
    const allMessages = await PapuApi.fetchPrivateMessages();
    const chatContainer = document.getElementById("messages-container");

    let deletedIds = JSON.parse(localStorage.getItem("deleted_msg_ids") || "[]");
    let starredIds = JSON.parse(localStorage.getItem("starred_msg_ids") || "[]");
    let reactionsMap = JSON.parse(localStorage.getItem("papuwhats_msg_reactions") || "{}");

    let privateMessages = allMessages.filter(msg => {
      const from = (msg.from || msg.fromNick || msg.from_nick || "").toLowerCase();
      const to = (msg.to || msg.toNick || msg.to_nick || "").toLowerCase();
      const partner = activeChatPartner.toLowerCase();
      const id = String(msg.id || msg._id || msg.createdAt);
      if (deletedIds.includes(id)) return false;

      // Si es un mensaje de reacción sincronizado, guardar en el mapa y no renderizar como burbuja
      const text = msg.msg || msg.text || "";
      if (text.startsWith("[REACT:")) {
        const parts = text.substring(7, text.length - 1).split(":");
        if (parts.length >= 2) {
          reactionsMap[parts[0]] = parts[1];
        }
        return false;
      }

      return (from === myNick && to === partner) || (from === partner && to === myNick);
    });

    privateMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    privateMessages.forEach(msg => {
      const msgId = String(msg.id || msg._id || msg.createdAt);
      if (!seenMessageIds.has(msgId)) {
        seenMessageIds.add(msgId);
      }
    });

    const isPartnerOnline = await PapuApi.checkUserOnline(activeChatPartner);

    // Renderizar mensajes con Doble Check, Respuestas, Reacciones y Velocidades
    chatContainer.innerHTML = privateMessages.map(msg => {
      const from = (msg.from || msg.fromNick || msg.from_nick || "").toLowerCase();
      const isOut = from === myNick;
      let text = msg.msg || msg.text || "";
      const mediaType = msg.mediaType || "";
      const msgId = String(msg.id || msg._id || msg.createdAt || "");
      const isStarred = starredIds.includes(msgId);
      const reactionEmoji = reactionsMap[msgId] || "";

      const timeStr = (msg.createdAt || msg.created_at || msg.timestamp) 
        ? new Date(msg.createdAt || msg.created_at || msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        : "";

      const checkColor = isPartnerOnline ? "#53bdeb" : "var(--text-secondary)";
      const checkHtml = isOut 
        ? `<span class="double-check" style="color:${checkColor}; margin-left:4px; font-size:11px; font-weight:700;">✓✓</span>` 
        : "";

      // Parsear si el mensaje incluía respuesta citada: [QUOTE:user:texto]
      let quoteHtml = "";
      if (text.startsWith("[QUOTE:")) {
        const endQuote = text.indexOf("]");
        if (endQuote !== -1) {
          const quoteRaw = text.substring(7, endQuote);
          const [qUser, ...qTextArr] = quoteRaw.split(":");
          const qText = qTextArr.join(":");
          quoteHtml = `
            <div class="message-quote-box">
              <span class="quote-user">${escapeHtml(qUser)}</span>
              <span class="quote-text">${escapeHtml(qText)}</span>
            </div>
          `;
          text = text.substring(endQuote + 1).trim();
        }
      }

      let contentHtml = "";
      const isSticker = mediaType === "sticker" || text.startsWith("STICKER:") || text.startsWith("data:sticker/") || (text.startsWith("http") && text.includes("sticker"));
      let stickerSrc = text;
      if (text.startsWith("STICKER:")) stickerSrc = text.replace("STICKER:", "");

      if (isSticker) {
        contentHtml = `
          <div class="sticker-msg-wrapper">
            <img src="${stickerSrc}" class="msg-sticker" onclick="promptSaveSticker('${stickerSrc}')" title="Toca para guardar sticker">
            <span class="sticker-save-hint">Toca para guardar</span>
          </div>
        `;
      } else if (text.startsWith("data:image/") || (text.startsWith("http") && text.match(/\.(jpeg|jpg|gif|png|webp)$/i))) {
        contentHtml = `<img src="${text}" class="msg-image" onclick="viewImage('${text}')">`;
      } else if (text.startsWith("data:audio/")) {
        contentHtml = `
          <div class="custom-voice-player">
            <button class="voice-play-btn" id="btn-play-${msgId}" onclick="playAudioBase64(this, '${msgId}')">${PLAY_SVG}</button>
            <div class="voice-waveform">
              <div class="voice-progress-bar" id="bar-${msgId}"></div>
            </div>
            <button class="audio-speed-btn" onclick="toggleAudioSpeed(event, '${msgId}')" title="Cambiar velocidad">1x</button>
            <input type="hidden" id="audio-data-${msgId}" value="${text}">
          </div>
        `;
      } else {
        contentHtml = `<span>${escapeHtml(text)}</span>`;
      }

      const reactionBadgeHtml = reactionEmoji ? `<div class="msg-reaction-badge">${reactionEmoji}</div>` : "";

      return `
        <div class="message-bubble ${isOut ? 'out' : 'in'} ${isSticker ? 'bubble-sticker' : ''}" data-id="${msgId}">
          ${quoteHtml}
          ${contentHtml}
          ${reactionBadgeHtml}
          <div class="msg-meta">
            ${isStarred ? '<span style="color:#ffd700; font-size:10px; margin-right:4px;">⭐</span>' : ''}
            <span class="msg-time">${timeStr}</span>
            ${checkHtml}
            <button class="msg-menu-btn" onclick="openMsgMenu(event, '${msgId}')">⋮</button>
          </div>
        </div>
      `;
    }).join("");

    if (forceScroll || !userIsScrolledUp) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  } catch (err) {
    console.error("Error al cargar chats:", err);
  }
}

async function sendChatMessage(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById("chat-input");
  let text = inputEl.value.trim();
  if (!text || !activeChatPartner) return;

  if (currentQuotedMessage) {
    text = `[QUOTE:${currentQuotedMessage.user}:${currentQuotedMessage.text}] ${text}`;
    cancelReplyQuote();
  }

  inputEl.value = "";
  broadcastTyping(false);

  try {
    await PapuApi.sendPrivateMessage(activeChatPartner, text);
    userIsScrolledUp = false;
    await loadChatMessages(true);
  } catch (err) {
    alert("Error al enviar mensaje: " + err.message);
  }
}

async function sendStickerMessage(stickerUrl) {
  if (!activeChatPartner || !stickerUrl) return;
  try {
    const formattedSticker = stickerUrl.startsWith("http") ? `STICKER:${stickerUrl}` : stickerUrl;
    await PapuApi.sendPrivateMessage(activeChatPartner, formattedSticker, "sticker");
    userIsScrolledUp = false;
    await loadChatMessages(true);
  } catch (err) {
    alert("Error al enviar sticker: " + err.message);
  }
}
window.sendStickerMessage = sendStickerMessage;

async function promptSaveSticker(stickerUrl) {
  if (confirm("¿Deseas guardar este sticker en tus favoritos de papuWhats?")) {
    if (window.saveStickerToDB) {
      await window.saveStickerToDB(stickerUrl);
      if (window.AndroidNative && window.AndroidNative.vibratePhone) {
        window.AndroidNative.vibratePhone();
      }
      alert("¡Sticker guardado en tu colección!");
    }
  }
}
window.promptSaveSticker = promptSaveSticker;

/* Envío de Fotos desde Galería (Pasa primero por el Editor) */
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file || !activeChatPartner) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const base64Data = event.target.result;
    openPhotoEditor(base64Data);
  };
  reader.readAsDataURL(file);
}

/* Abrir Cámara Nativa Directa de Android */
function triggerNativeCamera() {
  if (window.AndroidNative && window.AndroidNative.openCamera) {
    window.AndroidNative.openCamera();
  } else {
    alert("Función de cámara no disponible en este dispositivo.");
  }
}

function onCameraPhotoCaptured(dataUrl) {
  if (!activeChatPartner || !dataUrl) return;
  openPhotoEditor(dataUrl);
}

async function sendEditedImageDirectly(dataUrl) {
  if (!activeChatPartner || !dataUrl) return;
  try {
    await PapuApi.sendPrivateMessage(activeChatPartner, dataUrl, "image");
    userIsScrolledUp = false;
    await loadChatMessages(true);
  } catch (err) {
    alert("Error al enviar imagen: " + err.message);
  }
}
window.sendEditedImageDirectly = sendEditedImageDirectly;

/* Grabación de Audio HD */
async function startVoiceRecording() {
  const bar = document.getElementById("recording-bar");
  const timer = document.getElementById("recording-timer");
  const chatForm = document.getElementById("chat-form");

  try {
    voiceRecorderStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    });

    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 };
    }

    voiceMediaRecorder = new MediaRecorder(voiceRecorderStream, options);
    voiceAudioChunks = [];

    voiceMediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) voiceAudioChunks.push(e.data);
    };

    voiceMediaRecorder.onstop = async () => {
      if (voiceAudioChunks.length === 0) return;
      const mime = voiceMediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(voiceAudioChunks, { type: mime });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        await PapuApi.sendPrivateMessage(activeChatPartner, base64Audio, "audio");
        userIsScrolledUp = false;
        await loadChatMessages(true);
      };
      reader.readAsDataURL(audioBlob);
    };

    voiceMediaRecorder.start(100);
    voiceRecordingStartTime = Date.now();
    chatForm.classList.add("hidden");
    bar.classList.remove("hidden");

    // Transmitir que se está grabando audio
    const myNick = localStorage.getItem("papuwhats_nick");
    if (myNick) PapuApi.sendHeartbeat(myNick, { recording_to: activeChatPartner });

    voiceTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - voiceRecordingStartTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      timer.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    alert("Permite el acceso al micrófono para enviar notas de voz.");
  }
}

function cancelVoiceRecording() {
  const myNick = localStorage.getItem("papuwhats_nick");
  if (myNick) PapuApi.sendHeartbeat(myNick, { recording_to: null });

  if (voiceMediaRecorder && voiceMediaRecorder.state !== "inactive") {
    voiceAudioChunks = [];
    voiceMediaRecorder.stop();
    if (voiceRecorderStream) voiceRecorderStream.getTracks().forEach(t => t.stop());
  }
  stopVoiceUI();
}

function finishAndSendVoiceRecording() {
  const myNick = localStorage.getItem("papuwhats_nick");
  if (myNick) PapuApi.sendHeartbeat(myNick, { recording_to: null });

  if (voiceMediaRecorder && voiceMediaRecorder.state !== "inactive") {
    voiceMediaRecorder.stop();
    if (voiceRecorderStream) voiceRecorderStream.getTracks().forEach(t => t.stop());
  }
  stopVoiceUI();
}

function stopVoiceUI() {
  clearInterval(voiceTimerInterval);
  document.getElementById("recording-bar").classList.add("hidden");
  document.getElementById("chat-form").classList.remove("hidden");
  document.getElementById("recording-timer").textContent = "00:00";
}

/* Cambiar velocidad de Audio (1x, 1.5x, 2x) */
function toggleAudioSpeed(e, msgId) {
  e.stopPropagation();
  const btn = e.target;
  const rates = [1, 1.5, 2];
  let nextIdx = (rates.indexOf(currentAudioPlaybackRate) + 1) % rates.length;
  currentAudioPlaybackRate = rates[nextIdx];
  btn.textContent = `${currentAudioPlaybackRate}x`;

  if (currentPlayingAudio && currentPlayingAudio._msgId === msgId) {
    currentPlayingAudio.playbackRate = currentAudioPlaybackRate;
  }
}

/* Reproductor de Audio HD */
function playAudioBase64(btn, msgId) {
  const dataEl = document.getElementById(`audio-data-${msgId}`);
  const progressBar = document.getElementById(`bar-${msgId}`);
  if (!dataEl) return;

  const base64Src = dataEl.value;

  if (currentPlayingAudio && currentPlayingAudio._msgId === msgId) {
    if (currentPlayingAudio.paused) {
      currentPlayingAudio.play();
      btn.innerHTML = PAUSE_SVG;
    } else {
      currentPlayingAudio.pause();
      btn.innerHTML = PLAY_SVG;
    }
    return;
  }

  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    const prevBtn = document.getElementById(`btn-play-${currentPlayingAudio._msgId}`);
    if (prevBtn) prevBtn.innerHTML = PLAY_SVG;
  }

  const audio = new Audio(base64Src);
  audio._msgId = msgId;
  audio.playbackRate = currentAudioPlaybackRate;
  currentPlayingAudio = audio;

  audio.ontimeupdate = () => {
    if (audio.duration && progressBar) {
      const pct = (audio.currentTime / audio.duration) * 100;
      progressBar.style.width = `${pct}%`;
    }
  };

  audio.onended = () => {
    btn.innerHTML = PLAY_SVG;
    if (progressBar) progressBar.style.width = "0%";
    currentPlayingAudio = null;
  };

  audio.play().then(() => {
    btn.innerHTML = PAUSE_SVG;
  }).catch(err => {
    console.error("Error reproduciendo audio:", err);
    alert("No se pudo reproducir el audio en este dispositivo.");
  });
}

/* Modales para Editar, Eliminar y Destacar Mensajes */
function openMsgMenu(e, id) {
  e.stopPropagation();
  selectedMessageId = id;
  const bubble = e.target.closest('.message-bubble');
  const textSpan = bubble ? bubble.querySelector('span') : null;
  const currentText = textSpan ? textSpan.textContent : '';

  selectedMessageData = {
    id: id,
    text: currentText,
    partner: activeChatPartner,
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  };

  document.getElementById("edit-msg-input").value = currentText;
  
  let starredIds = JSON.parse(localStorage.getItem("starred_msg_ids") || "[]");
  const isStarred = starredIds.includes(id);
  document.getElementById("btn-star-msg").textContent = isStarred ? "Desmarcar" : "Destacar";

  document.getElementById("modal-msg-actions").classList.remove("hidden");
}

function hideMsgModal() {
  document.getElementById("modal-msg-actions").classList.add("hidden");
  selectedMessageId = null;
  selectedMessageData = null;
}

function toggleStarSelectedMessage() {
  if (!selectedMessageId) return;
  let starredList = JSON.parse(localStorage.getItem("starred_messages") || "[]");
  let starredIds = JSON.parse(localStorage.getItem("starred_msg_ids") || "[]");

  if (starredIds.includes(selectedMessageId)) {
    starredList = starredList.filter(m => m.id !== selectedMessageId);
    starredIds = starredIds.filter(i => i !== selectedMessageId);
  } else {
    starredList.unshift(selectedMessageData);
    starredIds.unshift(selectedMessageId);
  }

  localStorage.setItem("starred_messages", JSON.stringify(starredList));
  localStorage.setItem("starred_msg_ids", JSON.stringify(starredIds));
  hideMsgModal();
  loadChatMessages(false);
}

async function confirmEditMessage() {
  if (!selectedMessageId) return;
  const newText = document.getElementById("edit-msg-input").value.trim();
  if (!newText) return;

  try {
    await PapuApi.editMessage(selectedMessageId, newText);
    hideMsgModal();
    await loadChatMessages();
  } catch (err) {
    alert("Error al editar mensaje: " + err.message);
  }
}

async function confirmDeleteMessage() {
  if (!selectedMessageId) return;

  try {
    // 1. Intentar borrar en la API
    await PapuApi.deleteMessage(selectedMessageId);
  } catch (err) {
    console.warn("Borrado remoto no disponible, borrando localmente:", err);
  }

  // 2. Garantizar que desaparezca instantáneamente en la app
  let deletedIds = JSON.parse(localStorage.getItem("deleted_msg_ids") || "[]");
  deletedIds.push(selectedMessageId);
  localStorage.setItem("deleted_msg_ids", JSON.stringify(deletedIds));

  hideMsgModal();
  await loadChatMessages();
}

function viewImage(url) {
  window.open(url, '_blank');
}

async function loadRecentChats() {
  const myNick = (localStorage.getItem("papuwhats_nick") || "").toLowerCase();
  if (!myNick) return;

  const allMessages = await PapuApi.fetchPrivateMessages();
  const chatsMap = {};
  let deletedIds = JSON.parse(localStorage.getItem("deleted_msg_ids") || "[]");

  allMessages.forEach(msg => {
    const msgId = String(msg.id || msg._id || msg.createdAt);
    if (deletedIds.includes(msgId)) return;

    // Ignorar eventos de reacción para que no salgan como último mensaje en la lista
    const rawText = msg.msg || msg.text || "";
    if (rawText.startsWith("[REACT:")) return;

    const from = (msg.from || msg.fromNick || msg.from_nick || "").toLowerCase();
    const to = (msg.to || msg.toNick || msg.to_nick || "").toLowerCase();
    const time = msg.createdAt || msg.created_at || msg.timestamp;

    if (from === myNick || to === myNick) {
      const partner = from === myNick ? to : from;
      if (!chatsMap[partner] || new Date(time) > new Date(chatsMap[partner].timestamp || chatsMap[partner].createdAt || chatsMap[partner].created_at)) {
        chatsMap[partner] = msg;
      }
    }
  });

  const chatsList = document.getElementById("chats-list");
  const partners = Object.keys(chatsMap);

  if (partners.length === 0) {
    chatsList.innerHTML = '<div class="empty-state">No tienes chats activos. Agrega un amigo para iniciar a chatear.</div>';
    return;
  }

  chatsList.innerHTML = partners.map(partner => {
    const msg = chatsMap[partner];
    let text = msg.msg || msg.text || "";
    if (text.startsWith("data:audio/")) text = "🎤 Nota de voz";
    else if (text.startsWith("data:image/")) text = "📷 Foto";
    else if (text.startsWith("STICKER:") || text.startsWith("data:sticker/") || msg.mediaType === "sticker") text = "🎨 Sticker";

    const time = msg.createdAt || msg.created_at || msg.timestamp;
    const timeStr = time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
    const customAvatar = localStorage.getItem(`avatar_${partner.toLowerCase()}`);
    const avatarHtml = customAvatar 
      ? `<img src="${customAvatar}" class="avatar-circle-img">`
      : `<div class="avatar-circle">${partner.charAt(0).toUpperCase()}</div>`;

    return `
      <div class="chat-item" onclick="openChatRoom('${partner}')">
        ${avatarHtml}
        <div class="chat-info">
          <div class="chat-name-row">
            <span class="chat-name">${partner}</span>
            <span class="chat-time">${timeStr}</span>
          </div>
          <div class="chat-last-msg">${escapeHtml(text)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}
