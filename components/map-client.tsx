"use client";

import { useCallback, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { MapView } from "@/components/map-view";
import { ReportModal } from "@/components/report-modal";
import { useReports } from "@/hooks/use-reports";
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

  const [userPosition, setUserPosition] =
    useState<[number, number]>(TIJUANA_CENTER);
  const [gpsStatus, setGpsStatus] = useState("Buscando señal GPS...");
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(null);
  const [routeState, setRouteState] = useState<RouteState>({
    warning: null,
    destination: null
  });

  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    setPendingReport({ latitude, longitude });
  }, []);

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
      <AppHeader gpsStatus={gpsStatus} />

      <div className="main-container">
        <AppSidebar
          reports={reports}
          reportsLoading={loading}
          userLat={userPosition[0]}
          userLng={userPosition[1]}
          routeState={routeState}
          onPlaceSelect={handlePlaceSelect}
          onReportHint={() =>
            window.alert(
              "Haz clic en el mapa para reportar una barrera con foto y ubicación GPS."
            )
          }
        />

        <MapView
          ref={mapRef}
          reports={reports}
          onMapClick={handleMapClick}
          onUserPositionChange={setUserPosition}
          onGpsStatusChange={setGpsStatus}
          onRouteStateChange={setRouteState}
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
