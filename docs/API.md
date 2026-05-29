# Referencia API — MovilizaTJ

Base URL local: `http://localhost:3000`  
Base URL producción: `https://movilizatj.online`

Todas las respuestas son JSON salvo `/api/voice-chat` (puede devolver audio binario).

---

## Convenciones

| Campo común | Valores |
|-------------|---------|
| `status` | `"success"` \| `"error"` |
| Tipos de barrera | `banqueta_danada`, `rampa_bloqueada`, `bache`, `sin_rampa`, `transporte_inaccesible`, `obstaculo_general` |
| Severidad | `baja`, `media`, `alta` |
| Estado reporte | `pendiente`, `verificado`, `resuelto`, `rechazado` |

---

## GET `/api/health`

Diagnóstico del sistema. No requiere autenticación.

### Respuesta 200

```json
{
  "status": "ok",
  "phase": 0,
  "checks": {
    "supabase": true,
    "supabasePublic": true,
    "supabaseConnected": true,
    "googlePlaces": true,
    "n8n": false
  },
  "missing": [],
  "optional": {
    "googlePlaces": "Configurado",
    "n8n": "Opcional — webhooks deshabilitados"
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `status` | `"ok"` si Supabase obligatorio funciona; `"degraded"` si falta config |
| `checks.supabaseConnected` | Ping real a tabla `reportes` |
| `missing` | Lista de variables de entorno faltantes |

---

## GET `/api/reports`

Lista reportes activos visibles en el mapa.

### Query params

Ninguno.

### Respuesta 200

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "latitude": 32.5149,
      "longitude": -117.0382,
      "tipo": "banqueta_danada",
      "descripcion": "Desnivel en esquina",
      "foto_url": "https://...supabase.co/storage/v1/object/public/reportes-fotos/...",
      "estado": "pendiente",
      "severidad": "alta",
      "created_at": "2026-05-29T12:00:00.000Z"
    }
  ]
}
```

- Máximo **50** reportes.
- Solo estados `pendiente` y `verificado`.
- Orden: `created_at` descendente.

### Errores

| Código | Causa |
|--------|-------|
| 500 | Supabase no configurado o error de query |

---

## POST `/api/reports`

Crea un nuevo reporte ciudadano.

### Content-Type

- `multipart/form-data` (recomendado, soporta foto)
- `application/json` (sin foto)

### Body (multipart)

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `latitude` | number | Sí | Latitud WGS84 |
| `longitude` | number | Sí | Longitud WGS84 |
| `tipo` | string | No | Default: `obstaculo_general` |
| `descripcion` | string | No | Texto libre |
| `severidad` | string | No | Default: `media` |
| `photo` | File | No | Imagen JPEG/PNG |

Campos opcionales de clasificación IA (enviados por `api-client.ts`):

`clasificacion_color`, `clasificacion_tipo`, `clasificacion_descripcion`, `clasificacion_severidad`, `clasificacion_confianza`, `clasificacion_es_barrera`, `clasificacion_json`

> Nota: la clasificación IA no se persiste en columnas dedicadas del schema actual; se usa solo para enriquecer el insert.

### Body (JSON)

```json
{
  "latitude": 32.5149,
  "longitude": -117.0382,
  "tipo": "bache",
  "descripcion": "Bache profundo",
  "severidad": "media"
}
```

### Respuesta 200

```json
{
  "status": "success",
  "message": "Reporte guardado en Supabase.",
  "data": { /* ReportRecord */ }
}
```

### Errores

| Código | Mensaje típico |
|--------|----------------|
| 400 | Coordenadas inválidas / Tipo de barrera inválido |
| 500 | Error Supabase o env faltante |

### Efectos secundarios

- Sube foto a bucket `reportes-fotos` si se incluye `photo`.
- Dispara webhook `N8N_WEBHOOK_URL` si está configurado (fire-and-forget).

---

## PATCH `/api/reports/[id]`

