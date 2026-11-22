import { makeVoiceSample } from "@/lib/papu/audio";
import { paletteCard } from "@/lib/papu/media";
import type { Account, CallRecord, Chat, Message, Story, UserData } from "@/lib/papu/types";

export const DEMO_ID = "usr_camilo";
export const DEMO_EMAIL = "camilo@papuwhats.app";
export const DEMO_PASSWORD = "papuwhats";
export const DEMO_NAME = "Camilo Duarte";

export const STORIES: Story[] = [
  { id: "st_valeria", name: "Valeria Ruiz", tone: "amber", text: "Cerrando tipos en el taller. Nada de adornos sueltos.", minutesAgo: 18 },
  { id: "st_mateo", name: "Mateo Herrera", tone: "bone", text: "Salgo en bici. Vuelvo al mediodía con el borrador.", minutesAgo: 46 },
  { id: "st_camila", name: "Camila Soto", tone: "moss", text: "Mezcla nueva. El final ya no está apurado.", minutesAgo: 90 },
  { id: "st_andres", name: "Andrés Peña", tone: "clay", text: "En reunión hasta las cuatro. Después miro la demo.", minutesAgo: 140 },
];

let voiceUrl: string | null = null;
function voice() {
  voiceUrl ??= makeVoiceSample(2.2);
  return voiceUrl;
}

function msg(partial: Omit<Message, "status"> & { status?: Message["status"] }): Message {
  return { status: "read", ...partial };
}

export function demoAccount(): Account {
  return {
    id: DEMO_ID,
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    about: "Disponible. Armando PapuWhats.",
  };
}

