"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AppSidebar, type ReportWithDistance } from "@/components/app-sidebar";
import { MapView } from "@/components/map-view";
import { PlacesSearch } from "@/components/places-search";
import { ReportModal } from "@/components/report-modal";
import { ReportDetailModal } from "@/components/report-detail-modal";
import { CameraModal } from "@/components/camera-modal";
import { VoiceChatbot } from "@/components/voice-chatbot";
import { ProximityToast } from "@/components/proximity-toast";
import { useReports } from "@/hooks/use-reports";
import { useAccessibilityProfile } from "@/hooks/use-accessibility-profile";
import { useProximityPrompt } from "@/hooks/use-proximity-prompt";
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
  RouteState,
  VoiceRouteData,
  VoiceRouteObstacle
} from "@/lib/types";

// Buffer en metros para detección punto-a-segmento.
// "fastest": 30 m ≈ ancho de una acera + un carril → solo lo que está en la calle exacta.
// "safest":  50 m → incluye un carril adyacente para alertas más amplias.
const ROUTE_BUFFER: Record<RouteMode, number> = {
  fastest: 30,
  safest: 50
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
  const { reports, loading, addReport, removeReport } = useReports();
  const { profile, setProfile, getRouteWarning } = useAccessibilityProfile();

  const [userPosition, setUserPosition] =
    useState<[number, number]>(TIJUANA_CENTER);
  const [gpsStatus, setGpsStatus] = useState("Buscando señal GPS...");
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(null);
  const [quickPhoto, setQuickPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [routeMode, setRouteMode] = useState<RouteMode>("fastest");
  const [routeState, setRouteState] = useState<RouteState>(EMPTY_ROUTE_STATE);
  const [filters, setFilters] = useState<FilterState>({
    tipos: [],
    severidades: []
  });
  const [nearbyRadius, setNearbyRadius] = useState(1500);
  const [selectedReport, setSelectedReport] = useState<ReportWithDistance | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [toastResolving, setToastResolving] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const lastRouteRef = useRef<{ lat: number; lng: number; label: string } | null>(null);

  const { activePrompt, dismiss, resolve, confirmPresent } = useProximityPrompt(
    reports,
    userPosition,
    gpsReady
  );

  useEffect(() => {
    if (!showSidebar) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSidebar]);

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

  const handleUserPositionChange = useCallback(
    (pos: [number, number]) => {
      setUserPosition(pos);
      setGpsReady(true);
    },
    []
  );

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      setPendingReport({ latitude, longitude });
    },
    []
  );

  const handleQuickPhotoClick = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const handleCameraCapture = useCallback(
    (file: File) => {
      const [latitude, longitude] = userPosition;
      setQuickPhoto(file);
      setCameraOpen(false);
      setPendingReport({ latitude, longitude });
    },
    [userPosition]
  );

  const handleCameraClose = useCallback(() => {
    setCameraOpen(false);
  }, []);

  const handleReportClose = useCallback(() => {
    setPendingReport(null);
    setQuickPhoto(null);
  }, []);

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
      setQuickPhoto(null);
    },
    [addReport, pendingReport]
  );

  const handleVoiceRoute = useCallback(async (ruta: VoiceRouteData) => {
    if (!ruta.destino) return;

    // Geocodificar el nombre de destino con Nominatim (OSM, sin API key)
    let destLat: number | null = null;
    let destLng: number | null = null;

    try {
      const query = encodeURIComponent(
        `${ruta.destino}, Tijuana, Baja California, Mexico`
      );
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const geoData = await geoRes.json() as Array<{ lat: string; lon: string }>;
      if (geoData.length > 0) {
        destLat = parseFloat(geoData[0].lat);
        destLng = parseFloat(geoData[0].lon);
      }
    } catch {
      console.warn("[handleVoiceRoute] Geocodificación fallida para:", ruta.destino);
    }

    if (destLat === null || destLng === null) {
      console.warn("[handleVoiceRoute] No se pudo geocodificar:", ruta.destino);
      return;
    }

    // Registrar la ruta para que el cambio de modo (fastest/safest) la redibuje
    lastRouteRef.current = { lat: destLat, lng: destLng, label: ruta.destino };

    // Actualizar sidebar inmediatamente con el destino
    setRouteState((prev) => ({
      ...prev,
      destination: ruta.destino,
      distance: null,
      duration: null,
      barriersOnRoute: [],
      warning: null,
      mode: routeMode
    }));

    // Dibujar usando el mismo sistema existente (OSRM, modo actual, onRouteFound)
    mapRef.current?.drawRoute(destLat, destLng, ruta.destino);

    // Pintar obstáculos de voz encima de la ruta
    if (ruta.obstaculos && ruta.obstaculos.length > 0) {
      setTimeout(() => {
        mapRef.current?.paintVoiceObstacles(ruta.obstaculos!);
      }, 400);
    }
  }, [routeMode]);

  const handleVoiceObstacles = useCallback((obstaculos: VoiceRouteObstacle[]) => {
    mapRef.current?.paintVoiceObstacles(obstaculos);
  }, []);

  return (
    <div className="app-shell app-shell--map">
      {/* Mapa fullscreen */}
      <div className="map-wrapper-outer">
        <MapView
          ref={mapRef}
          reports={filteredReports}
          routeMode={routeMode}
          onMapClick={handleMapClick}
          onUserPositionChange={handleUserPositionChange}
          onGpsStatusChange={setGpsStatus}
          onRouteFound={handleRouteFound}
        />

        {/* Logo — esquina superior izquierda */}
        <div className="map-overlay-logo">
          <Image
            src="/logo.png"
            alt="MovilizaTJ"
            width={200}
            height={52}
            className="map-overlay-logo-img"
            priority
          />
        </div>

        {/* Barra de búsqueda — centro superior */}
        <div className="map-overlay-search">
          <div className="map-search-inner">
            <PlacesSearch
              userLat={userPosition[0]}
              userLng={userPosition[1]}
              onSelect={handlePlaceSelect}
            />
            <span className="map-search-icon">🔍</span>
          </div>
        </div>

        {/* Botones de acción — esquina superior derecha */}
        <div className="map-overlay-actions">
          <button
            className="map-action-btn"
            onClick={() => setShowSidebar(true)}
            title="Perfil de accesibilidad"
            aria-label="Abrir perfil de accesibilidad"
          >
            ♿
          </button>
          <button
            className="map-action-btn"
            onClick={() => setShowSidebar(true)}
            title="Menú"
            aria-label="Abrir menú"
          >
            ☰
          </button>
        </div>

        {/* FAB cámara — esquina inferior derecha */}
        <div className="quick-report-fab-container">
          <button
            className="quick-report-fab"
            onClick={handleQuickPhotoClick}
            title={gpsReady ? "Fotografiar incidente" : "Esperando señal GPS…"}
            aria-label="Fotografiar incidente"
          >
            <span className="fab-icon">📸</span>
          </button>
        </div>

        {/* Asistente de voz — esquina inferior izquierda */}
        <VoiceChatbot
          userLat={userPosition[0]}
          userLng={userPosition[1]}
          gpsReady={gpsReady}
          onRouteReceived={handleVoiceRoute}
          onObstaclesReceived={handleVoiceObstacles}
        />
      </div>

      {/* Drawer lateral */}
      {showSidebar && (
        <>
          <div
            className="sidebar-drawer-overlay"
            onClick={() => setShowSidebar(false)}
          />
          <div className="sidebar-drawer">
            <div className="sidebar-drawer-header">
              <span className="sidebar-drawer-title">MovilizaTJ</span>
              <button
                className="sidebar-drawer-close"
                onClick={() => setShowSidebar(false)}
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            <AppSidebar
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
              onReportSelect={(r) => {
                setSelectedReport(r);
                setShowSidebar(false);
              }}
              filters={filters}
              onFiltersChange={setFilters}
              onModeChange={handleModeChange}
              onClearRoute={handleClearRoute}
            />
          </div>
        </>
      )}

      {pendingReport && (
        <ReportModal
          pending={pendingReport}
          onClose={handleReportClose}
          onSubmit={handleReportSubmit}
          initialPhoto={quickPhoto}
        />
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {cameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={handleCameraClose}
        />
      )}

      {activePrompt && (
        <ProximityToast
          prompt={activePrompt}
          resolving={toastResolving}
          onResolved={async () => {
            setToastResolving(true);
            await resolve(activePrompt.report.id, userPosition[0], userPosition[1], removeReport);
            setToastResolving(false);
          }}
          onStillPresent={() => confirmPresent(activePrompt.report.id)}
          onDismiss={() => dismiss(activePrompt.report.id)}
        />
      )}
    </div>
  );
}
