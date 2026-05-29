export type RoutingNamespace = {
  control: (options: object) => import("leaflet").Control;
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

export type MapViewHandle = {
  drawRoute: (lat: number, lng: number, label?: string) => void;
  clearRoute: () => void;
};