export function demoData(now = Date.now()): UserData {
  const min = (m: number) => now - m * 60_000;
  const chats: Chat[] = [
    {
      id: "valeria",
      title: "Valeria Ruiz",
      kind: "dm",
      tone: "amber",
      presence: "online",
      pinned: true,
      muted: false,
      about: "Dirección de marca",
      members: [{ id: "valeria", name: "Valeria Ruiz", about: "Dirección de marca", tone: "amber" }],
      lastReadAt: min(40),
      messages: [
        msg({ id: "v1", author: "them", kind: "text", body: "Camilo, dejé la lámina con tinta, hueso y ámbar. Sin verde de catálogo.", createdAt: min(180) }),
        msg({ id: "v2", author: "me", kind: "text", body: "Se lee serio. El isotipo de las dos burbujas funciona chico.", createdAt: min(150) }),
        msg({ id: "v3", author: "them", kind: "image", body: "Paleta cerrada", mediaUrl: paletteCard(), mediaName: "paleta-papuwhats.svg", createdAt: min(120) }),
        msg({ id: "v4", author: "me", kind: "text", body: "Arcilla solo para lo urgente. El resto se queda en ámbar.", createdAt: min(90), replyId: "v3" }),
        msg({ id: "v5", author: "them", kind: "text", body: "De acuerdo. Mañana exporto los iconos en trazo, no en dibujo.", createdAt: min(12), status: "delivered" }),
      ],
    },
    {
      id: "mateo",
      title: "Mateo Herrera",
      kind: "dm",
      tone: "bone",
      presence: "away",
      pinned: false,
      muted: false,
      about: "Taller y ruta",
      members: [{ id: "mateo", name: "Mateo Herrera", about: "Taller y ruta", tone: "bone" }],
      lastReadAt: min(5),
      messages: [
        msg({ id: "m1", author: "them", kind: "text", body: "¿Sigues para el jueves a la una?", createdAt: min(60 * 26) }),
        msg({ id: "m2", author: "me", kind: "text", body: "Sí. El sitio de siempre. Llevo la demo en el teléfono por si preguntan.", createdAt: min(60 * 25) }),
        msg({ id: "m3", author: "them", kind: "text", body: "Perfecto. Yo llevo el borrador del presupuesto, en papel.", createdAt: min(80) }),
        msg({ id: "m4", author: "me", kind: "text", body: "Entonces no hablamos de servidores. Solo del producto.", createdAt: min(40) }),
      ],
    },
    {
      id: "camila",
      title: "Camila Soto",
      kind: "dm",
      tone: "moss",
      presence: "online",
      pinned: false,
      muted: false,
      about: "Sonido",
      members: [{ id: "camila", name: "Camila Soto", about: "Sonido", tone: "moss" }],
      lastReadAt: min(200),
      messages: [
        msg({ id: "c1", author: "them", kind: "text", body: "Te dejé una nota corta. El tono de envío tiene que ser seco, no musical.", createdAt: min(240) }),
        msg({
          id: "c2",
          author: "them",
          kind: "voice",
          body: "Nota de voz",
          mediaUrl: voice(),
          durationMs: 2200,
          createdAt: min(230),
        }),
        msg({ id: "c3", author: "me", kind: "text", body: "La oí. El timbre de llamada puede ser un poco más largo, el de mensaje no.", createdAt: min(200) }),
        msg({ id: "c4", author: "them", kind: "call", body: "Videollamada", callKind: "video", callResult: "missed", createdAt: min(30), status: "delivered" }),
      ],
    },
    {
      id: "andres",
      title: "Andrés Peña",
      kind: "dm",
      tone: "clay",
      presence: "away",
      pinned: false,
      muted: true,
      about: "Cliente",
      members: [{ id: "andres", name: "Andrés Peña", about: "Cliente", tone: "clay" }],
      lastReadAt: min(10),
      messages: [
        msg({ id: "a1", author: "them", kind: "text", body: "El cliente pidió la demo navegable hoy. Sin cuentas reales.", createdAt: min(300) }),
        msg({ id: "a2", author: "me", kind: "text", body: "Login, código de dos pasos y la bandeja. Todo de ejemplo.", createdAt: min(260) }),
        msg({
          id: "a3",
          author: "them",
          kind: "file",
          body: "Alcance para la reunión",
          mediaName: "alcance-demo.pdf",
          createdAt: min(220),
        }),
        msg({ id: "a4", author: "me", kind: "text", body: "Lo leí. En el celular la lista ocupa la pantalla; el hilo entra al tocar.", createdAt: min(50) }),
      ],
    },
    {
      id: "taller",
      title: "Taller Norte",
      kind: "group",
      tone: "amber",
      presence: "online",
      pinned: true,
      muted: false,
      about: "Grupo de trabajo",
      members: [
        { id: "valeria", name: "Valeria Ruiz", about: "Marca", tone: "amber" },
        { id: "mateo", name: "Mateo Herrera", about: "Ruta", tone: "bone" },
        { id: "camila", name: "Camila Soto", about: "Sonido", tone: "moss" },
      ],
      lastReadAt: min(100),
      messages: [
        msg({ id: "t1", author: "them", senderName: "Valeria Ruiz", kind: "text", body: "Subí la retícula de avatares. Iniciales, no fotos de stock.", createdAt: min(400) }),
        msg({ id: "t2", author: "them", senderName: "Mateo Herrera", kind: "text", body: "Me parece. Se ve más editorial y carga más rápido.", createdAt: min(380) }),
        msg({ id: "t3", author: "me", kind: "text", body: "Hoy dejo listas las llamadas y el panel del código.", createdAt: min(300) }),
        msg({ id: "t4", author: "them", senderName: "Camila Soto", kind: "text", body: "Probé el audio de envío. Corto, seco, bien.", createdAt: min(20), status: "delivered" }),
      ],
    },
    {
      id: "papu",
      title: "PapuWhats",
      kind: "dm",
      tone: "moss",
      presence: "online",
      pinned: false,
      muted: false,
      about: "Cuenta de la demostración",
      members: [{ id: "papu", name: "PapuWhats", about: "Demostración", tone: "moss" }],
      lastReadAt: min(1),
      messages: [
        msg({
          id: "p1",
          author: "them",
          kind: "text",
          body: "Bienvenido. Esto es una demostración: mensajes, notas de voz, fotos y llamadas viven en este navegador.",
          createdAt: min(8),
        }),
        msg({
          id: "p2",
          author: "them",
          kind: "text",
          body: "La verificación en dos pasos ya está activa en el acceso. Cuando te guste, el mismo flujo se pasa a producción.",
          createdAt: min(6),
        }),
      ],
    },
  ];

  const calls: CallRecord[] = [
    { id: "call_1", chatId: "camila", title: "Camila Soto", tone: "moss", kind: "video", direction: "in", result: "missed", at: min(30), durationMs: 0 },
    { id: "call_2", chatId: "mateo", title: "Mateo Herrera", tone: "bone", kind: "voice", direction: "out", result: "ended", at: min(60 * 20), durationMs: 4 * 60_000 },
    { id: "call_3", chatId: "andres", title: "Andrés Peña", tone: "clay", kind: "voice", direction: "in", result: "ended", at: min(60 * 30), durationMs: 11 * 60_000 },
  ];

  return { about: demoAccount().about, sound: true, chats, calls, myStatus: null };
}

export function freshData(now = Date.now()): UserData {
  const min = (m: number) => now - m * 60_000;
  return {
    about: "Acabo de entrar a PapuWhats.",
    sound: true,
    myStatus: null,
    calls: [],
    chats: [
      {
        id: "papu",
        title: "PapuWhats",
        kind: "dm",
        tone: "moss",
        presence: "online",
        pinned: true,
        muted: false,
        about: "Cuenta de la demostración",
        members: [{ id: "papu", name: "PapuWhats", about: "Demostración", tone: "moss" }],
        lastReadAt: min(30),
        messages: [
          msg({
            id: "np1",
            author: "them",
            kind: "text",
            body: "Cuenta creada en este navegador. Escribe aquí para probar la respuesta, o abre una llamada desde el icono.",
            createdAt: min(2),
            status: "delivered",
          }),
        ],
      },
      {
        id: "valeria",
        title: "Valeria Ruiz",
        kind: "dm",
        tone: "amber",
        presence: "online",
        pinned: false,
        muted: false,
        about: "Dirección de marca",
        members: [{ id: "valeria", name: "Valeria Ruiz", about: "Dirección de marca", tone: "amber" }],
        lastReadAt: min(60),
        messages: [
          msg({
            id: "nv1",
            author: "them",
            kind: "text",
            body: "Cuando quieras revisamos la marca. Esta conversación es de ejemplo.",
            createdAt: min(15),
            status: "delivered",
          }),
        ],
      },
    ],
  };
}
