"use client";

import { useCallback, useEffect, useState } from "react";
import { POI_CATEGORIES, POI_ICONS, QUICK_DESTINATIONS } from "@/lib/constants";
import type { PlaceResult, PoiRecord } from "@/lib/types";

type PlacesSearchProps = {
  userLat: number;
  userLng: number;
  onSelect: (place: PlaceResult) => void;
};

type SearchMode = "google" | "pois";

function barrierLabel(count: number): { text: string; level: "ok" | "warn" | "danger" } {
  if (count === 0) return { text: "Sin barreras", level: "ok" };
  if (count <= 2)  return { text: `${count} barrera${count > 1 ? "s" : ""}`, level: "warn" };
  return { text: `${count} barreras`, level: "danger" };
}

function distLabel(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function PlacesSearch({ userLat, userLng, onSelect }: PlacesSearchProps) {
  const [mode, setMode] = useState<SearchMode>("google");
  const [query, setQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<PlaceResult[]>([]);
  const [poiResults, setPoiResults] = useState<(PoiRecord & { distance_m: number | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placesEnabled, setPlacesEnabled] = useState(true);

  // ── Google Places: búsqueda por texto ─────────────────────────────────────

  const searchGoogle = useCallback(
    async (text: string) => {
      if (!text.trim()) { setGoogleResults([]); return; }
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q: text, lat: String(userLat), lng: String(userLng) });
      const res = await fetch(`/api/places/search?${params}`);
      const payload = (await res.json()) as { status: string; data?: PlaceResult[]; message?: string };
      setLoading(false);
      if (res.status === 503) { setPlacesEnabled(false); setError("Google Places no configurado."); return; }
      if (!res.ok) { setError(payload.message ?? "Error al buscar."); return; }
      setGoogleResults(payload.data ?? []);
    },
    [userLat, userLng]
  );

  const searchGoogleNearby = useCallback(
    async (keyword: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ keyword, lat: String(userLat), lng: String(userLng) });
      const res = await fetch(`/api/places/nearby?${params}`);
      const payload = (await res.json()) as { status: string; data?: PlaceResult[]; message?: string };
      setLoading(false);
      if (res.status === 503) { setPlacesEnabled(false); setError("Google Places no configurado."); return; }
      if (!res.ok) { setError(payload.message ?? "Error al buscar cercanos."); return; }
      setGoogleResults(payload.data ?? []);
    },
    [userLat, userLng]
  );

  useEffect(() => {
    if (mode !== "google" || !query.trim()) { setGoogleResults([]); return; }
    const t = setTimeout(() => searchGoogle(query).catch(() => setError("Error de red.")), 400);
    return () => clearTimeout(t);
  }, [query, mode, searchGoogle]);

  // ── POIs internos: consulta /api/pois con score ────────────────────────────

  const searchPois = useCallback(
    async (categoria?: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        lat: String(userLat),
        lng: String(userLng),
        radius: "8000"
      });
      if (categoria) params.set("categoria", categoria);
      const res = await fetch(`/api/pois?${params}`);
      const payload = (await res.json()) as {
        status: string;
        data?: (PoiRecord & { distance_m: number | null })[];
        message?: string;
      };
      setLoading(false);
      if (!res.ok) { setError(payload.message ?? "Error al cargar POIs."); return; }
      setPoiResults(payload.data ?? []);
    },
    [userLat, userLng]
  );

  // Al cambiar al modo POIs, cargamos todos automáticamente
  useEffect(() => {
    if (mode === "pois") {
      searchPois().catch(() => setError("Error de red."));
    }
  }, [mode, searchPois]);

  function poiToPlaceResult(poi: PoiRecord): PlaceResult {
    return {
      place_id: poi.id,
      name: poi.nombre,
      address: poi.direccion ?? "",
      latitude: poi.latitude,
      longitude: poi.longitude,
      types: [poi.categoria]
    };
  }

  return (
    <div className="places-search">
      <div className="search-mode-tabs">
        <button
          className={`search-tab${mode === "google" ? " active" : ""}`}
          onClick={() => { setMode("google"); setQuery(""); setPoiResults([]); setError(null); }}
        >
          🔍 Buscar
        </button>
        <button
          className={`search-tab${mode === "pois" ? " active" : ""}`}
          onClick={() => { setMode("pois"); setQuery(""); setGoogleResults([]); setError(null); }}
        >
          ♿ Más accesibles
        </button>
      </div>

      {mode === "google" && (
        <>
          <input
            type="search"
            className="search-input"
            placeholder="IMSS, hospital, farmacia..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!placesEnabled}
          />
          <div className="quick-destinations">
            {QUICK_DESTINATIONS.map((item) => (
              <button
                key={item.query}
                type="button"
                className="quick-btn"
                onClick={() => searchGoogleNearby(item.query)}
                disabled={!placesEnabled || loading}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "pois" && (
        <div className="poi-category-filter">
          <button
            className="poi-cat-btn"
            onClick={() => searchPois()}
            disabled={loading}
          >
            Todos
          </button>
          {POI_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className="poi-cat-btn"
              onClick={() => searchPois(cat.value)}
              disabled={loading}
              title={cat.label}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="search-status">Buscando...</p>}
      {error   && <p className="search-error">{error}</p>}

      {/* Resultados de Google Places */}
      {mode === "google" && googleResults.length > 0 && (
        <ul className="places-results">
          {googleResults.map((place) => (
            <li key={place.place_id}>
              <button type="button" className="place-item" onClick={() => onSelect(place)}>
                <strong>{place.name}</strong>
                <span>{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Resultados de POIs propios con score de accesibilidad */}
      {mode === "pois" && poiResults.length > 0 && (
        <ul className="places-results">
          {poiResults.map((poi, idx) => {
            const { text: bText, level: bLevel } = barrierLabel(poi.barrier_count ?? 0);
            const dist = distLabel(poi.distance_m);
            const icon = POI_ICONS[poi.categoria] ?? "📍";
            const isBest = idx === 0;
            return (
              <li key={poi.id}>
                <button
                  type="button"
                  className={`place-item place-item--poi${isBest ? " place-item--best" : ""}`}
                  onClick={() => onSelect(poiToPlaceResult(poi))}
                >
                  <div className="poi-name-row">
                    <span className="poi-icon">{icon}</span>
                    <strong>{poi.nombre}</strong>
                    {isBest && <span className="poi-best-badge">✅ Más accesible</span>}
                  </div>
                  <span className="poi-address">{poi.direccion}</span>
                  <div className="poi-meta">
                    {dist && <span className="poi-dist">{dist}</span>}
                    <span className={`poi-barriers poi-barriers--${bLevel}`}>{bText}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "pois" && !loading && poiResults.length === 0 && (
        <p className="empty-report">
          No hay POIs cargados. Ejecuta <code>supabase/puntos-interes.sql</code> en Supabase.
        </p>
      )}
    </div>
  );
}
