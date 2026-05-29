import type { ReportRecord, ReportSubmitPayload } from "@/lib/types";

export async function submitReport(
  pending: { latitude: number; longitude: number },
  payload: ReportSubmitPayload
): Promise<ReportRecord> {
  const formData = new FormData();
  formData.append("latitude", String(pending.latitude));
  formData.append("longitude", String(pending.longitude));
  formData.append("tipo", payload.tipo);
  formData.append("descripcion", payload.descripcion);
  formData.append("severidad", payload.severidad);
  if (payload.photo) formData.append("photo", payload.photo);

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
