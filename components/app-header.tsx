import type { AccessibilityProfileValue } from "@/lib/constants";

const PROFILE_ICONS: Record<AccessibilityProfileValue, string> = {
  silla_ruedas: "♿",
  movilidad_reducida: "🚶",
  carriola: "🍼",
  discapacidad_visual: "👁️"
};

type AppHeaderProps = {
  gpsStatus: string;
  profile: AccessibilityProfileValue;
};

export function AppHeader({ gpsStatus, profile }: AppHeaderProps) {
  return (
    <header className="navbar">
      <div className="logo">
        <div className="logo-icon">♿</div>
        Tijuana Sin Barreras
      </div>
      <div className="navbar-right">
        <div className="profile-badge" title="Perfil activo">
          {PROFILE_ICONS[profile]}
        </div>
        <div className="user-profile">{gpsStatus}</div>
      </div>
    </header>
  );
}
