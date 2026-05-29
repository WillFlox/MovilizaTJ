"use client";

import {
  ACCESSIBILITY_PROFILES,
  type AccessibilityProfileValue
} from "@/lib/constants";

type ProfileSelectorProps = {
  value: AccessibilityProfileValue;
  onChange: (value: AccessibilityProfileValue) => void;
};

const PROFILE_ICONS: Record<AccessibilityProfileValue, string> = {
  silla_ruedas: "♿",
  movilidad_reducida: "🚶",
  carriola: "🍼",
  discapacidad_visual: "👁️"
};

export function ProfileSelector({ value, onChange }: ProfileSelectorProps) {
  return (
    <div className="profile-selector">
      <div className="section-title">Perfil de movilidad</div>
      <div className="profile-grid">
        {ACCESSIBILITY_PROFILES.map((profile) => (
          <button
            key={profile.value}
            type="button"
            className={`profile-btn${value === profile.value ? " profile-btn--active" : ""}`}
            onClick={() => onChange(profile.value as AccessibilityProfileValue)}
            title={profile.description}
          >
            <span className="profile-icon">
              {PROFILE_ICONS[profile.value as AccessibilityProfileValue]}
            </span>
            <span className="profile-label">{profile.label}</span>
          </button>
        ))}
      </div>
      <p className="profile-hint">
        {ACCESSIBILITY_PROFILES.find((p) => p.value === value)?.description}
      </p>
    </div>
  );
}
