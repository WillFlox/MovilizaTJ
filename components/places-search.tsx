"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaceResult } from "@/lib/types";

type PlacesSearchProps = {
  userLat: number;
  userLng: number;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
};

export function PlacesSearch({
  userLat,
  userLng,
  onSelect,
  placeholder = "¿Hacia dónde vamos?"
}: PlacesSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placesEnabled, setPlacesEnabled] = useState(true);

  const searchGoogle = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        q: text,
        lat: String(userLat),
        lng: String(userLng)
      });
      const res = await fetch(`/api/places/search?${params}`);
      const payload = (await res.json()) as {
        status: string;
        data?: PlaceResult[];
        message?: string;
      };
      setLoading(false);
      if (res.status === 503) {
        setPlacesEnabled(false);
        setError("Búsqueda de lugares no configurada.");
        return;
      }
      if (!res.ok) {
        setError(payload.message ?? "Error al buscar.");
        return;
      }
      setResults(payload.data ?? []);
    },
    [userLat, userLng]
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(
      () => searchGoogle(query).catch(() => setError("Error de red.")),
      400
    );
    return () => clearTimeout(t);
  }, [query, searchGoogle]);

  return (
    <div className="places-search">
      <input
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={!placesEnabled}
      />

      {loading && <p className="search-status">Buscando...</p>}
      {error && <p className="search-error">{error}</p>}

      {results.length > 0 && (
        <ul className="places-results">
          {results.map((place) => (
            <li key={place.place_id}>
              <button
                type="button"
                className="place-item"
                onClick={() => onSelect(place)}
              >
                <strong>{place.name}</strong>
                <span>{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
