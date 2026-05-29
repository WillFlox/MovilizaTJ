import type { ReportRecord, ReportSubmitPayload } from "@/lib/types";

export function getMovilizaSessionId(): string {
  const key = "movilizatj_session_id";

  if (typeof window === "undefined") {
    return "server_side_session";
  }

  let sessionId = window.localStorage.getItem(key);

  if (!sessionId) {
    if (window.crypto?.randomUUID) {
      sessionId = window.crypto.randomUUID();
    } else {
      sessionId = `movilizatj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    window.localStorage.setItem(key, sessionId);
  }

  return sessionId;
}

const N8N_CLASIFICAR_FOTO_URL =
  process.env.NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL ||
  "https://auto.curso.desarrolloslan.com/webhook/clasificar-foto";

type FotoClasificacion = {
  color: "VERDE" | "AMARILLO" | "ROJO" | "GRIS";
  tipo:
    | "banqueta_danada"
    | "rampa_bloqueada"
    | "bache"
    | "sin_rampa"
    | "transporte_inaccesible"
    | "obstaculo_general"
    | "no_identificado";
  descripcion: string;
  severidad: "baja" | "media" | "alta" | "ninguna";
  confianza: number;
  es_barrera: boolean;
};

async function clasificarFotoConN8n(
  photo: File,
  extra: {
    latitude: number;
    longitude: number;
    descripcion?: string;
    tipo?: string;
  }
): Promise<FotoClasificacion | null> {
  const formData = new FormData();
  formData.append("foto", photo);
  formData.append("latitude", String(extra.latitude));
  formData.append("longitude", String(extra.longitude));
  formData.append("descripcion", extra.descripcion || "");
  formData.append("tipo", extra.tipo || "");

  const response = await fetch(N8N_CLASIFICAR_FOTO_URL, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json"
    }
  });

  const rawText = await response.text();

  let result: {
    ok?: boolean;
    clasificacion?: FotoClasificacion;
    error?: string;
  };

  try {
    const cleanText = rawText.trim().startsWith("=")
      ? rawText.trim().slice(1)
      : rawText.trim();
    result = JSON.parse(cleanText);
  } catch {
    throw new Error("n8n no regresó JSON válido: " + rawText);
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "No se pudo clasificar la foto.");
  }

  return result.clasificacion || null;
}

export async function submitReport(
  pending: { latitude: number; longitude: number },
  payload: ReportSubmitPayload
): Promise<ReportRecord> {
  let clasificacion: FotoClasificacion | null = null;

  if (payload.photo) {
    try {
      clasificacion = await clasificarFotoConN8n(payload.photo, {
        latitude: pending.latitude,
        longitude: pending.longitude,
        descripcion: payload.descripcion,
        tipo: payload.tipo
      });

      console.log("Clasificación de foto:", clasificacion);
    } catch (error) {
      console.error("Error clasificando foto con n8n:", error);
      // La clasificación falla silenciosamente; el reporte se envía igual.
    }
  }

  const formData = new FormData();
  formData.append("latitude", String(pending.latitude));
  formData.append("longitude", String(pending.longitude));

  // Tipo: preferir el de la IA si es válido y reconocido.
  const tipoFinal =
    clasificacion &&
    clasificacion.tipo &&
    clasificacion.tipo !== "no_identificado"
      ? clasificacion.tipo
      : payload.tipo;

  // Severidad: preferir la de la IA si es válida.
  const severidadFinal =
    clasificacion &&
    clasificacion.severidad &&
    clasificacion.severidad !== "ninguna"
      ? clasificacion.severidad
      : payload.severidad;

  // Descripción: usar la del usuario si escribió algo; si no, la de la IA.
  const descripcionFinal =
    clasificacion?.descripcion && !payload.descripcion
      ? clasificacion.descripcion
      : payload.descripcion;

  formData.append("tipo", tipoFinal);
  formData.append("descripcion", descripcionFinal);
  formData.append("severidad", severidadFinal);

  if (clasificacion) {
    formData.append("clasificacion_color", clasificacion.color);
    formData.append("clasificacion_tipo", clasificacion.tipo);
    formData.append("clasificacion_descripcion", clasificacion.descripcion);
    formData.append("clasificacion_severidad", clasificacion.severidad);
    formData.append("clasificacion_confianza", String(clasificacion.confianza));
    formData.append("clasificacion_es_barrera", String(clasificacion.es_barrera));
    formData.append("clasificacion_json", JSON.stringify(clasificacion));
  }

  if (payload.photo) {
    formData.append("photo", payload.photo);
  }

  const response = await fetch("/api/reports", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("No se pudo enviar el reporte.");
  }

  const result = (await response.json()) as { data?: ReportRecord };

  if (!result.data) {
    throw new Error("Respuesta inválida del servidor.");
  }

  return result.data;
}

export async function syncUserLocation(
  latitude: number,
  longitude: number,
  usuarioId = "anonimo_tj"
) {
  await fetch("/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude, usuario_id: usuarioId })
  });
}
