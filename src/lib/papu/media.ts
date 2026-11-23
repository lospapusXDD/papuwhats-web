export async function fileToImageUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 960;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const size = 4096;
  for (let i = 0; i < bytes.length; i += size) {
    bin += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

export async function fileToDataUrl(file: File) {
  return blobToDataUrl(file);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function paletteCard() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
    <rect width="800" height="480" fill="#0C0B09"/>
    <rect x="36" y="36" width="240" height="408" rx="28" fill="#F3EFE6"/>
    <rect x="292" y="36" width="220" height="192" rx="28" fill="#E2A15A"/>
    <rect x="292" y="248" width="220" height="196" rx="28" fill="#1B5C3D"/>
    <rect x="528" y="36" width="236" height="408" rx="28" fill="#A34132"/>
    <text x="60" y="390" fill="#0C0B09" font-family="Georgia, serif" font-size="32">Hueso</text>
    <text x="316" y="150" fill="#0C0B09" font-family="Georgia, serif" font-size="32">Ámbar</text>
    <text x="316" y="360" fill="#F3EFE6" font-family="Georgia, serif" font-size="32">Musgo</text>
    <text x="552" y="390" fill="#F3EFE6" font-family="Georgia, serif" font-size="32">Arcilla</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
