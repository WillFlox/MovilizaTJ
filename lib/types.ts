import type { BarrierType } from "@/lib/constants";

export type { BarrierType };

export type ReportStatus =
  | "pendiente"
  | "verificado"
  | "resuelto"
  | "rechazado";

export type ReportSeverity = "baja" | "media" | "alta";

export type AccessibilityProfile =
  | "silla_ruedas"
  | "movilidad_reducida"
  | "carriola"
  | "discapacidad_visual";

export type ReportRecord = {
  id: string;
  latitude: number;
  longitude: number;
  tipo: BarrierType;
  descripcion: string | null;
  foto_url: string | null;
  estado: ReportStatus;
  severidad: ReportSeverity;
  created_at: string;
};

export type ActiveUserRecord = {
  usuario_id: string;
  latitud: number;
  longitud: number;
  ultima_actualizacion: string;
};

export type PlaceResult = {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
};

export type PendingReport = {
  latitude: number;
  longitude: number;
};

export type ReportSubmitPayload = {
  tipo: BarrierType;
  descripcion: string;
  severidad: ReportSeverity;
  photo: File | null;
};

export type RouteState = {
  warning: string | null;
  destination: string | null;
};
