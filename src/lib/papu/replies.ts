import type { Chat, Message } from "@/lib/papu/types";

const pools: Record<string, string[]> = {
  valeria: [
    "Lo dejo en el tablero antes de cerrar el día.",
    "El ámbar sobre tinta se lee mejor que cualquier verde de catálogo.",
    "Reviso el trazo y te confirmo sin notas de más.",
    "Quedó más sobrio. Así se sostiene la marca.",
  ],
  mateo: [
    "Va. Te aviso cuando salga.",
    "Me parece. Lo vemos con calma.",
    "Anotado. No se me pasa.",
    "Estoy en eso. En un rato te digo.",
  ],
  camila: [
    "Lo escuché completo. El ritmo ya está.",
    "Déjalo así. Se siente natural.",
    "Bajo un punto el final y te mando otra toma.",
    "Esa versión sí. La otra estaba apurada.",
  ],
  andres: [
    "El cliente quiere ver el flujo, no la infraestructura.",
    "Si entra por el teléfono, que la lista no se rompa.",
    "Lo presento como demostración. Producción va después.",
    "Quedó claro. Sigo con el alcance.",
  ],
  taller: [
    "De acuerdo. Lo dejamos así para la revisión.",
    "Yo cierro mi parte hoy.",
    "Sin adornos de más. Que se entienda solo.",
  ],
  papu: [
    "Esto sigue siendo una demostración en tu navegador.",
    "Puedes escribir, mandar una nota de voz o abrir una llamada.",
    "La verificación en dos pasos de esta sesión ya quedó hecha.",
    "Cuando pases a producción, este mismo flujo se conecta a un servicio real.",
  ],
};

function pick(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? "Recibido.";
}

export function craftReply(chat: Chat, last: Message) {
  const text = `${last.body} ${last.mediaName ?? ""}`.toLowerCase();
  let body = pick(pools[chat.id] ?? pools.papu ?? ["Recibido."]);
  if (last.kind === "image") body = "Vi la imagen. Se entiende sin explicación extra.";
  else if (last.kind === "voice") body = "Nota escuchada. Te respondo por escrito.";
  else if (last.kind === "file") body = "Archivo recibido. Lo abro en cuanto termine esto.";
  else if (/hola|buenas|buen d[ií]a|qu[eé] tal/.test(text)) {
    body = chat.id === "papu" ? "Hola. Estoy del otro lado de la demostración." : "Hola. Aquí estoy.";
  } else if (/llam/.test(text)) body = "Si quieres, marca desde el icono de arriba. Yo contesto en esta demo.";
  else if (/c[oó]digo|verific/.test(text)) body = "El código de dos pasos solo vive en esta sesión de ejemplo.";
  else if (/foto|imagen|paleta/.test(text)) body = "La paleta se sostiene: tinta, hueso, ámbar, musgo y arcilla.";

  const sender =
    chat.kind === "group" ? chat.members[Math.floor(Math.random() * chat.members.length)]?.name : undefined;
  return { body, senderName: sender };
}
