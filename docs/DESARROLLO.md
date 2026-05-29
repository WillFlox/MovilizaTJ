# Guía de desarrollo — MovilizaTJ

Guía para contribuir y extender el proyecto.

---

## Requisitos del entorno

- **Node.js** 18 o superior
- **npm** 9+
- Editor con soporte TypeScript (VS Code / Cursor recomendado)
- Cuenta Supabase configurada (ver [CONFIGURACION.md](CONFIGURACION.md))

---

## Configuración inicial

```bash
git clone <repo>
cd Hackfox
npm install
cp .env.example .env.local
# Completar variables Supabase como mínimo
npm run dev
```

Alias de importación: `@/*` → raíz del proyecto (ver `tsconfig.json`).

---

## Estructura de código

### Convenciones

| Área | Convención |
|------|------------|
| Componentes React | PascalCase, archivos `.tsx` en `components/` |
| Hooks | `use-*.ts` en `hooks/` |
| API routes | `app/api/{recurso}/route.ts` |
| Tipos compartidos | `lib/types.ts` |
| Constantes de dominio | `lib/constants.ts` |
| Cliente Supabase servidor | `getSupabaseAdmin()` |
| Cliente Supabase navegador | `getSupabaseBrowser()` |

### Patrón de componentes

- `"use client"` en componentes con estado, efectos o APIs del navegador.
- `app/page.tsx` y `app/layout.tsx` son Server Components mínimos.
- El mapa Leaflet vive en cliente; la inicialización ocurre una vez con refs.

### Estado

- **Global de sesión:** `MapClient` (useState + useCallback).
- **Reportes:** `useReports` (fetch + Realtime).
- **Persistencia local:** `localStorage` para onboarding, session ID, perfil.

---

## Flujos para desarrollar

### Agregar un tipo de barrera

1. Agregar entrada en `BARRIER_TYPES` (`lib/constants.ts`).
2. Actualizar constraint SQL en `supabase/schema.sql`:
   ```sql
   -- en reportes_tipo_check
   ```
3. Actualizar tipo `FotoClasificacion.tipo` en `lib/api-client.ts` si la IA lo usa.
4. Verificar iconos en mapa (`BARRIER_ICONS` se genera automáticamente).

### Agregar endpoint API

1. Crear `app/api/mi-recurso/route.ts`.
2. Usar `getSupabaseAdmin()` para operaciones de escritura.
3. Validar inputs; devolver `{ status, data | message }`.
4. Documentar en [API.md](API.md).
5. (Opcional) Exponer función en `lib/api-client.ts` si lo consume el navegador.

### Modificar lógica de rutas

Archivos clave:
- `lib/geo.ts` — detección barreras, waypoints de desvío
- `components/map-view.tsx` — integración OSRM / Leaflet Routing Machine
- `components/map-client.tsx` — `buildAvoidPoints`, `handleRouteFound`

Buffers configurables en `map-client.tsx`:

```typescript
const ROUTE_BUFFER: Record<RouteMode, number> = {
  fastest: 30,
  safest: 50
};
```

### Agregar categoría POI

1. Entrada en `POI_CATEGORIES` (`lib/constants.ts`).
2. Constraint en `supabase/puntos-interes.sql`.
3. Seed de datos si aplica.

---

## Linting y build

```bash
npm run lint     # ESLint (eslint-config-next)
npm run build    # Verificar que compila antes de PR
```

TypeScript en modo `strict`. Tipos Leaflet extendidos en `lib/leaflet-types.ts` y `types/leaflet-routing-machine.d.ts`.

---

## Debugging

### Health check

```bash
curl http://localhost:3000/api/health | jq
```

### Supabase Realtime

Abrir DevTools → Network → WS. Debe existir conexión WebSocket a Supabase cuando hay reportes cargados.

### Logs del asistente de voz

El servidor loguea payload n8n en consola:

```
[voice-chat] payload de n8n: { pide_ruta, destino_ruta, ... }
```

### Clasificación de fotos

Console del navegador:

```
Clasificación de foto: { tipo, severidad, ... }
```

---

## Pruebas manuales recomendadas

| Escenario | Pasos |
|-----------|-------|
| Reporte básico | Tocar mapa → modal → enviar sin foto |
| Reporte con cámara | Botón cámara → capturar → enviar rápido |
| Realtime | Dos pestañas; crear reporte en una; ver en otra |
| Ruta segura | Buscar destino → modo "Más segura" → verificar desvío |
| Proximidad | Acercarse GPS a reporte (< 40 m) → toast |
| Resolver reporte | Toast → "Ya no está" → verificar PATCH |
| Voz | Abrir chatbot → grabar → verificar ruta en mapa |
| Filtros | Sidebar → filtrar por tipo/severidad |
| POI | Destino rápido IMSS → ver ranking accesible |

---

## Despliegue de cambios SQL

1. Probar en proyecto Supabase de desarrollo.
2. Documentar en `supabase/` con comentarios.
3. Ejecutar en producción vía SQL Editor antes o después del deploy de código dependiente.

---

## Dependencias principales

```json
{
  "next": "^15.1.5",
  "react": "^18.3.1",
  "@supabase/supabase-js": "^2.57.2",
  "leaflet": "^1.9.4",
  "leaflet-routing-machine": "^3.2.12",
  "leaflet.markercluster": "^1.5.3"
}
```

No hay framework CSS externo; estilos en `app/globals.css` y CSS inline/modules por componente.

---

## Roadmap sugerido

Basado en `docs/FASE-0.md` y el estado actual del código:

- [x] Fase 0 — Consolidación (componentes, hooks, API client, health)
- [x] Perfiles de accesibilidad en UI
- [x] Flujo de reportes con cámara e IA
- [x] Rutas accesibles con desvío
- [x] POIs institucionales
- [x] Asistente de voz
- [x] Verificación por proximidad
- [ ] Panel de moderación admin
- [ ] Autenticación ciudadana
- [ ] Persistir metadata de clasificación IA en BD
- [ ] Tests automatizados (Playwright / Vitest)
- [ ] PWA offline

---

## Recursos relacionados

- [README.md](../README.md) — Visión general
- [CONFIGURACION.md](CONFIGURACION.md) — Setup Supabase, Google, n8n
- [ARQUITECTURA.md](ARQUITECTURA.md) — Diseño técnico
- [API.md](API.md) — Endpoints REST
- [BASE-DE-DATOS.md](BASE-DE-DATOS.md) — Esquema SQL
- [FASE-0.md](FASE-0.md) — Checklist inicial
