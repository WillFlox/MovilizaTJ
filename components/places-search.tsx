"use client";

import { useCallback, useEffect, useState } from "react";
import { QUICK_DESTINATIONS } from "@/lib/constants";
import type { PlaceResult } from "@/lib/types";

type PlacesSearchProps = {
  userLat: number;
  userLng: number;
  onSelect: (place: PlaceResult) => void;
};

export function PlacesSearch({ userLat, userLng, onSelect }: PlacesSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placesEnabled, setPlacesEnabled] = useState(true);

  const search = useCallback(
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

      const response = await fetch(`/api/places/search?${params}`);
      const payload = (await response.json()) as {
        status: string;
        data?: PlaceResult[];
        message?: string;
      };

      setLoading(false);

      if (response.status === 503) {
        setPlacesEnabled(false);
        setError("Google Places no configurado. Usa clic en el mapa.");
        return;
      }

      if (!response.ok) {
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

    const timer = setTimeout(() => {
      search(query).catch(() => setError("Error de red."));
    }, 400);

    return () => clearTimeout(timer);
  }, [query, search]);

  async function searchNearby(keyword: string) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      keyword,
      lat: String(userLat),
      lng: String(userLng)
    });

    const response = await fetch(`/api/places/nearby?${params}`);
    const payload = (await response.json()) as {
      status: string;
      data?: PlaceResult[];
      message?: string;
    };

    setLoading(false);

    if (response.status === 503) {
      setPlacesEnabled(false);
      setError("Google Places no configurado.");
      return;
    }

    if (!response.ok) {
      setError(payload.message ?? "Error al buscar cercanos.");
      return;
    }

    setResults(payload.data ?? []);
  }

  return (
    <div className="places-search">
      <div className="section-title">Buscar destino accesible</div>
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
            onClick={() => searchNearby(item.query)}
            disabled={!placesEnabled || loading}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p className="search-status">Buscando...</p>}
      {error && <p className="search-error">{error}</p>}

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
    </div>
  );
}
