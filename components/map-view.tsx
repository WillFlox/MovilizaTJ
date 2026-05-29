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
import type { ReportRecord } from "@/lib/types";
import type {
  Control,
  DivIcon,
  LayerGroup,
  Map as LeafletMap,
  Marker
} from "leaflet";

type MapViewProps = {
  reports: ReportRecord[];
  onMapClick: (latitude: number, longitude: number) => void;
  onUserPositionChange: (position: [number, number]) => void;
  onGpsStatusChange: (status: string) => void;
  onRouteRequest: (lat: number, lng: number, label?: string) => string | null;
};

export const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView(props, ref) {
    // Guardamos todos los callbacks en refs para que nunca causen
    // que el efecto de inicialización del mapa se destruya y recree.
    const onMapClickRef = useRef(props.onMapClick);
    const onUserPositionChangeRef = useRef(props.onUserPositionChange);
    const onGpsStatusChangeRef = useRef(props.onGpsStatusChange);
    const onRouteRequestRef = useRef(props.onRouteRequest);

    // Actualizamos las refs en cada render sin re-ejecutar efectos.
    onMapClickRef.current = props.onMapClick;
    onUserPositionChangeRef.current = props.onUserPositionChange;
    onGpsStatusChangeRef.current = props.onGpsStatusChange;
    onRouteRequestRef.current = props.onRouteRequest;

    const leafletRef = useRef<LeafletLike | null>(null);
    const mapInstanceRef = useRef<LeafletMap | null>(null);
    const userMarkerRef = useRef<Marker | null>(null);
    const routeControlRef = useRef<Control | null>(null);
    const coverageCircleRef = useRef<L.Circle | null>(null);
    const barriersLayerRef = useRef<LayerGroup | null>(null);
    const userPositionRef = useRef<[number, number]>(TIJUANA_CENTER);
    const watchIdRef = useRef<number | null>(null);

    // Estado (no ref) para que el efecto de marcadores se re-ejecute
    // cuando el mapa termina de inicializarse.
    const [mapReady, setMapReady] = useState(false);

    useImperativeHandle(ref, () => ({
      drawRoute(lat: number, lng: number, label?: string) {
        const map = mapInstanceRef.current;
        const L = leafletRef.current;
        if (!map || !L) return null;

        if (routeControlRef.current) {
          map.removeControl(routeControlRef.current);
        }

        routeControlRef.current = L.Routing.control({
          waypoints: [
            L.latLng(userPositionRef.current[0], userPositionRef.current[1]),
            L.latLng(lat, lng)
          ],
          lineOptions: {
            styles: [{ color: "#2563eb", opacity: 0.8, weight: 6 }]
          },
          addWaypoints: false,
          draggableWaypoints: false,
          routeWhileDragging: false,
          createMarker: () => null
        }).addTo(map);

        const warning = onRouteRequestRef.current(lat, lng, label);

        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<b>${label ?? "Destino"}</b>`)
          .openPopup();

        map.setView([lat, lng], 15);
        return warning;
      }
    }));

    // Re-dibuja marcadores de barreras cuando reports cambia O cuando
    // el mapa termina de estar listo (mapReady pasa a true).
    useEffect(() => {
      const map = mapInstanceRef.current;
      const L = leafletRef.current;
      if (!mapReady || !map || !L) return;

      if (barriersLayerRef.current) {
        barriersLayerRef.current.clearLayers();
      } else {
        // Usamos markerClusterGroup si está disponible, fallback a layerGroup
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

    // Inicialización del mapa — solo se ejecuta UNA VEZ gracias al array vacío.
    // Los callbacks se acceden via ref, así no causan re-inicialización.
    useEffect(() => {
      let cancelled = false;

      async function initializeMap() {
        if (mapInstanceRef.current || cancelled) return;

        const L = (await import("leaflet")) as unknown as LeafletLike;

        if (typeof window !== "undefined") {
          (window as unknown as { L: LeafletLike }).L = L;
        }

        await import("leaflet-routing-machine");
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

        // Cargamos leaflet.markercluster después de que Leaflet esté listo
        await import("leaflet.markercluster");

        coverageCircleRef.current = L.circle(TIJUANA_CENTER, {
          radius: 1700,
          color: "#2563eb",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.1,
          opacity: 0.55
        }).addTo(map);

        map.on("click", (event) => {
          onMapClickRef.current(
            Number(event.latlng.lat.toFixed(5)),
            Number(event.latlng.lng.toFixed(5))
          );
        });

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
        barriersLayerRef.current = null;
        setMapReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <main className="map-wrapper">
        <div className="map-helper">
          <strong>Tijuana Sin Barreras</strong>
          <span>
            Haz clic en el mapa para reportar una barrera. Busca tu destino en
            el panel para trazar una ruta accesible desde tu posición.
          </span>
        </div>
        <div id="map" />
      </main>
    );
  }
);