Actualiza el estado de un reporte.

### Body

```json
{
  "estado": "resuelto",
  "userLatitude": 32.5149,
  "userLongitude": -117.0382
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `estado` | Sí | `resuelto`, `rechazado`, `verificado`, `pendiente` |
| `userLatitude` | Sí* | Latitud del usuario |
| `userLongitude` | Sí* | Longitud del usuario |

\* Requeridos cuando `estado` es `resuelto` o `verificado`.

### Validación de proximidad

El usuario debe estar a **≤ 60 m** del reporte para marcarlo `resuelto` o `verificado`.

### Respuesta 200

```json
{
  "status": "success",
  "data": { /* ReportRecord actualizado */ }
}
```

### Errores

| Código | Causa |
|--------|-------|
| 400 | Estado inválido / falta ubicación |
| 403 | Usuario demasiado lejos del reporte |
| 404 | Reporte no encontrado |
| 500 | Error de actualización |

---

## GET `/api/pois`

Puntos de interés institucionales ordenados por accesibilidad.

### Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `lat` | number | — | Latitud del usuario |
| `lng` | number | — | Longitud del usuario |
| `categoria` | string | — | Filtrar: `imss`, `hospital`, `farmacia`, etc. |
| `radius` | number | `8000` | Radio máximo en metros |

### Score accesible

```
score = distance_m + (barrier_count × 150)
```

Menor score = más accesible (más cerca y menos barreras en 500 m).

### Respuesta 200

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "nombre": "IMSS Clínica 1 — Tijuana",
      "categoria": "imss",
      "direccion": "Av. Padre Kino s/n, Col. Aviación",
      "latitude": 32.5178,
      "longitude": -117.0189,
      "activo": true,
      "created_at": "...",
      "barrier_count": 2,
      "distance_m": 450
    }
  ]
}
```

---

## GET `/api/places/search`

Búsqueda de lugares con Google Places API (New).

**Requiere** `GOOGLE_MAPS_API_KEY`.

### Query params

| Param | Requerido | Descripción |
|-------|-----------|-------------|
| `q` | Sí | Texto de búsqueda |
| `lat` | No | Sesgo de ubicación |
| `lng` | No | Sesgo de ubicación |

### Ejemplo

```
GET /api/places/search?q=IMSS&lat=32.51&lng=-117.03
```

### Respuesta 200

```json
{
  "status": "success",
  "data": [
    {
      "place_id": "places/ChIJ...",
      "name": "IMSS Clínica 1",
      "address": "Av. Padre Kino, Tijuana",
      "latitude": 32.5178,
      "longitude": -117.0189,
      "types": ["hospital", "health"]
    }
  ]
}
```

Máximo 8 resultados. La query se amplía automáticamente con `" Tijuana"`.

### Errores

| Código | Causa |
|--------|-------|
| 400 | Falta `q` |
| 502 | Error Google Places |
| 503 | API key no configurada |

---

## GET `/api/places/nearby`

Lugares cercanos por keyword o tipo.

### Query params

| Param | Requerido | Default |
|-------|-----------|---------|
| `lat` | Sí | — |
| `lng` | Sí | — |
| `keyword` | No | `"IMSS"` |

Tipos mapeados: `hospital` → Places type `hospital`; `farmacia` → `pharmacy`. Otros keywords usan text search.

### Respuesta

Igual estructura que `/api/places/search`.

---

## POST `/api/locations`

Registra o actualiza ubicación de usuario activo.

### Body

```json
{
  "latitude": 32.5149,
  "longitude": -117.0382,
  "usuario_id": "anonimo_tj"
}
```

| Campo | Default |
|-------|---------|
| `usuario_id` | `"anonimo_tj"` |

### Respuesta 200

```json
{
  "status": "success",
  "message": "Ubicación actualizada en Supabase.",
  "data": {
    "usuario_id": "anonimo_tj",
    "latitud": 32.5149,
    "longitud": -117.0382,
    "ultima_actualizacion": "2026-05-29T12:00:00.000Z"
  }
}
```

