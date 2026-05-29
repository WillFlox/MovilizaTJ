import type { BarrierType, PoiCategory } from "@/lib/constants";

export type { BarrierType };

export type ReportStatus =
  | "pendiente"
  | "verificado"
  | "resuelto"
  | "rechazado";

export type ReportSeverity = "baja" | "media" | "alta";

export type AccessibilityProfile =
  | "movilidad_reducida"
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

export type PoiRecord = {
  id: string;
  nombre: string;
  categoria: PoiCategory;
  direccion: string | null;
  latitude: number;
  longitude: number;
  activo: boolean;
  created_at: string;
  barrier_count?: number;
  distance_m?: number;
};

export type RouteMode = "fastest" | "safest";

export type RouteFoundData = {
  distance: number;
  duration: number;
  routePoints: [number, number][];
  destLat: number;
  destLng: number;
  label: string;
};

export type RouteState = {
  warning: string | null;
  destination: string | null;
  distance: number | null;
  duration: number | null;
  barriersOnRoute: ReportRecord[];
  mode: RouteMode;
};

export type VoiceRouteObstacle = {
  descripcion?: string;
  tipo?: string;
  latitude: number;
  longitude: number;
  distancia_metros?: number;
};

export type VoiceRouteData = {
  destino: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat?: number;
  destino_lng?: number;
  obstaculos?: VoiceRouteObstacle[];
  /** true cuando la respuesta proviene de una consulta de ruta de transporte público */
  es_ruta_transporte?: boolean;
};

export type N8nVoiceResponse = {
  ok?: boolean;
  respuesta_texto?: string;
  audio_base64?: string;
  mime_type?: string;
  file_name?: string;
  ruta?: VoiceRouteData;
  obstaculos?: VoiceRouteObstacle[];
  text?: string;
  error?: string;
  // Campos de debug reenviados desde n8n (útiles para depurar en móvil)
  modo_consulta?: string;
  ruta_generada?: boolean | string;
  debug_ruta_motivo?: string;
  mantener_ruta_actual?: boolean;
  last_transport_route_id?: string | number;
  last_transport_route_name?: string;
  last_transport_destino?: string;
};
