# Arquitectura — MovilizaTJ

## Visión general

MovilizaTJ es una aplicación **Next.js 15** de página única (`app/page.tsx`) que renderiza el componente orquestador `MapClient`. La arquitectura separa:

- **UI y estado local** → componentes React + hooks
- **Lógica de dominio** → `lib/` (geo, tipos, constantes)
- **Persistencia y servicios externos** → API Routes (`app/api/`)
- **Tiempo real** → Supabase Realtime en el cliente

```mermaid
flowchart TB
  subgraph Browser["Navegador"]
    MC[MapClient]
    MV[MapView - Leaflet]
    Hooks[useReports / useProximity / useAccessibility]
    MC --> MV
    MC --> Hooks
  end

  subgraph NextAPI["Next.js API Routes"]
    Reports[/api/reports]
    POIs[/api/pois]
    Places[/api/places]
    Voice[/api/voice-chat]
    Health[/api/health]
  end

  subgraph External["Servicios externos"]
    SB[(Supabase PostgreSQL + Storage + Realtime)]
    GP[Google Places API]
    OSRM[OSRM FOSSGIS - rutas peatonales]
    N8N[n8n webhooks]
    NOM[Nominatim OSM]
  end

  Hooks -->|fetch REST| Reports
  Hooks -->|Realtime INSERT/UPDATE| SB
  MC -->|submitReport| Reports
  MV -->|OSRM routing| OSRM
  Reports --> SB
  POIs --> SB
  Places --> GP
  Voice --> N8N
  MC -->|geocode voz| NOM
```

---

## Capas de la aplicación

### 1. Orquestador — `MapClient`

Archivo: `components/map-client.tsx`

Responsabilidades:
- Estado global de la sesión (GPS, ruta, filtros, modales).
- Composición de sidebar, mapa, búsqueda, modales y toasts.
- Coordinación entre reportes, rutas y asistente de voz.
- Filtrado de reportes por tipo/severidad y radio cercano.

Estados principales:

| Estado | Descripción |
|--------|-------------|
| `userPosition` | Coordenadas GPS actuales |
| `routeMode` | `"safest"` \| `"fastest"` |
| `routeState` | Destino, distancia, duración, barreras en ruta |
| `filters` | Tipos y severidades activos |
| `pendingReport` | Ubicación pendiente de formulario de reporte |

### 2. Mapa — `MapView`

Archivo: `components/map-view.tsx`

- Inicializa Leaflet una sola vez (refs para evitar re-mount).
- `watchPosition` para GPS continuo.
- Capa de marcadores con **MarkerCluster**.
- **Leaflet Routing Machine** + OSRM perfil peatonal (`routing.openstreetmap.de/routed-foot`).
- Expone imperativamente `drawRoute`, `clearRoute`, `showVoiceObstacles` vía `MapViewHandle`.

Modos de ruta:

| Modo | Color | Waypoints de desvío | Buffer barreras |
|------|-------|---------------------|-----------------|
| `safest` | Verde `#10b981` | Sí (computeDetourWaypoints) | 50 m |
| `fastest` | Azul `#2563eb` | No | 30 m |

### 3. Hooks

#### `useReports`

- Carga inicial: `GET /api/reports`.
- Suscripción Realtime a `reportes` (INSERT, UPDATE).
- Elimina del mapa reportes con estado `resuelto` o `rechazado`.
- Límite local: `REPORT_LIMIT` (50).

#### `useAccessibilityProfile`

- Perfil activo: `movilidad_reducida` | `discapacidad_visual`.
- `getRouteWarning`: cuenta barreras en radio 400 m / 300 m cerca del destino.

#### `useProximityPrompt`

- Umbral de entrada: **40 m** (detección de cruce, no polling continuo).
- Toast con opciones: descartar, confirmar presente, marcar resuelto.
- Resolución: `PATCH /api/reports/:id` con validación servidor ≤ **60 m**.

### 4. Cliente API — `lib/api-client.ts`

Funciones del navegador:

| Función | Descripción |
|---------|-------------|
| `getMovilizaSessionId()` | UUID persistente en localStorage |
| `submitReport()` | Clasifica foto (n8n) → POST multipart a `/api/reports` |
| `syncUserLocation()` | POST a `/api/locations` |

Flujo de reporte con foto:

```
Usuario captura foto
    → clasificarFotoConN8n() [opcional]
    → merge tipo/severidad/descripcion IA + usuario
    → POST /api/reports (multipart)
    → Supabase insert + Storage upload
    → Realtime INSERT → otros clientes actualizan mapa
    → n8n webhook notificación [opcional]
```

### 5. Geometría — `lib/geo.ts`

| Función | Uso |
|---------|-----|
| `distanceMeters` | Haversine entre dos puntos |
| `countNearbyBarriers` | Barreras en radio alrededor de un punto |
| `getBarriersOnRoute` | Distancia punto-a-segmento sobre polyline OSRM |
| `computeDetourWaypoints` | Waypoints laterales (~110 m) para evitar cuadra con barreras |

Algoritmo de desvío (`safest`):
1. Proyectar barreras sobre línea origen→destino.
2. Filtrar las dentro de buffer 100 m del trayecto.
3. Agrupar en cluster; elegir lado perpendicular (izq/der).
4. Generar 2 waypoints: antes y después del cluster (+ margen 8%).
5. Máximo 1 cluster → evita zigzags en OSRM.

