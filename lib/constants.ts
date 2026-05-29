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

export const POI_CATEGORIES = [
  { value: "imss",       label: "IMSS",        icon: "🏥" },
  { value: "issste",     label: "ISSSTE",       icon: "🏥" },
  { value: "hospital",   label: "Hospital",     icon: "🏨" },
  { value: "dif",        label: "DIF",          icon: "🤝" },
  { value: "cespt",      label: "CESPT",        icon: "💧" },
  { value: "farmacia",   label: "Farmacia",     icon: "💊" },
  { value: "transporte", label: "Transporte",   icon: "🚌" },
  { value: "parque",     label: "Parque",       icon: "🌳" },
  { value: "educacion",  label: "Educación",    icon: "🎓" },
  { value: "gobierno",   label: "Gobierno",     icon: "🏛️" }
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number]["value"];

export const POI_ICONS: Record<PoiCategory, string> = Object.fromEntries(
  POI_CATEGORIES.map((c) => [c.value, c.icon])
) as Record<PoiCategory, string>;

export const QUICK_DESTINATIONS = [
  { query: "IMSS",      label: "IMSS",      categoria: "imss"      as const },
  { query: "hospital",  label: "Hospital",  categoria: "hospital"  as const },
  { query: "farmacia",  label: "Farmacia",  categoria: "farmacia"  as const },
  { query: "DIF",       label: "DIF",       categoria: "dif"       as const },
  { query: "CESPT",     label: "CESPT",     categoria: "cespt"     as const }
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
