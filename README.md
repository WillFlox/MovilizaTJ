# MovilizaTJ — Mapa Ciudadano

Plataforma web ciudadana para **reportar barreras de movilidad** en Tijuana y **generar rutas accesibles** que evitan obstáculos reportados por la comunidad. Orientada a personas con movilidad reducida y discapacidad visual.

**Dominio de producción:** [movilizatj.online](https://movilizatj.online)

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Inicio rápido](#inicio-rápido)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Documentación detallada](#documentación-detallada)
- [Scripts disponibles](#scripts-disponibles)
- [Verificación de salud](#verificación-de-salud)
- [Despliegue](#despliegue)
- [Licencia y contexto](#licencia-y-contexto)

---

## Características

### Mapa interactivo
- Mapa centrado en Tijuana con **Leaflet** y tiles de OpenStreetMap.
- Marcadores de reportes con iconos por tipo de barrera y agrupación (clustering).
- Seguimiento GPS en tiempo real del usuario.
- Sincronización de ubicación con Supabase (`usuarios_activos`).

### Reportes ciudadanos
- Creación de reportes con ubicación GPS, tipo, severidad, descripción y foto opcional.
- **Captura rápida** con cámara del dispositivo.
- **Clasificación automática por IA** (webhook n8n) que sugiere tipo, severidad y descripción a partir de la foto.
- Fotos almacenadas en Supabase Storage (`reportes-fotos`).
- Actualización en tiempo real vía **Supabase Realtime** (INSERT/UPDATE en `reportes`).

### Rutas accesibles
- Búsqueda de destinos con **Google Places API (New)** o geocodificación con Nominatim.
- Dos modos de ruta:
  - **Más segura (`safest`):** evita barreras de severidad media/alta insertando waypoints de desvío (~1 cuadra lateral).
  - **Más corta (`fastest`):** ruta peatonal directa sin desvíos.
- Cálculo de ruta con **OSRM** (servidor peatonal de FOSSGIS).
- Detección de barreras sobre la polyline con distancia punto-a-segmento (buffer 30–50 m).
- Alertas de barreras en ruta y advertencias según perfil de accesibilidad.

### Perfiles de accesibilidad
- **Movilidad reducida:** prioriza tramos cortos, rampas y superficies firmes.
- **Discapacidad visual:** prioriza banquetas continuas y señalización clara.
- Advertencias contextuales al planificar rutas según barreras cercanas al destino.

### Puntos de interés (POI)
- Catálogo institucional en Tijuana (IMSS, hospitales, DIF, CESPT, etc.).
- Ranking por **score accesible:** `distancia + (barreras × 150)`.
- Destinos rápidos en la barra de búsqueda.

### Asistente de voz
- Chatbot accesible con grabación de audio.
- Proxy hacia webhook n8n (`N8N_VOICE_WEBHOOK_URL`).
- Respuestas en audio y/o texto; puede trazar rutas y mostrar obstáculos en el mapa.
- Fallback a **Web Speech API** para síntesis de voz.

### Verificación por proximidad
- Toast automático al acercarse a un reporte (< 40 m).
- El usuario puede confirmar que la barrera sigue presente o marcarla como **resuelta** (validación de proximidad en servidor: ≤ 60 m).

### Onboarding
- Tutorial de tres pasos para nuevos usuarios (persistido en `localStorage`).

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| UI | React 18, CSS modules / globals |
| Mapas | Leaflet, leaflet.markercluster, leaflet-routing-machine |
| Backend / BaaS | Supabase (PostgreSQL + PostGIS, Storage, Realtime) |
| Lugares | Google Places API (New) |
| Geocodificación | Nominatim (OpenStreetMap) |
| Rutas | OSRM vía routing.openstreetmap.de (perfil `foot`) |
| Automatización / IA | n8n (webhooks opcionales) |
| Deploy | Vercel |

---

## Inicio rápido

### Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- (Opcional) API key de Google Cloud con Places API (New)
- (Opcional) Instancia n8n para webhooks de voz, notificaciones y clasificación de fotos

### Instalación

```bash
git clone <url-del-repositorio>
cd Hackfox
npm install
cp .env.example .env.local
# Editar .env.local con tus credenciales
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Configuración de Supabase (obligatorio)

1. Crear proyecto en Supabase.
2. Ejecutar en el **SQL Editor**, en este orden:
   - `supabase/schema.sql`
   - `supabase/puntos-interes.sql` (POIs y seed de Tijuana)
   - `supabase/seed-reportes.sql` (opcional, datos de prueba)
3. Verificar bucket `reportes-fotos` (creado por el schema).
4. Habilitar **Realtime** en `Database → Replication` para la tabla `reportes`.
5. Copiar URL y keys a `.env.local`.

Guía paso a paso: [docs/CONFIGURACION.md](docs/CONFIGURACION.md)

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `SUPABASE_URL` | Sí | URL del proyecto Supabase (servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role key (solo servidor) |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Misma URL, expuesta al cliente (Realtime) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon key para Realtime en navegador |
| `GOOGLE_MAPS_API_KEY` | No* | Búsqueda de destinos con Google Places |
| `N8N_WEBHOOK_URL` | No | Notificación al crear reportes |
| `N8N_VOICE_WEBHOOK_URL` | No | Asistente de voz |
| `NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL` | No | Clasificación IA de fotos de reportes |

\* Sin Google Places, la búsqueda de destinos queda deshabilitada; el geocodificador Nominatim sigue disponible para rutas por voz.

Plantilla completa: [.env.example](.env.example)

---

## Estructura del proyecto

```
Hackfox/
├── app/
│   ├── layout.tsx              # Layout raíz, metadata
│   ├── page.tsx                # Página principal → MapClient
│   ├── globals.css
│   └── api/                    # Route Handlers (REST)
│       ├── health/             # Diagnóstico del sistema
│       ├── reports/            # CRUD de reportes
│       ├── pois/               # Puntos de interés accesibles
│       ├── places/             # Google Places (search, nearby)
│       ├── locations/          # Tracking de usuarios activos
│       ├── geocode/            # Nominatim proxy
│       └── voice-chat/         # Proxy asistente de voz → n8n
├── components/
│   ├── map-client.tsx          # Orquestador principal de la UI
│   ├── map-view.tsx            # Mapa Leaflet + GPS + rutas
│   ├── app-sidebar.tsx         # Panel lateral (reportes, filtros)
│   ├── app-header.tsx
│   ├── report-modal.tsx        # Formulario de reporte
│   ├── report-detail-modal.tsx
│   ├── camera-modal.tsx        # Captura rápida con cámara
│   ├── voice-chatbot.tsx       # Asistente de voz accesible
│   ├── places-search.tsx       # Búsqueda de destinos
│   ├── route-panel.tsx         # Info de ruta activa
│   ├── filter-bar.tsx          # Filtros tipo/severidad
│   ├── proximity-toast.tsx     # Verificación in situ
│   ├── route-barriers-toast.tsx
│   ├── onboarding-modal.tsx
│   └── profile-selector.tsx    # Perfil de accesibilidad
├── hooks/
│   ├── use-reports.ts          # Carga + Realtime de reportes
│   ├── use-accessibility-profile.ts
│   └── use-proximity-prompt.ts
├── lib/
│   ├── api-client.ts           # Cliente HTTP del navegador
│   ├── types.ts                # Tipos TypeScript compartidos
│   ├── constants.ts            # Tipos de barrera, POIs, perfiles
│   ├── geo.ts                  # Haversine, barreras en ruta, desvíos
│   ├── env.ts                  # Validación de entorno
│   ├── google-places.ts        # Cliente Google Places (New)
│   ├── voice-route.ts          # Parser respuestas n8n de voz
│   ├── supabase-admin.ts       # Cliente Supabase (service role)
│   └── supabase-browser.ts     # Cliente Supabase (anon, Realtime)
├── supabase/
│   ├── schema.sql
│   ├── puntos-interes.sql
│   ├── seed-reportes.sql
│   └── migration_from_v1.sql
├── docs/                       # Documentación detallada
├── .env.example
├── vercel.json
└── package.json
```

---

## Documentación detallada

| Documento | Contenido |
|-----------|-----------|
| [docs/CONFIGURACION.md](docs/CONFIGURACION.md) | Supabase, Google Cloud, n8n, Vercel |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Flujos de datos, componentes, decisiones técnicas |
| [docs/API.md](docs/API.md) | Referencia de endpoints REST |
| [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md) | Esquema SQL, RLS, Realtime |
| [docs/DESARROLLO.md](docs/DESARROLLO.md) | Guía de desarrollo y contribución |
| [docs/README.md](docs/README.md) | Índice de toda la documentación |
| [docs/FASE-0.md](docs/FASE-0.md) | Checklist histórico de consolidación inicial |

---

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo (puerto 3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # ESLint (eslint-config-next)
```

---

## Verificación de salud

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada cuando Supabase está bien configurado:

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

`status: "degraded"` indica variables faltantes o Supabase inaccesible.

---

## Despliegue

1. Subir el repositorio a GitHub.
2. Importar en [Vercel](https://vercel.com).
3. Configurar **todas** las variables de `.env.example`.
4. Deploy automático con `vercel.json`.
5. (Opcional) Dominio personalizado: `movilizatj.online`.

Detalle completo: [docs/CONFIGURACION.md#despliegue-en-vercel](docs/CONFIGURACION.md#despliegue-en-vercel)

---

## Licencia y contexto

Proyecto desarrollado en el contexto de **Hackfox** / hackathon ciudadana para mejorar la movilidad accesible en Tijuana, Baja California, México.

Para contribuir o reportar problemas, abre un issue en el repositorio o contacta al equipo del proyecto.
