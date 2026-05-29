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
import { RouteBarriersToast } from "@/components/route-barriers-toast";
import { OnboardingModal } from "@/components/onboarding-modal";
import { useReports } from "@/hooks/use-reports";
import { useAccessibilityProfile } from "@/hooks/use-accessibility-profile";
import { useProximityPrompt } from "@/hooks/use-proximity-prompt";
import { submitReport } from "@/lib/api-client";
import { computeDetourWaypoints, distanceMeters, getBarriersOnRoute } from "@/lib/geo";
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
  mode: "safest"
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
  const [quickCapture, setQuickCapture] = useState<{
    file: File;
    latitude: number;
    longitude: number;
    previewUrl: string;
  } | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("safest");
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
  const [routeBarriersDismissed, setRouteBarriersDismissed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

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

  // Marcar mapa como listo cuando GPS responde
  useEffect(() => {
    if (gpsReady && !loading) setMapLoaded(true);
  }, [gpsReady, loading]);

  const handleUserPositionChange = useCallback(
    (pos: [number, number]) => {
      setUserPosition(pos);
      setGpsReady(true);
    },
    []
  );

  /**
   * Para el modo "safest", calcula waypoints de desvío alrededor de las
   * barreras con severidad "alta" o "media" que caen cerca de la línea
   * directa inicio→destino.  En modo "fastest" devuelve undefined.
   */
  const buildAvoidPoints = useCallback(
    (destLat: number, destLng: number): [number, number][] | undefined => {
      if (routeMode !== "safest") return undefined;
      // Considerar barreras de severidad alta y media para el cálculo del desvío.
      // La función devuelve como máximo 1 waypoint a ~60 m, evitando zigzags.
      const toAvoid = reports.filter(
        (r) => r.severidad === "alta" || r.severidad === "media"
      );
      if (toAvoid.length === 0) return undefined;
      const pts = computeDetourWaypoints(
        userPosition[0], userPosition[1],
        destLat, destLng,
        toAvoid
      );
      return pts.length > 0 ? pts : undefined;
    },
    [routeMode, reports, userPosition]
  );

  const handleQuickPhotoClick = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const handleCameraCapture = useCallback(
    (file: File) => {
      const [latitude, longitude] = userPosition;
      setCameraOpen(false);
      setQuickCapture({
        file,
        latitude,
        longitude,
        previewUrl: URL.createObjectURL(file)
      });
    },
    [userPosition]
  );

  const handleQuickSubmit = useCallback(async () => {
    if (!quickCapture) return;
    setQuickSubmitting(true);
    setQuickError(null);
    try {
      const saved = await submitReport(
        { latitude: quickCapture.latitude, longitude: quickCapture.longitude },
        { tipo: "obstaculo_general", descripcion: "", severidad: "media", photo: quickCapture.file }
      );
      addReport(saved as ReportRecord);
      setQuickSubmitted(true);
      setTimeout(() => {
        URL.revokeObjectURL(quickCapture.previewUrl);
        setQuickCapture(null);
        setQuickSubmitted(false);
      }, 2000);
    } catch {
      setQuickError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setQuickSubmitting(false);
    }
  }, [quickCapture, addReport]);

  const handleQuickManual = useCallback(() => {
    if (!quickCapture) return;
    setQuickPhoto(quickCapture.file);
    setPendingReport({ latitude: quickCapture.latitude, longitude: quickCapture.longitude });
    URL.revokeObjectURL(quickCapture.previewUrl);
    setQuickCapture(null);
  }, [quickCapture]);

  const handleQuickClose = useCallback(() => {
    if (quickCapture) URL.revokeObjectURL(quickCapture.previewUrl);
    setQuickCapture(null);
    setQuickError(null);
  }, [quickCapture]);

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
      if (barriersOnRoute.length > 0) {
        setRouteBarriersDismissed(false);
      }
    },
    [reports, routeMode, getRouteWarning]
  );

  useEffect(() => {
    if (lastRouteRef.current) {
      const { lat, lng, label } = lastRouteRef.current;
      const avoidPoints = buildAvoidPoints(lat, lng);
      mapRef.current?.drawRoute(lat, lng, label, avoidPoints);
    }
  // buildAvoidPoints cambia cuando routeMode/reports/userPosition cambian,
  // pero solo queremos redibujar al cambiar el modo de ruta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const avoidPoints = buildAvoidPoints(place.latitude, place.longitude);
      mapRef.current?.drawRoute(place.latitude, place.longitude, place.name, avoidPoints);
    },
    [routeMode, buildAvoidPoints]
  );

  const handleModeChange = useCallback((mode: RouteMode) => {
    setRouteMode(mode);
    setRouteState((prev) => (prev.destination ? { ...prev, mode } : prev));
  }, []);

  const handleClearRoute = useCallback(() => {
    lastRouteRef.current = null;
    mapRef.current?.clearRoute();
    setRouteState(EMPTY_ROUTE_STATE);
    setRouteBarriersDismissed(false);
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

    let destLat: number | null = ruta.destino_lat ?? null;
    let destLng: number | null = ruta.destino_lng ?? null;

    if (destLat === null || destLng === null) {
      try {
        const geoRes = await fetch(
          `/api/geocode?q=${encodeURIComponent(ruta.destino)}`
        );
        if (geoRes.ok) {
          const geo = (await geoRes.json()) as { lat: number; lng: number };
          destLat = geo.lat;
          destLng = geo.lng;
        } else {
          console.warn(
            "[handleVoiceRoute] Geocodificación fallida:",
            ruta.destino,
            await geoRes.text()
          );
        }
      } catch {
        console.warn("[handleVoiceRoute] Geocodificación fallida para:", ruta.destino);
      }
    }

    if (destLat === null || destLng === null) {
      window.alert(
        `No pude ubicar «${ruta.destino}» en el mapa. Prueba con un nombre más específico o búscalo en la barra superior.`
      );
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
    const avoidPoints = buildAvoidPoints(destLat, destLng);
    mapRef.current?.drawRoute(destLat, destLng, ruta.destino, avoidPoints);

    // Pintar obstáculos de voz encima de la ruta
    if (ruta.obstaculos && ruta.obstaculos.length > 0) {
      setTimeout(() => {
        mapRef.current?.paintVoiceObstacles(ruta.obstaculos!);
      }, 400);
    }
  }, [routeMode, buildAvoidPoints]);

  const handleVoiceObstacles = useCallback((obstaculos: VoiceRouteObstacle[]) => {
    mapRef.current?.paintVoiceObstacles(obstaculos);
  }, []);

  // La ruta está siendo calculada: destino elegido pero distancia aún nula
  const routeCalculating =
    routeState.destination !== null && routeState.distance === null;

  return (
    <div className="app-shell app-shell--map">
      <OnboardingModal onDone={() => {}} />

      {/* Mapa fullscreen */}
      <div className="map-wrapper-outer">
        {/* Overlay de carga inicial */}
        {!mapLoaded && (
          <div className="map-loading-overlay" aria-label="Cargando mapa" aria-live="polite">
            <div className="map-loading-spinner" aria-hidden />
            <span className="map-loading-text">
              {gpsReady ? "Cargando reportes…" : "Buscando señal GPS…"}
            </span>
          </div>
        )}

        <MapView
          ref={mapRef}
          reports={filteredReports}
          routeMode={routeMode}
          onUserPositionChange={handleUserPositionChange}
          onGpsStatusChange={setGpsStatus}
          onRouteFound={handleRouteFound}
        />

        {/* ── Top bar (logo + botones) ──
             Desktop: hijos absolutos flotantes
             Móvil: barra fija, fila horizontal ── */}
        <div className="map-top-bar">
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
        </div>

        {/* ── Barra de búsqueda ──
             Desktop: centrada/flotante; Móvil: fila debajo del top bar ── */}
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

        {/* Tarjeta rápida post-captura */}
        {quickCapture && (
          <div className="quick-capture-card">
            {quickSubmitted ? (
              <div className="quick-capture-success">
                <span className="quick-capture-success-icon">✓</span>
                <p>¡Reporte enviado!</p>
              </div>
            ) : (
              <>
                <button
                  className="quick-capture-close"
                  onClick={handleQuickClose}
                  aria-label="Cancelar"
                >
                  ✕
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={quickCapture.previewUrl}
                  alt="Foto capturada"
                  className="quick-capture-photo"
                />
                <p className="quick-capture-title">📸 Foto capturada</p>
                {quickError && <p className="quick-capture-error">{quickError}</p>}
                <div className="quick-capture-actions">
                  <button
                    className="btn-primary quick-capture-btn"
                    onClick={handleQuickSubmit}
                    disabled={quickSubmitting}
                  >
                    {quickSubmitting ? "Enviando…" : "Enviar reporte"}
                  </button>
                  <button
                    className="quick-capture-manual"
                    onClick={handleQuickManual}
                  >
                    ✏️ Agregar datos manualmente
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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

        {/* Badge "Calculando ruta…" */}
        {routeCalculating && (
          <div className="route-calculating-badge" role="status" aria-live="polite">
            <div className="map-loading-spinner" aria-hidden />
            Calculando ruta…
          </div>
        )}
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

      {routeState.barriersOnRoute.length > 0 && !routeBarriersDismissed && (
        <RouteBarriersToast
          barriers={routeState.barriersOnRoute}
          userLat={userPosition[0]}
          userLng={userPosition[1]}
          onDismiss={() => setRouteBarriersDismissed(true)}
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
