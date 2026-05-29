# MovilizaTJ — Tijuana Sin Barreras

Plataforma híbrida de accesibilidad multimodal para servicios públicos.

## Arquitectura híbrida

| Capa | Tecnología | Función |
|------|------------|---------|
| Mapa + rutas + barreras | **Leaflet** + OSRM | Mapa vivo, marcadores, ruteo peatonal |
| Reportes + fotos + GPS | **Supabase** (PostgreSQL + Storage + Realtime) | Persistencia y mapa en vivo |
| Búsqueda de destinos | **Google Places API** (solo servidor) | IMSS, hospitales, farmacias |
| Automatización | **n8n** (opcional) | Webhooks post-reporte |
| Deploy | **Vercel** + dominio propio | Producción |

## Configuración

1. `npm install`
2. Copia `.env.example` → `.env.local` y completa las variables
3. Ejecuta `supabase/schema.sql` en Supabase SQL Editor
   - Si ya tenías el schema anterior: usa `supabase/migration_from_v1.sql`
4. Habilita **Realtime** para la tabla `reportes` en Supabase Dashboard
5. En Google Cloud Console:
   - Activa **Places API (New)** (no la legacy)
   - Crea una API key para **servidor** con:
     - **Restricción de aplicación:** `Ninguno` (dev/hackathon) o `Direcciones IP` (prod)
     - **NO uses** `Referentes HTTP` — eso provoca `Requests from referer <empty> are blocked`
     - **Restricción de API:** solo `Places API (New)`
6. `npm run dev`

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | API Routes (servidor) |
| `NEXT_PUBLIC_SUPABASE_URL` | Realtime en cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Realtime en cliente |
| `GOOGLE_MAPS_API_KEY` | Búsqueda Places (solo API Routes) |
| `N8N_WEBHOOK_URL` | Opcional |

## Estructura del proyecto

```
components/map-client.tsx   ← orquestador principal
components/map-view.tsx     ← mapa Leaflet + GPS + rutas
components/app-sidebar.tsx  ← panel lateral
components/app-header.tsx   ← barra superior
components/report-modal.tsx ← formulario de reporte
hooks/use-reports.ts        ← carga + Realtime
lib/types.ts                ← tipos compartidos
```

## Verificación (Fase 0)

```bash
npm run dev
# Health check: http://localhost:3000/api/health
```

Ver checklist completo en [`docs/FASE-0.md`](docs/FASE-0.md).

## Endpoints

- `GET /api/health` — estado de Supabase, Google Places y env
- `GET/POST /api/reports` — reportes con foto, tipo, severidad
- `POST /api/locations` — tracking GPS
- `GET /api/places/search?q=...&lat=...&lng=...` — Google Text Search
- `GET /api/places/nearby?keyword=IMSS&lat=...&lng=...` — Google Nearby Search

## Flujo de usuario

1. **Reportar barrera:** clic en mapa → modal con tipo, foto, descripción → Supabase + n8n
2. **Buscar destino:** Google Places (IMSS, hospital) → ruta Leaflet desde tu GPS
3. **Mapa vivo:** nuevos reportes aparecen vía Supabase Realtime
4. **Alerta de barreras:** aviso si hay reportes cerca del destino (400 m)

## Despliegue

Despliega en Vercel, configura las variables de entorno y conecta `movilizatj.online`.