Upsert por `usuario_id` en tabla `usuarios_activos`.

---

## GET `/api/geocode`

Geocodifica texto a coordenadas en Tijuana vía Nominatim (proxy servidor).

### Query params

| Param | Requerido |
|-------|-----------|
| `q` | Sí |

### Ejemplo

```
GET /api/geocode?q=Hospital%20General%20Tijuana
```

Internamente busca: `{q}, Tijuana, Baja California, Mexico`

### Respuesta 200

```json
{
  "lat": 32.5156,
  "lng": -117.0362
}
```

### Errores

| Código | Causa |
|--------|-------|
| 400 | Falta `q` |
| 404 | Sin resultados |
| 502 | Nominatim no disponible |

Cache Next.js: `revalidate: 3600` (1 hora).

---

## POST `/api/voice-chat`

Proxy del asistente de voz hacia n8n.

**Requiere** `N8N_VOICE_WEBHOOK_URL`.

`maxDuration`: 60 segundos.

### Body (multipart/form-data)

Campos típicos enviados por el cliente:

| Campo | Descripción |
|-------|-------------|
| `audio` / archivo de audio | Grabación del usuario |
| `latitude` | Latitud GPS |
| `longitude` | Longitud GPS |
| `session_id` | ID de sesión local |

El proxy reenvía el FormData tal cual a n8n.

### Respuestas posibles

#### Audio binario (200)

```
Content-Type: audio/mpeg
```

#### JSON con ruta y audio (200)

```json
{
  "ok": true,
  "respuesta_texto": "Te llevo al IMSS más cercano...",
  "audio_base64": "base64...",
  "mime_type": "audio/mpeg",
  "ruta": {
    "destino": "IMSS Clínica 1",
    "origen_lat": 32.51,
    "origen_lng": -117.03,
    "destino_lat": 32.5178,
    "destino_lng": -117.0189,
    "obstaculos": [
      {
        "latitude": 32.515,
        "longitude": -117.025,
        "tipo": "banqueta_danada",
        "descripcion": "...",
        "distancia_metros": 120
      }
    ]
  },
  "obstaculos": []
}
```

#### Solo texto (200)

```json
{
  "text": "Respuesta del asistente"
}
```

### Errores

| Código | Causa |
|--------|-------|
| 502 | n8n error, respuesta vacía o formato no reconocido |
| 503 | Webhook no configurado |
| 500 | Error interno |

---

## Webhook externo: clasificación de fotos

**No es una ruta Next.js.** Se llama directamente desde el navegador.

URL: `NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL`

### POST (multipart)

| Campo | Descripción |
|-------|-------------|
| `foto` | Archivo imagen |
| `latitude` | number |
| `longitude` | number |
| `descripcion` | string (opcional) |
| `tipo` | string (opcional) |

### Respuesta esperada

```json
{
  "ok": true,
  "clasificacion": {
    "color": "ROJO",
    "tipo": "banqueta_danada",
    "descripcion": "Banqueta con grietas",
    "severidad": "alta",
    "confianza": 0.89,
    "es_barrera": true
  }
}
```

---

## Códigos HTTP resumen

| Código | Significado en esta API |
|--------|-------------------------|
| 200 | Éxito |
| 400 | Parámetros inválidos |
| 403 | Proximidad insuficiente (PATCH reporte) |
| 404 | Recurso no encontrado |
| 500 | Error interno / Supabase |
| 502 | Error servicio upstream (Google, n8n, Nominatim) |
| 503 | Servicio opcional no configurado |

---

## Realtime (no REST)

Canal Supabase en cliente: `reportes-live`

| Evento | Tabla | Acción en UI |
|--------|-------|--------------|
| INSERT | `reportes` | Agregar marcador |
| UPDATE | `reportes` | Actualizar o quitar si `resuelto`/`rechazado` |

Configuración: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
