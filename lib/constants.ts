export const TIJUANA_CENTER: [number, number] = [32.5149, -117.0382];

export const BARRIER_TYPES = [
  { value: "banqueta_danada", label: "Banqueta dañada", icon: "🚧" },
  { value: "rampa_bloqueada", label: "Rampa bloqueada", icon: "♿" },
  { value: "bache", label: "Bache / pavimento", icon: "🕳️" },
  { value: "sin_rampa", label: "Sin rampa de acceso", icon: "⛔" },
  { value: "transporte_inaccesible", label: "Transporte inaccesible", icon: "🚌" },
  { value: "obstaculo_general", label: "Otro obstáculo", icon: "📍" }
] as const;

export type BarrierType = (typeof BARRIER_TYPES)[number]["value"];

export const BARRIER_ICONS: Record<BarrierType, string> = Object.fromEntries(
  BARRIER_TYPES.map((t) => [t.value, t.icon])
) as Record<BarrierType, string>;

export const QUICK_DESTINATIONS = [
  { query: "IMSS", label: "IMSS cercano" },
  { query: "hospital", label: "Hospital cercano" },
  { query: "farmacia", label: "Farmacia cercana" }
] as const;

export const ACCESSIBILITY_PROFILES = [
  {
    value: "silla_ruedas",
    label: "Silla de ruedas",
    description: "Evita escalones, pendientes fuertes y banquetas rotas"
  },
  {
    value: "movilidad_reducida",
    label: "Movilidad reducida",
    description: "Prefiere tramos cortos, rampas y superficies firmes"
  },
  {
    value: "carriola",
    label: "Carriola / familias",
    description: "Prioriza aceras amplias y cruces seguros"
  },
  {
    value: "discapacidad_visual",
    label: "Discapacidad visual",
    description: "Prioriza banquetas continuas y señalización clara"
  }
] as const;

export type AccessibilityProfileValue =
  (typeof ACCESSIBILITY_PROFILES)[number]["value"];

export const REPORT_LIMIT = 50;
