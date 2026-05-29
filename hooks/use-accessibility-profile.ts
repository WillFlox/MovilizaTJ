import { useCallback, useState } from "react";
import type { AccessibilityProfileValue } from "@/lib/constants";
import type { ReportRecord } from "@/lib/types";
import { countNearbyBarriers } from "@/lib/geo";

const PROFILE_RADIUS: Record<AccessibilityProfileValue, number> = {
  silla_ruedas: 600,
  movilidad_reducida: 400,
  carriola: 500,
  discapacidad_visual: 300
};

const PROFILE_WARNINGS: Record<AccessibilityProfileValue, string> = {
  silla_ruedas:
    "Este perfil evita rampas bloqueadas y banquetas dañadas. Revisa las barreras marcadas antes de salir.",
  movilidad_reducida:
    "Se priorizan tramos cortos y superficies firmes. Hay barreras reportadas en la zona.",
  carriola:
    "Perfil carriola activo. Se consideran aceras amplias y cruces seguros.",
  discapacidad_visual:
    "Perfil visual activo. Se priorizan banquetas continuas y señalización clara."
};

export function useAccessibilityProfile() {
  const [profile, setProfile] = useState<AccessibilityProfileValue>(
    "silla_ruedas"
  );

  const getRouteWarning = useCallback(
    (
      reports: ReportRecord[],
      destLat: number,
      destLng: number
    ): string | null => {
      const radius = PROFILE_RADIUS[profile];
      const nearby = countNearbyBarriers(reports, destLat, destLng, radius);

      if (nearby === 0) return null;

      return `${PROFILE_WARNINGS[profile]} (${nearby} barrera${nearby > 1 ? "s" : ""} en ${radius} m)`;
    },
    [profile]
  );

  return { profile, setProfile, getRouteWarning };
}