---

## API Routes (servidor)

Todas usan `getSupabaseAdmin()` excepto health check parcial.

Ver referencia completa: [API.md](API.md)

Resumen:

| Ruta | Métodos | Backend |
|------|---------|---------|
| `/api/health` | GET | Env + ping Supabase |
| `/api/reports` | GET, POST | Supabase `reportes` + Storage |
| `/api/reports/[id]` | PATCH | Update estado + proximidad |
| `/api/pois` | GET | Supabase `puntos_interes` + score |
| `/api/places/search` | GET | Google Places Text Search |
| `/api/places/nearby` | GET | Google Places Nearby |
| `/api/locations` | POST | Supabase `usuarios_activos` upsert |
| `/api/geocode` | GET | Nominatim proxy (Tijuana) |
| `/api/voice-chat` | POST | Proxy → n8n voice webhook |

---

## Asistente de voz

Componente: `components/voice-chatbot.tsx`  
Proxy: `app/api/voice-chat/route.ts`  
Parser: `lib/voice-route.ts`

### Flujo

```
Usuario graba audio (MediaRecorder)
    → FormData: audio + latitude + longitude + session_id
    → POST /api/voice-chat
    → POST N8N_VOICE_WEBHOOK_URL
    → Respuesta: audio | JSON con ruta/obstáculos
    → Cliente: reproduce audio, llama onRouteReceived / onObstaclesReceived
    → MapClient geocodifica destino si falta lat/lng
    → MapView.drawRoute()
```

### Formatos de respuesta n8n soportados

**Audio binario directo** — `Content-Type: audio/*`

**JSON con ruta anidada:**
```json
{
  "ruta": {
    "destino": "IMSS Clínica 1",
    "destino_lat": 32.5178,
    "destino_lng": -117.0189,
    "obstaculos": [...]
  },
  "audio_base64": "...",
  "respuesta_texto": "Te guío al IMSS más cercano..."
}
```

**JSON con flags planos (n8n):**
```json
{
  "pide_ruta": true,
  "destino_ruta": "Hospital General",
  "reportes_encontrados": [...],
  "respuesta_texto": "...",
  "audio_base64": "..."
}
```

Campos alternativos reconocidos: `obstaculos`, `obstacles`, `reportes_encontrados`, `destino`, `destination`, etc.

---

## Seguridad y permisos

### Supabase RLS

| Tabla | Lectura pública | Escritura |
|-------|-----------------|-----------|
| `reportes` | Solo `pendiente`, `verificado` | Solo `service_role` |
| `usuarios_activos` | No (service_role) | Solo `service_role` |
| `puntos_interes` | Solo `activo = true` | Solo `service_role` |
| `storage.reportes-fotos` | Lectura pública | Solo `service_role` |

No hay autenticación de usuarios finales: la app opera como ciudadano anónimo con session ID local.

### Validaciones servidor

- Coordenadas finitas en POST reportes/ubicaciones.
- Tipos de barrera y severidad en whitelist.
- Cierre de reporte (`resuelto`/`verificado`) requiere proximidad ≤ 60 m.

### Claves expuestas al cliente

Solo `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL`. La anon key está limitada por RLS.

---

## Tipos de barrera

Definidos en `lib/constants.ts`:

| Valor | Etiqueta |
|-------|----------|
| `banqueta_danada` | Banqueta dañada |
| `rampa_bloqueada` | Rampa bloqueada |
| `bache` | Bache / pavimento |
| `sin_rampa` | Sin rampa de acceso |
| `transporte_inaccesible` | Transporte inaccesible |
| `obstaculo_general` | Otro obstáculo |

Estados: `pendiente` → `verificado` → `resuelto` | `rechazado`

Severidades: `baja`, `media`, `alta`

---

## Dependencias externas en runtime

| Servicio | Uso | Fallback |
|----------|-----|----------|
| OpenStreetMap tiles | Mapa base | — |
| OSRM FOSSGIS | Rutas peatonales | Alerta en UI |
| Nominatim | Geocodificar destinos de voz | Alert al usuario |
| Google Places | Búsqueda destinos UI | Deshabilitado si no hay key |
| Supabase | DB, Storage, Realtime | App degradada |
| n8n | IA, voz, notificaciones | Funciones opcionales omitidas |

---

## Decisiones técnicas

1. **Página única SPA-like:** toda la UX vive en `MapClient` para minimizar latencia de mapa/GPS.
2. **Service role en API routes:** simplifica uploads y writes sin auth de usuarios; RLS protege lectura.
3. **Realtime solo en cliente:** reduce carga del servidor; el hook `useReports` gestiona el canal.
4. **Refs en MapView:** evita re-inicializar Leaflet en cada render de React.
5. **Clasificación IA en cliente:** reduce carga del servidor Next; el webhook n8n es público (considerar rate limit en producción).
6. **Rutas peatonales OSRM:** coherente con accesibilidad; no usa perfil `driving`.

---

## Extensibilidad

Puntos naturales para ampliar:

- **Auth ciudadana:** Supabase Auth + políticas RLS por usuario.
- **Panel admin:** rutas protegidas para verificar/rechazar reportes.
- **Notificaciones push:** service worker + Supabase Edge Functions.
- **Offline-first:** cache de reportes en IndexedDB.
- **OSRM propio:** variable de entorno para URL de routing self-hosted.
