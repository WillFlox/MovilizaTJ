"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type { FilterState } from "@/components/filter-bar";
import { MapView } from "@/components/map-view";
import { ReportModal } from "@/components/report-modal";
import { useReports } from "@/hooks/use-reports";
import { useAccessibilityProfile } from "@/hooks/use-accessibility-profile";
import { submitReport } from "@/lib/api-client";
import { TIJUANA_CENTER } from "@/lib/constants";
import type { MapViewHandle } from "@/lib/leaflet-types";
import type {
  PendingReport,
  PlaceResult,
  ReportSubmitPayload,
  RouteState
} from "@/lib/types";

export function MapClient() {
  const mapRef = useRef<MapViewHandle>(null);
  const { reports, loading, addReport } = useReports();
  const { profile, setProfile, getRouteWarning } = useAccessibilityProfile();

  const [userPosition, setUserPosition] =
    useState<[number, number]>(TIJUANA_CENTER);
  const [gpsStatus, setGpsStatus] = useState("Buscando señal GPS...");
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(null);
  const [routeState, setRouteState] = useState<RouteState>({
    warning: null,
    destination: null
  });
  const [filters, setFilters] = useState<FilterState>({
    tipos: [],
    severidades: []
  });

  // Reportes filtrados — se usan tanto en el sidebar como en el mapa.
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const tipoOk = filters.tipos.length === 0 || filters.tipos.includes(r.tipo);
      const sevOk =
        filters.severidades.length === 0 ||
        filters.severidades.includes(r.severidad);
      return tipoOk && sevOk;
    });
  }, [reports, filters]);

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      setPendingReport({ latitude, longitude });
    },
    []
  );

  const handleRouteRequest = useCallback(
    (lat: number, lng: number, label?: string): string | null => {
      const warning = getRouteWarning(reports, lat, lng);
      setRouteState({
        warning,
        destination: label ?? "Destino seleccionado"
      });
      return warning;
    },
    [getRouteWarning, reports]
  );

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    mapRef.current?.drawRoute(place.latitude, place.longitude, place.name);
  }, []);

  const handleReportSubmit = useCallback(
    async (payload: ReportSubmitPayload) => {
      if (!pendingReport) return;
      const saved = await submitReport(pendingReport, payload);
      addReport(saved);
    },
    [addReport, pendingReport]
  );

  return (
    <div className="app-shell">
      <AppHeader gpsStatus={gpsStatus} profile={profile} />

      <div className="main-container">
        <AppSidebar
          reports={filteredReports}
          allReports={reports}
          reportsLoading={loading}
          userLat={userPosition[0]}
          userLng={userPosition[1]}
          routeState={routeState}
          profile={profile}
          onProfileChange={setProfile}
          onPlaceSelect={handlePlaceSelect}
          onReportHint={() =>
            window.alert(
              "Haz clic en el mapa para reportar una barrera con foto y ubicación GPS."
            )
          }
          filters={filters}
          onFiltersChange={setFilters}
        />

        <MapView
          ref={mapRef}
          reports={filteredReports}
          onMapClick={handleMapClick}
          onUserPositionChange={setUserPosition}
          onGpsStatusChange={setGpsStatus}
          onRouteRequest={handleRouteRequest}
        />
      </div>

      {pendingReport && (
        <ReportModal
          pending={pendingReport}
          onClose={() => setPendingReport(null)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}
