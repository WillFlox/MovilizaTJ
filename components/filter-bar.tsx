"use client";

import { BARRIER_TYPES, type BarrierType } from "@/lib/constants";
import type { ReportSeverity } from "@/lib/types";

export type FilterState = {
  tipos: BarrierType[];
  severidades: ReportSeverity[];
};

const SEVERIDADES: { value: ReportSeverity; label: string; color: string }[] =
  [
    { value: "alta", label: "Alta", color: "#ef4444" },
    { value: "media", label: "Media", color: "#f59e0b" },
    { value: "baja", label: "Baja", color: "#10b981" }
  ];

type FilterBarProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const isAllTypes = filters.tipos.length === 0;
  const isAllSev = filters.severidades.length === 0;

  return (
    <div className="filter-bar">
      <div className="filter-section">
        <span className="filter-label">Tipo</span>
        <div className="filter-chips">
          <button
            className={`filter-chip${isAllTypes ? " active" : ""}`}
            onClick={() => onChange({ ...filters, tipos: [] })}
          >
            Todos
          </button>
          {BARRIER_TYPES.map((t) => {
            const active = filters.tipos.includes(t.value);
            return (
              <button
                key={t.value}
                className={`filter-chip${active ? " active" : ""}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    tipos: toggleItem(filters.tipos, t.value)
                  })
                }
                title={t.label}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Severidad</span>
        <div className="filter-chips">
          <button
            className={`filter-chip${isAllSev ? " active" : ""}`}
            onClick={() => onChange({ ...filters, severidades: [] })}
          >
            Todas
          </button>
          {SEVERIDADES.map((s) => {
            const active = filters.severidades.includes(s.value);
            return (
              <button
                key={s.value}
                className={`filter-chip${active ? " active" : ""}`}
                style={active ? { borderColor: s.color, color: s.color } : {}}
                onClick={() =>
                  onChange({
                    ...filters,
                    severidades: toggleItem(filters.severidades, s.value)
                  })
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
