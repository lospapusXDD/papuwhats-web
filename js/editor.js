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

let isCropping = false;
let canvasSnapshotBeforeCrop = null;

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
      isCropping = true;
      cropStart = pos;
      cropEnd = pos;
      canvasSnapshotBeforeCrop = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    } else if (editorMode === 'crop' && isCropping && cropStart) {
      e.preventDefault();
      cropEnd = getCanvasPos(e);

      // Restaurar imagen previa y dibujar la caja de recorte visible en tiempo real
      if (canvasSnapshotBeforeCrop) {
        ctx.putImageData(canvasSnapshotBeforeCrop, 0, 0);
      }

      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);

      // Sombra oscura fuera de la selección
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, y); // Arriba
      ctx.fillRect(0, y, x, h); // Izquierda
      ctx.fillRect(x + w, y, canvas.width - (x + w), h); // Derecha
      ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h)); // Abajo

      // Borde verde brillante punteado y esquinas
      ctx.strokeStyle = "#00a884";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  };

  canvas.onmouseup = canvas.ontouchend = (e) => {
    if (editorMode === 'draw') {
      isDrawing = false;
    } else if (editorMode === 'crop' && isCropping && cropStart && cropEnd) {
      isCropping = false;
      if (canvasSnapshotBeforeCrop) {
        ctx.putImageData(canvasSnapshotBeforeCrop, 0, 0);
      }
      executeCrop(cropStart, cropEnd);
      cropStart = null;
      cropEnd = null;
      canvasSnapshotBeforeCrop = null;
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

  if (w < 20 || h < 20) return; // Evitar recortes accidentales

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
