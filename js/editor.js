// Editor de Imágenes: Lápiz para dibujar y herramienta para recortar
let editorOriginalImage = null;
let editorMode = 'draw'; // 'draw' o 'crop'
let drawColor = '#00a884';
let isDrawing = false;
let cropStart = null;
let cropEnd = null;

function openPhotoEditor(dataUrl) {
  const modal = document.getElementById("modal-photo-editor");
  modal.classList.remove("hidden");

  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");

  const img = new Image();
  img.onload = function() {
    editorOriginalImage = img;
    // Ajustar resolución máxima del canvas manteniendo proporción
    const maxW = Math.min(window.innerWidth - 30, 800);
    const maxH = Math.min(window.innerHeight - 120, 900);
    let w = img.width;
    let h = img.height;
    const ratio = Math.min(maxW / w, maxH / h, 1);

    canvas.width = w * ratio;
    canvas.height = h * ratio;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    initEditorEvents();
  };
  img.src = dataUrl;
}

function initEditorEvents() {
  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");

  // Touch & Mouse Support
  let lastX = 0, lastY = 0;

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  canvas.onmousedown = canvas.ontouchstart = (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (editorMode === 'draw') {
      isDrawing = true;
      lastX = pos.x;
      lastY = pos.y;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = drawColor;
      ctx.fill();
    } else if (editorMode === 'crop') {
      cropStart = pos;
      cropEnd = pos;
    }
  };

  canvas.onmousemove = canvas.ontouchmove = (e) => {
    if (editorMode === 'draw' && isDrawing) {
      e.preventDefault();
      const pos = getCanvasPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    } else if (editorMode === 'crop' && cropStart) {
      e.preventDefault();
      cropEnd = getCanvasPos(e);
    }
  };

  canvas.onmouseup = canvas.ontouchend = (e) => {
    if (editorMode === 'draw') {
      isDrawing = false;
    } else if (editorMode === 'crop' && cropStart && cropEnd) {
      executeCrop(cropStart, cropEnd);
      cropStart = null;
      cropEnd = null;
    }
  };
}

function executeCrop(start, end) {
  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  if (w < 20 || h < 20) return; // Evitar recortes microscópicos accidentales

  const croppedData = ctx.getImageData(x, y, w, h);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(croppedData, 0, 0);

  // Volver a modo dibujar tras recortar
  setEditorMode('draw');
}

function setEditorMode(mode) {
  editorMode = mode;
  document.getElementById("tool-draw-btn").classList.toggle("active", mode === 'draw');
  document.getElementById("tool-crop-btn").classList.toggle("active", mode === 'crop');
}

function setDrawColor(color) {
  drawColor = color;
  setEditorMode('draw');
}

function resetEditorCanvas() {
  if (!editorOriginalImage) return;
  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");
  const maxW = Math.min(window.innerWidth - 30, 800);
  const maxH = Math.min(window.innerHeight - 120, 900);
  const ratio = Math.min(maxW / editorOriginalImage.width, maxH / editorOriginalImage.height, 1);
  canvas.width = editorOriginalImage.width * ratio;
  canvas.height = editorOriginalImage.height * ratio;
  ctx.drawImage(editorOriginalImage, 0, 0, canvas.width, canvas.height);
}

function cancelPhotoEdit() {
  document.getElementById("modal-photo-editor").classList.add("hidden");
  editorOriginalImage = null;
}

async function sendEditedPhoto() {
  const canvas = document.getElementById("editor-canvas");
  const finalDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  document.getElementById("modal-photo-editor").classList.add("hidden");
  editorOriginalImage = null;

  if (window.sendEditedImageDirectly) {
    await window.sendEditedImageDirectly(finalDataUrl);
  }
}
