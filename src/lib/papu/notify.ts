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
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "default") {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  if (Notification.permission !== "granted") return;

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
    data: options.data || { url: window.location.href },
  };

  // 1. Mandatory for Android / PWA in background: ServiceWorkerRegistration.showNotification()
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, notifOptions);
        return;
      }
    }
  } catch (swErr) {
    console.warn("[SW Notification warning]:", swErr);
  }

  // 2. Desktop fallback (Electron, Windows, Linux, Mac browsers)
  try {
    const n = new Notification(title, notifOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (nErr) {
    console.warn("[Standard Notification warning]:", nErr);
  }
}
