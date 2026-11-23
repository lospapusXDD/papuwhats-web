/**
 * Background & System Notification Engine for PapuWhats
 * Works across Desktop (Web/Electron), Mobile (Android PWA Service Worker), and background tabs.
 */

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export async function notifyUser(
  title: string,
  options: {
    body?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: any;
    requireInteraction?: boolean;
  } = {}
) {
  if (typeof window === "undefined") return;

  const isElectron =
    typeof navigator !== "undefined" &&
    (navigator.userAgent.toLowerCase().includes("electron") || Boolean((window as any).process?.versions?.electron));

  // En navegadores web tradicionales, verificar permisos
  if (!isElectron) {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      } catch {}
    }
    if ("Notification" in window && Notification.permission !== "granted") {
      return;
    }
  }

  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname.replace(/\/+$/, "") : "";
  const iconUrl = options.icon || `${base}/icon-192.png`;
  const badgeUrl = options.badge || `${base}/icon-192.png`;

  const notifOptions: NotificationOptions = {
    body: options.body || "Nuevo mensaje en PapuWhats",
    icon: iconUrl,
    badge: badgeUrl,
    tag: options.tag || "papuwhats-msg",
    vibrate: [200, 100, 200, 100, 250],
    requireInteraction: options.requireInteraction ?? (options.tag === "call"),
    data: options.data || { url: typeof window !== "undefined" ? window.location.href : "" },
  };

  // 1. En Electron: emitir la notificación nativa DIRECTA (sin depender de ServiceWorker)
  if (isElectron) {
    try {
      const n = new Notification(title, notifOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return;
    } catch (err) {
      console.warn("[Electron Notification error]:", err);
    }
  }

  // 2. En móviles Android / PWA: usar el Service Worker activo si existe (sin bloquear)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 300)),
      ]);
      if (reg && reg.active && typeof reg.showNotification === "function") {
        await reg.showNotification(title, notifOptions);
        return;
      }
    } catch (swErr) {
      console.warn("[SW showNotification error]:", swErr);
    }
  }

  // 3. Fallback directo en escritorio / navegador estándar
  if ("Notification" in window && (isElectron || Notification.permission === "granted")) {
    try {
      const n = new Notification(title, notifOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (nErr) {
      console.warn("[Standard Notification fallback]:", nErr);
    }
  }
}
