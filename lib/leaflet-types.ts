export type RoutingNamespace = {
  control: (options: object) => import("leaflet").Control;
  osrmv1: (options?: { profile?: string; serviceUrl?: string }) => {
    route: (
      waypoints: unknown[],
      callback: (err: unknown, routes: unknown[]) => void
    ) => void;
  };
};

export type LeafletLike = {
  map: typeof import("leaflet").map;
  control: typeof import("leaflet").control;
  tileLayer: typeof import("leaflet").tileLayer;
  circle: typeof import("leaflet").circle;
  divIcon: typeof import("leaflet").divIcon;
  marker: typeof import("leaflet").marker;
  latLng: typeof import("leaflet").latLng;
  layerGroup: typeof import("leaflet").layerGroup;
  Routing: RoutingNamespace;
  // markerClusterGroup viene de leaflet.markercluster
  markerClusterGroup: (options?: object) => import("leaflet").LayerGroup;
};

import type { VoiceRouteObstacle } from "@/lib/types";

export type MapViewHandle = {
  drawRoute: (lat: number, lng: number, label?: string, avoidPoints?: [number, number][]) => void;
  clearRoute: () => void;
  paintVoiceObstacles: (obstaculos: VoiceRouteObstacle[]) => void;
  clearVoiceOverlay: () => void;
};
