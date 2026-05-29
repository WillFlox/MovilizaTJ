# Fase 0 — Consolidación ✅

> Documento histórico. Para documentación actualizada ver [README.md](../README.md) y [docs/README.md](README.md).

Checklist para dejar la base estable antes de Fase 1+.

## Código (completado en repo)

- [x] Refactor de `map-client.tsx` en componentes:
  - `components/app-header.tsx`
  - `components/app-sidebar.tsx`
  - `components/map-view.tsx`
  - `components/report-modal.tsx` (formulario de reporte)
- [x] Hook `hooks/use-reports.ts` (carga + Realtime)
- [x] Tipos compartidos en `lib/types.ts`:
  - `BarrierType`, `ReportStatus`, `ReportSeverity`
  - `AccessibilityProfile`, `ReportSubmitPayload`, `RouteState`
- [x] Constantes de perfiles en `lib/constants.ts` (`ACCESSIBILITY_PROFILES`)
- [x] Cliente API centralizado `lib/api-client.ts`
- [x] Validación de entorno `lib/env.ts`
- [x] Health check `GET /api/health`
- [x] Config Vercel `vercel.json`

## Supabase (manual)

- [ ] Ejecutar `supabase/schema.sql` (o `migration_from_v1.sql`)
- [ ] Crear bucket `reportes-fotos` si no existe
- [ ] Habilitar **Realtime** en tabla `reportes`
- [ ] Verificar `.env.local`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Google Places (manual)

- [ ] Activar **Places API (New)** en Google Cloud
- [ ] API key con restricción **Ninguno** o **IP** (no Referentes HTTP)
- [ ] `GOOGLE_MAPS_API_KEY` en `.env.local`

## Verificación local

```bash
npm run dev
```

Abrir:

- App: http://localhost:3000
- Health: http://localhost:3000/api/health

Respuesta esperada de health:

```json
{
  "status": "ok",
  "checks": {
    "supabase": true,
    "supabasePublic": true,
    "supabaseConnected": true,
    "googlePlaces": true,
    "n8n": false
  }
}
```

## Deploy Vercel (manual)

1. Subir repo a GitHub
2. Importar proyecto en [vercel.com](https://vercel.com)
3. Agregar **todas** las variables de `.env.example`
4. Deploy
5. En Vercel → Settings → Domains → agregar `movilizatj.online`
6. En tu registrador de dominio, apuntar DNS según indique Vercel

## Estructura actual

```
app/
  api/health/route.ts      ← diagnóstico
  api/reports/route.ts
  api/places/search/route.ts
  api/places/nearby/route.ts
  api/locations/route.ts
components/
  map-client.tsx           ← orquestador
  map-view.tsx             ← Leaflet
  app-sidebar.tsx
  app-header.tsx
  report-modal.tsx
  places-search.tsx
hooks/use-reports.ts
lib/types.ts, constants.ts, env.ts, api-client.ts
supabase/schema.sql
```

## Siguiente paso

**Fase 1** — Perfil de accesibilidad en UI y refinamiento del flujo de reportes.
