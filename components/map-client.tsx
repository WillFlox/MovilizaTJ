"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar, type ReportWithDistance } from "@/components/app-sidebar";
import { MapView } from "@/components/map-view";
import { ReportModal } from "@/components/report-modal";
import { ReportDetailModal } from "@/components/report-detail-modal";
import { useReports } from "@/hooks/use-reports";
import { useAccessibilityProfile } from "@/hooks/use-accessibility-profile";
import { submitReport } from "@/lib/api-client";
import { distanceMeters, getBarriersOnRoute } from "@/lib/geo";
import { TIJUANA_CENTER } from "@/lib/constants";
import type { MapViewHandle } from "@/lib/leaflet-types";
import type { FilterState } from "@/components/filter-bar";
import type {
  PendingReport,
  PlaceResult,
  ReportRecord,
  ReportSubmitPayload,
  RouteFoundData,
  RouteMode,
  RouteState
} from "@/lib/types";

const ROUTE_BUFFER: Record<RouteMode, number> = {
  fastest: 80,
  safest: 150
};

const EMPTY_ROUTE_STATE: RouteState = {
  warning: null,
  destination: null,
  distance: null,
  duration: null,
  barriersOnRoute: [],
  mode: "fastest"
};

export function MapClient() {
  const mapRef = useRef<MapViewHandle>(null);
  const { reports, loading, addReport } = useReports();
  const { profile, setProfile, getRouteWarning } = useAccessibilityProfile();

  const [userPosition, setUserPosition] =
    useState<[number, number]>(TIJUANA_CENTER);
  const [gpsStatus, setGpsStatus] = useState("Buscando señal GPS...");
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("fastest");
  const [routeState, setRouteState] = useState<RouteState>(EMPTY_ROUTE_STATE);
  const [filters, setFilters] = useState<FilterState>({
    tipos: [],
    severidades: []
  });
  const [nearbyRadius, setNearbyRadius] = useState(1500);
  const [selectedReport, setSelectedReport] = useState<ReportWithDistance | null>(null);

  const lastRouteRef = useRef<{ lat: number; lng: number; label: string } | null>(null);

  // Reportes filtrados por tipo/severidad — van al mapa completo
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const tipoOk =
        filters.tipos.length === 0 || filters.tipos.includes(r.tipo);
      const sevOk =
        filters.severidades.length === 0 ||
        filters.severidades.includes(r.severidad);
      return tipoOk && sevOk;
    });
  }, [reports, filters]);

  // Reportes cercanos al usuario — solo para la lista del sidebar
  const nearbyReports = useMemo((): ReportWithDistance[] => {
    return filteredReports
      .map((r) => ({
        ...r,
        distance_m: distanceMeters(
          userPosition[0],
          userPosition[1],
          r.latitude,
          r.longitude
        )
      }))
      .filter((r) => r.distance_m <= nearbyRadius)
      .sort((a, b) => a.distance_m - b.distance_m);
  }, [filteredReports, userPosition, nearbyRadius]);

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      setPendingReport({ latitude, longitude });
    },
    []
  );

  const handleRouteFound = useCallback(
    (data: RouteFoundData) => {
      const buffer = ROUTE_BUFFER[routeMode];
      const barriersOnRoute = getBarriersOnRoute(
        reports,
        data.routePoints,
        buffer
      );
      const warning = getRouteWarning(reports, data.destLat, data.destLng);
      setRouteState({
        warning,
        destination: data.label,
        distance: data.distance,
        duration: data.duration,
        barriersOnRoute,
        mode: routeMode
      });
    },
    [reports, routeMode, getRouteWarning]
  );

  useEffect(() => {
    if (lastRouteRef.current) {
      const { lat, lng, label } = lastRouteRef.current;
      mapRef.current?.drawRoute(lat, lng, label);
    }
  }, [routeMode]);

  const handlePlaceSelect = useCallback(
    (place: PlaceResult) => {
      lastRouteRef.current = {
        lat: place.latitude,
        lng: place.longitude,
        label: place.name
      };
      setRouteState((prev) => ({
        ...prev,
        destination: place.name,
        distance: null,
        duration: null,
        barriersOnRoute: [],
        warning: null,
        mode: routeMode
      }));
      mapRef.current?.drawRoute(place.latitude, place.longitude, place.name);
    },
    [routeMode]
  );

  const handleModeChange = useCallback((mode: RouteMode) => {
    setRouteMode(mode);
    setRouteState((prev) => (prev.destination ? { ...prev, mode } : prev));
  }, []);

  const handleClearRoute = useCallback(() => {
    lastRouteRef.current = null;
    mapRef.current?.clearRoute();
    setRouteState(EMPTY_ROUTE_STATE);
  }, []);

  const handleReportSubmit = useCallback(
    async (payload: ReportSubmitPayload) => {
      if (!pendingReport) return;
      const saved = await submitReport(pendingReport, payload);
      addReport(saved as ReportRecord);
    },
    [addReport, pendingReport]
  );

  return (
    <div className="app-shell">
      <AppHeader gpsStatus={gpsStatus} profile={profile} />

      <div className="main-container">
        <AppSidebar
          allReports={reports}
          nearbyReports={nearbyReports}
          reportsLoading={loading}
          userLat={userPosition[0]}
          userLng={userPosition[1]}
          nearbyRadius={nearbyRadius}
          onRadiusChange={setNearbyRadius}
          routeState={routeState}
          profile={profile}
          onProfileChange={setProfile}
          onPlaceSelect={handlePlaceSelect}
          onReportHint={() =>
            window.alert(
              "Haz clic en el mapa para reportar una barrera con foto y ubicación GPS."
            )
          }
          onReportSelect={setSelectedReport}
          filters={filters}
          onFiltersChange={setFilters}
          onModeChange={handleModeChange}
          onClearRoute={handleClearRoute}
        />

        <MapView
          ref={mapRef}
          reports={filteredReports}
          routeMode={routeMode}
          onMapClick={handleMapClick}
          onUserPositionChange={setUserPosition}
          onGpsStatusChange={setGpsStatus}
          onRouteFound={handleRouteFound}
        />
      </div>

      {pendingReport && (
        <ReportModal
          pending={pendingReport}
          onClose={() => setPendingReport(null)}
          onSubmit={handleReportSubmit}
        />
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
