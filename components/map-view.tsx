"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { BARRIER_ICONS, TIJUANA_CENTER } from "@/lib/constants";
import type { LeafletLike, MapViewHandle } from "@/lib/leaflet-types";
import { syncUserLocation } from "@/lib/api-client";
import type { ReportRecord, VoiceRouteObstacle } from "@/lib/types";
import type { RouteFoundData, RouteMode } from "@/lib/types";
import type {
  Control,
  DivIcon,
  LayerGroup,
  Map as LeafletMap,
  Marker
} from "leaflet";

type RoutingControl = Control & {
  on: (event: string, handler: (e: unknown) => void) => RoutingControl;
};

type RouteFoundEvent = {
  routes: Array<{
    summary: { totalDistance: number; totalTime: number };
    coordinates: Array<{ lat: number; lng: number }>;
  }>;
};

function routePointsFromCoordinates(
  coordinates: Array<{ lat: number; lng: number }>
): [number, number][] {
  return coordinates.map((c) => [c.lat, c.lng]);
}

type MapViewProps = {
  reports: ReportRecord[];
  routeMode: RouteMode;
  onUserPositionChange: (position: [number, number]) => void;
  onGpsStatusChange: (status: string) => void;
  onRouteFound: (data: RouteFoundData) => void;
};

