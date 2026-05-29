"use client";

import { useState } from "react";
import { BARRIER_TYPES, type BarrierType } from "@/lib/constants";
import type { ReportSeverity } from "@/lib/types";

export type FilterState = {
  tipos: BarrierType[];
  severidades: ReportSeverity[];
};

type FilterBarProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function tipoSummary(tipos: BarrierType[]): string {
  if (tipos.length === 0) return "Todos los tipos";
  if (tipos.length === 1) {
    const found = BARRIER_TYPES.find((t) => t.value === tipos[0]);
    return found?.label ?? tipos[0].replace(/_/g, " ");
  }
  return `${tipos.length} tipos seleccionados`;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const isAllTypes = filters.tipos.length === 0;

  return (
    <div className={`sb-filter sb-filter--gmaps${expanded ? " sb-filter--open" : ""}`}>
      <button
        type="button"
        className="sb-filter-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="sb-filter-panel"
      >
        <div className="sb-filter-toggle-text">
          <div className="sb-filter-title">Tipo</div>
          <div className="sb-filter-subtitle">{tipoSummary(filters.tipos)}</div>
        </div>
        <div className="sb-filter-toggle-meta">
          {!isAllTypes && (
            <span className="sb-filter-count">{filters.tipos.length}</span>
          )}
          <span className="sb-filter-chevron" aria-hidden>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && (
        <div id="sb-filter-panel" className="sb-filter-panel">
          <div className="filter-chips">
            <button
              type="button"
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
                  type="button"
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
      )}
    </div>
  );
}
