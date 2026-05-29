import Image from "next/image";
import type { AccessibilityProfileValue } from "@/lib/constants";

const PROFILE_ICONS: Record<AccessibilityProfileValue, string> = {
  movilidad_reducida: "🚶",
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
        <Image
          src="/logo.png"
          alt="MovilizaTJ"
          width={480}
          height={120}
          className="logo-img"
          priority
        />
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