export const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView(props, ref) {
    // Todos los callbacks en refs: nunca causan re-inicialización del mapa.
    const onUserPositionChangeRef = useRef(props.onUserPositionChange);
    const onGpsStatusChangeRef = useRef(props.onGpsStatusChange);
    const onRouteFoundRef = useRef(props.onRouteFound);
    const routeModeRef = useRef(props.routeMode);

    onUserPositionChangeRef.current = props.onUserPositionChange;
    onGpsStatusChangeRef.current = props.onGpsStatusChange;
    onRouteFoundRef.current = props.onRouteFound;
    routeModeRef.current = props.routeMode;

    const leafletRef = useRef<LeafletLike | null>(null);
    const mapInstanceRef = useRef<LeafletMap | null>(null);
    const userMarkerRef = useRef<Marker | null>(null);
    const destMarkerRef = useRef<Marker | null>(null);
    const routeControlRef = useRef<RoutingControl | null>(null);
    const coverageCircleRef = useRef<L.Circle | null>(null);
    const barriersLayerRef = useRef<LayerGroup | null>(null);
    const voiceObstaclesLayerRef = useRef<LayerGroup | null>(null);
    const userPositionRef = useRef<[number, number]>(TIJUANA_CENTER);
    const watchIdRef = useRef<number | null>(null);

    const [mapReady, setMapReady] = useState(false);

    useImperativeHandle(ref, () => ({
      drawRoute(lat: number, lng: number, label?: string, avoidPoints?: [number, number][], isTransportRoute?: boolean) {
        const map = mapInstanceRef.current;
        const L = leafletRef.current;
        if (!map || !L) return;

        if (routeControlRef.current) {
          map.removeControl(routeControlRef.current);
          routeControlRef.current = null;
        }
        if (destMarkerRef.current) {
          destMarkerRef.current.remove();
          destMarkerRef.current = null;
        }

        const isSafest = routeModeRef.current === "safest";
        const routeColor = isSafest ? "#10b981" : "#2563eb";

        const viaWaypoints = (avoidPoints ?? []).map(([wLat, wLng]) =>
          L.latLng(wLat, wLng)
        );

        const control = L.Routing.control({
          // routing.openstreetmap.de/routed-foot es el servidor OSRM público de
          // FOSSGIS compilado exclusivamente para rutas peatonales (foot).
          // project-osrm.org solo tiene el perfil "driving" disponible.
          router: L.Routing.osrmv1({
            serviceUrl: "https://routing.openstreetmap.de/routed-foot/route/v1",
            profile: "driving"
          }),
          waypoints: [
            L.latLng(userPositionRef.current[0], userPositionRef.current[1]),
            ...viaWaypoints,
            L.latLng(lat, lng)
          ],
          lineOptions: {
            styles: [{ color: routeColor, opacity: 0.85, weight: 6 }]
          },
          addWaypoints: false,
          draggableWaypoints: false,
          routeWhileDragging: false,
          createMarker: () => null,
          show: false
        }).addTo(map) as RoutingControl;

        // leaflet-routing-machine dispara "routesfound", no "routefound"
        control.on("routesfound", (e: unknown) => {
          const event = e as RouteFoundEvent;
          const route = event.routes[0];
          if (!route) return;
          onRouteFoundRef.current({
            distance: route.summary.totalDistance,
            duration: route.summary.totalTime,
            routePoints: routePointsFromCoordinates(route.coordinates),
            destLat: lat,
            destLng: lng,
            label: label ?? "Destino"
          });
        });

        routeControlRef.current = control;

        const destIcon = L.icon({
          iconUrl: isTransportRoute ? "/taxi.webp" : "/pin.png",
          iconSize: [48, 48],
          iconAnchor: [24, 48],
          popupAnchor: [0, -50]
        });

        destMarkerRef.current = L.marker([lat, lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>${label ?? "Destino"}</b>`)
          .openPopup();

        map.setView([lat, lng], 15);
      },

      clearRoute() {
        const map = mapInstanceRef.current;
        if (!map) return;
        if (routeControlRef.current) {
          map.removeControl(routeControlRef.current);
          routeControlRef.current = null;
        }
        if (destMarkerRef.current) {
          destMarkerRef.current.remove();
          destMarkerRef.current = null;
        }
      },

      clearVoiceOverlay() {
        if (voiceObstaclesLayerRef.current) {
          voiceObstaclesLayerRef.current.clearLayers();
        }
      },

      paintVoiceObstacles(obstaculos: VoiceRouteObstacle[]) {
        const map = mapInstanceRef.current;
        const L = leafletRef.current;
        if (!map || !L || !Array.isArray(obstaculos)) return;

        if (!voiceObstaclesLayerRef.current) {
          voiceObstaclesLayerRef.current = L.layerGroup().addTo(map);
        } else {
          voiceObstaclesLayerRef.current.clearLayers();
        }

        obstaculos.forEach((obs) => {
          if (!obs.latitude || !obs.longitude) return;

          const tipo = obs.tipo
            ? String(obs.tipo).replace(/_/g, " ")
            : "Sin tipo";
          const distancia = obs.distancia_metros
            ? `${obs.distancia_metros} metros`
            : "Distancia no disponible";

          const icon = L.divIcon({
            className: "voice-obstacle-marker",
            html: `<div class="voice-obstacle-pin">⚠️</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          L.marker([Number(obs.latitude), Number(obs.longitude)], { icon })
            .bindPopup(
              `<div style="min-width:160px">
                <strong>Obstáculo reportado</strong><br>
                ${obs.descripcion ?? "Sin descripción"}<br>
                <span style="color:#ef4444;font-size:11px">Tipo: ${tipo}</span><br>
                <span style="font-size:11px">Distancia: ${distancia}</span>
              </div>`
            )
            .addTo(voiceObstaclesLayerRef.current!);
        });
      },

    }));

    // Re-dibuja marcadores cuando cambian reportes o cuando el mapa está listo.
    useEffect(() => {
      const map = mapInstanceRef.current;
      const L = leafletRef.current;
      if (!mapReady || !map || !L) return;

      if (barriersLayerRef.current) {
        barriersLayerRef.current.clearLayers();
      } else {
        barriersLayerRef.current = (L.markerClusterGroup
          ? L.markerClusterGroup({
              maxClusterRadius: 50,
              showCoverageOnHover: false,
              spiderfyOnMaxZoom: true
            })
          : L.layerGroup()
        ).addTo(map);
      }

      props.reports.forEach((report) => {
        const icon = BARRIER_ICONS[report.tipo] ?? "📍";
        const severityColor =
          report.severidad === "alta"
            ? "#ef4444"
            : report.severidad === "media"
              ? "#f59e0b"
              : "#10b981";

        const markerIcon = L.divIcon({
          className: "barrier-marker",
          html: `<div class="barrier-pin" style="border-color:${severityColor}">${icon}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const popupContent = `
          <div style="min-width:180px">
            <div class="popup-title">${icon} ${report.tipo.replace(/_/g, " ")}</div>
            <div class="popup-text">${report.descripcion ?? "Sin descripción"}</div>
            <div style="margin-top:6px;font-size:11px;color:${severityColor};font-weight:700">
              Severidad: ${report.severidad}
            </div>
            ${
              report.foto_url
                ? `<img src="${report.foto_url}" alt="Foto reporte" style="width:100%;margin-top:8px;border-radius:8px" />`
                : ""
            }
          </div>
        `;

        L.marker([report.latitude, report.longitude], { icon: markerIcon })
          .bindPopup(popupContent)
          .addTo(barriersLayerRef.current!);
      });
    }, [props.reports, mapReady]);

    // Inicialización del mapa — solo una vez (array vacío).
    useEffect(() => {
      let cancelled = false;

      async function initializeMap() {
        if (mapInstanceRef.current || cancelled) return;

        const L = (await import("leaflet")) as unknown as LeafletLike;

        if (typeof window !== "undefined") {
          (window as unknown as { L: LeafletLike }).L = L;
        }

        await import("leaflet-routing-machine");
        await import("leaflet.markercluster");
        leafletRef.current = L;

        const map = L.map("map", {
          zoomControl: false,
          attributionControl: false
        }).setView(TIJUANA_CENTER, 13);

        mapInstanceRef.current = map;

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          { maxZoom: 20, subdomains: "abcd" }
        ).addTo(map);

        coverageCircleRef.current = L.circle(TIJUANA_CENTER, {
          radius: 1700,
          color: "#2563eb",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.1,
          opacity: 0.55
        }).addTo(map);

        setTimeout(() => map.invalidateSize(), 400);

        if (!cancelled) {
          setMapReady(true);
        }

        startGpsTracking(map, L, cancelled);
      }

      function startGpsTracking(
        map: LeafletMap,
        L: LeafletLike,
        cancelledRef: boolean
      ) {
        if (!("geolocation" in navigator)) {
          onGpsStatusChangeRef.current("GPS no soportado");
          return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            if (cancelledRef) return;

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            userPositionRef.current = [lat, lng];
            onUserPositionChangeRef.current([lat, lng]);
            onGpsStatusChangeRef.current("📍 GPS activo");

            const customUserIcon: DivIcon = L.divIcon({
              className: "user-pulse-marker",
              html: '<div class="user-dot"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });

            if (!userMarkerRef.current) {
              userMarkerRef.current = L.marker([lat, lng], {
                icon: customUserIcon
              })
                .addTo(map)
                .bindPopup("<b>Tu posición actual</b>")
                .openPopup();
              map.setView([lat, lng], 15);
            } else {
              userMarkerRef.current.setLatLng([lat, lng]);
            }

            coverageCircleRef.current?.setLatLng([lat, lng]);
            syncUserLocation(lat, lng).catch(() => null);
          },
          () => onGpsStatusChangeRef.current("⚠️ Ubicación fija (TJ)"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      }

      initializeMap().catch(() => null);

      return () => {
        cancelled = true;
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        destMarkerRef.current = null;
        barriersLayerRef.current = null;
        voiceObstaclesLayerRef.current = null;
        routeControlRef.current = null;
        setMapReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <main className="map-wrapper">
        <div id="map" />
      </main>
    );
  }
);
