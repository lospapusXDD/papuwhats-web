const LOGO_EMOJI_LIST = [
  '👑','💎','⚡','🔥','⭐','✨','🚀','🏆','🥇','🎖️',
  '🛡️','⚔️','🔑','🎯','👾','🎮','🤖','🌐','💻','📱',
  '🔮','🎨','🎭','📢','💬','💭','🔔','⚜️','💠','🌀',
  '💖','❤️‍🔥','🖤','💚','💙','💜','💯','🗿','🤌','🫡'
];

const DEFAULT_STICKERS = [
  'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712038.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712040.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712043.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712046.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712053.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712057.png',
  'https://cdn-icons-png.flaticon.com/512/4712/4712061.png'
];

// Base de datos IndexedDB para soportar miles de stickers sin límite de 5MB
const DB_NAME = 'PapuWhatsStickersDB';
const STORE_NAME = 'stickers';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveStickerToDB(dataUrl) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(dataUrl);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
window.saveStickerToDB = saveStickerToDB;

async function getAllStickersFromDB() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

let activeTabPicker = 'emojis';
let emojiPickerOpen = false;

function toggleEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  emojiPickerOpen = !emojiPickerOpen;
  picker.classList.toggle('hidden', !emojiPickerOpen);
  if (emojiPickerOpen) {
    switchPickerTab(activeTabPicker);
  }
}

async function switchPickerTab(tab) {
  activeTabPicker = tab;
  document.getElementById('picker-tab-emojis').classList.toggle('active', tab === 'emojis');
  document.getElementById('picker-tab-stickers').classList.toggle('active', tab === 'stickers');
  
  const content = document.getElementById('picker-content');
  if (tab === 'emojis') {
    content.className = 'emoji-grid';
    content.innerHTML = LOGO_EMOJI_LIST.map(e =>
      `<span class="emoji-item" onclick="insertEmoji('${e}')">${e}</span>`
    ).join('');
    const extRow = document.getElementById('external-sticker-row');
    if (extRow) extRow.remove();
  } else {
    content.className = 'sticker-grid';
    content.innerHTML = '<div style="color:var(--text-secondary); padding:10px; font-size:12px;">Cargando colección...</div>';

    let userStickers = [];
    try {
      userStickers = await getAllStickersFromDB();
    } catch (e) {
      userStickers = JSON.parse(localStorage.getItem('my_custom_stickers') || '[]');
    }

    let allStickersHtml = '';

    // Botón 1: Importar stickers masivos (.webp / WhatsApp Stickers)
    allStickersHtml += `
      <label class="create-sticker-btn" title="Importar Pack de Stickers" style="background: rgba(0, 168, 132, 0.15); border-color: var(--accent-green);">
        <input type="file" accept=".webp,image/*" multiple onchange="importMultipleStickers(event)" style="display:none;">
        <span style="font-size:10px; text-align:center;">📥 Importar<br>Pack (${userStickers.length})</span>
      </label>
    `;

    // Botón 2: Crear 1 sticker
    allStickersHtml += `
      <label class="create-sticker-btn" title="Crear 1 Sticker">
        <input type="file" accept="image/*" onchange="createCustomSticker(event)" style="display:none;">
        <span>➕ Crear</span>
      </label>
    `;

    // Renderizar con lazy loading nativo
    userStickers.forEach((stUrl) => {
      allStickersHtml += `<img src="${stUrl}" loading="lazy" class="sticker-item" onclick="sendSticker('${stUrl}')" onerror="this.style.display='none'">`;
    });

    DEFAULT_STICKERS.forEach(stUrl => {
      allStickersHtml += `<img src="${stUrl}" loading="lazy" class="sticker-item" onclick="sendSticker('${stUrl}')" onerror="this.style.display='none'">`;
    });

    content.innerHTML = allStickersHtml;

    let extRow = document.getElementById('external-sticker-row');
    if (!extRow) {
      extRow = document.createElement('div');
      extRow.id = 'external-sticker-row';
      extRow.className = 'add-external-sticker-row';
      extRow.innerHTML = `
        <input type="text" id="input-external-sticker" placeholder="Pega URL de imagen o sticker...">
        <button onclick="addExternalSticker()">Agregar</button>
      `;
      document.getElementById('emoji-picker').appendChild(extRow);
    }
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById('chat-input');
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const text = input.value;
  input.value = text.substring(0, start) + emoji + text.substring(end);
  input.selectionStart = input.selectionEnd = start + emoji.length;
  input.focus();
}

function sendSticker(stickerUrl) {
  toggleEmojiPicker();
  if (window.sendStickerMessage) {
    window.sendStickerMessage(stickerUrl);
  }
}

async function createCustomSticker(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    const base64Img = event.target.result;
    try {
      await saveStickerToDB(base64Img);
    } catch (err) {}
    switchPickerTab('stickers');
    sendSticker(base64Img);
  };
  reader.readAsDataURL(file);
}

/* Importar CIENTOS de Stickers a alta velocidad sin congelar la app */
async function importMultipleStickers(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  const content = document.getElementById('picker-content');
  content.innerHTML = `<div style="color:var(--accent-green); padding:16px; font-size:12px; font-weight:600; text-align:center;">Guardando ${files.length} stickers... ⏳</div>`;

  let count = 0;
  for (const file of files) {
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          await saveStickerToDB(event.target.result);
        } catch (err) {}
        count++;
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  switchPickerTab('stickers');
  if (window.AndroidNative && window.AndroidNative.vibratePhone) {
    window.AndroidNative.vibratePhone();
  }
  alert(`¡${files.length} stickers importados exitosamente!`);
}

async function addExternalSticker() {
  const input = document.getElementById('input-external-sticker');
  const url = (input.value || '').trim();
  if (!url) return;

  if (!url.startsWith('http')) {
    alert('Pega una URL válida de un sticker (debe empezar con http o https)');
    return;
  }

  try {
    await saveStickerToDB(url);
  } catch (err) {}
  input.value = '';
  switchPickerTab('stickers');
}

async function onExternalStickerImported(dataUrl) {
  try {
    await saveStickerToDB(dataUrl);
  } catch (err) {}
  if (emojiPickerOpen && activeTabPicker === 'stickers') {
    switchPickerTab('stickers');
  }
  if (window.AndroidNative && window.AndroidNative.vibratePhone) {
    window.AndroidNative.vibratePhone();
  }
  alert("¡Sticker importado y guardado en tu colección de papuWhats!");
}
window.onExternalStickerImported = onExternalStickerImported;
