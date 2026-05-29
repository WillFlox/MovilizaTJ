# Guía de configuración — MovilizaTJ

Esta guía cubre la configuración completa del entorno local y de producción.

---

## 1. Variables de entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

### Variables obligatorias (Supabase)

```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | API routes del servidor: insertar reportes, subir fotos, POIs, ubicaciones |
| `NEXT_PUBLIC_SUPABASE_*` | Cliente en navegador para **Supabase Realtime** (nuevos reportes en vivo) |

> **Seguridad:** La service role key nunca debe exponerse al cliente. Solo va en variables de servidor (sin prefijo `NEXT_PUBLIC_`).

### Variables opcionales

```env
GOOGLE_MAPS_API_KEY=AIza...
N8N_WEBHOOK_URL=https://tu-n8n/webhook/reportes
N8N_VOICE_WEBHOOK_URL=https://tu-n8n/webhook/voz
NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL=https://tu-n8n/webhook/clasificar-foto
```

---

## 2. Supabase

### 2.1 Crear proyecto

1. [supabase.com](https://supabase.com) → New project.
2. Anotar **Project URL** y **API keys** (Settings → API).

### 2.2 Ejecutar SQL

En **SQL Editor**, ejecutar en orden:

#### Paso 1 — Esquema base

Archivo: `supabase/schema.sql`

Crea:
- Extensión PostGIS
- Tabla `reportes` (barreras ciudadanas)
- Tabla `usuarios_activos` (tracking GPS)
- Bucket `reportes-fotos` (público lectura)
- Políticas RLS

#### Paso 2 — Puntos de interés

Archivo: `supabase/puntos-interes.sql`

Crea tabla `puntos_interes` e inserta 20 POIs reales de Tijuana.

#### Paso 3 — Datos de prueba (opcional)

Archivo: `supabase/seed-reportes.sql`

Inserta reportes de ejemplo para desarrollo.

#### Migración desde v1 (si aplica)

Archivo: `supabase/migration_from_v1.sql`

### 2.3 Habilitar Realtime

1. Dashboard → **Database** → **Replication**
2. Activar replicación para la tabla `reportes`

Sin esto, los reportes nuevos no aparecen en el mapa hasta recargar la página.

### 2.4 Verificar Storage

- Bucket `reportes-fotos` debe existir y ser público para lectura.
- Las subidas las hace el servidor con service role (política `Service role upload report photos`).

### 2.5 Checklist Supabase

- [ ] `schema.sql` ejecutado
- [ ] `puntos-interes.sql` ejecutado
- [ ] Realtime habilitado en `reportes`
- [ ] Bucket `reportes-fotos` accesible
- [ ] Variables en `.env.local` correctas

---

## 3. Google Places API (New)

Necesaria para búsqueda de destinos en la barra superior (`/api/places/search` y `/api/places/nearby`).

### 3.1 Google Cloud Console

1. Crear proyecto o usar existente.
2. **APIs & Services** → **Library** → habilitar **Places API (New)**.
3. **Credentials** → Create API key.

### 3.2 Restricciones de la API key

Las búsquedas se ejecutan **desde el servidor Next.js**, no desde el navegador.

| Restricción correcta | Restricción incorrecta |
|---------------------|------------------------|
| Ninguna | Referentes HTTP (websites) |
| Direcciones IP (IP del servidor Vercel) | — |

Restringe la key solo a **Places API (New)**.

### 3.3 Variable

```env
GOOGLE_MAPS_API_KEY=tu_api_key
```

Si no está configurada, `/api/health` reportará `googlePlaces: false` y la búsqueda de lugares devolverá HTTP 503.

---

## 4. Integraciones n8n (opcionales)

### 4.1 Notificación de reportes nuevos

```env
N8N_WEBHOOK_URL=https://tu-n8n/webhook/xxx
```

Al crear un reporte (`POST /api/reports`), el servidor envía un JSON con:

```json
{
  "message": "Barrera reportada (banqueta_danada): Lat 32.51, Lng -117.03",
  "latitud": 32.51,
  "longitud": -117.03,
  "tipo": "banqueta_danada",
  "descripcion": "...",
  "severidad": "media",
  "foto_url": "https://...",
  "fecha": "2026-05-29T..."
}
```

### 4.2 Clasificación de fotos (IA)

```env
NEXT_PUBLIC_N8N_CLASIFICAR_FOTO_URL=https://tu-n8n/webhook/clasificar-foto
```

El cliente (`lib/api-client.ts`) envía `multipart/form-data` con la foto y coordenadas **antes** de guardar el reporte.

Respuesta esperada:

```json
{
  "ok": true,
  "clasificacion": {
    "color": "ROJO",
    "tipo": "banqueta_danada",
    "descripcion": "Banqueta rota con desnivel",
    "severidad": "alta",
    "confianza": 0.92,
    "es_barrera": true
  }
}
```

Si la clasificación falla, el reporte se envía igual con los datos del usuario.

### 4.3 Asistente de voz

```env
N8N_VOICE_WEBHOOK_URL=https://tu-n8n/webhook/voz
```

Flujo:
1. Usuario graba audio en `VoiceChatbot`.
2. Cliente → `POST /api/voice-chat` (proxy).
3. Servidor reenvía a n8n con `latitude`, `longitude` y audio.
4. n8n responde con JSON (texto, audio base64, ruta, obstáculos).

Formatos de respuesta soportados: ver [ARQUITECTURA.md — Asistente de voz](ARQUITECTURA.md#asistente-de-voz).

---

## 5. Desarrollo local

```bash
npm install
npm run dev
```

URLs útiles:

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Aplicación |
| http://localhost:3000/api/health | Diagnóstico |

### Permisos del navegador

- **Geolocalización:** necesaria para GPS, reportes y verificación por proximidad.
- **Cámara / micrófono:** captura rápida de reportes y asistente de voz.

### HTTPS en local

Algunas APIs (`getUserMedia`) requieren contexto seguro. En localhost funciona; en red local puede necesitar HTTPS o `localhost` explícito.

---

## 6. Despliegue en Vercel

1. Conectar repositorio GitHub a Vercel.
2. Framework detectado: **Next.js** (ver `vercel.json`).
3. **Environment Variables:** agregar todas las de `.env.example` para Production y Preview.
4. Deploy.

### Dominio personalizado

1. Vercel → Project → Settings → Domains.
2. Agregar `movilizatj.online` (o tu dominio).
3. Configurar DNS según instrucciones de Vercel (registro A o CNAME).

### Post-deploy

```bash
curl https://movilizatj.online/api/health
```

Verificar `status: "ok"` y `supabaseConnected: true`.

---

## 7. Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Mapa sin reportes | Realtime deshabilitado o keys incorrectas | Habilitar Replication; revisar `NEXT_PUBLIC_*` |
| Error al guardar reporte | Service role key faltante | Configurar `SUPABASE_SERVICE_ROLE_KEY` |
| Google Places 403/502 | Key con restricción HTTP referrer | Cambiar a IP o Ninguno |
| Asistente de voz 503 | `N8N_VOICE_WEBHOOK_URL` vacía | Configurar webhook o desactivar UI |
| Fotos no se ven | Bucket no público o upload fallido | Revisar políticas Storage |
| Ruta no se dibuja | OSRM externo caído o sin GPS | Esperar; verificar permiso de ubicación |
| PATCH reporte 403 | Usuario lejos del reporte | Acercarse a ≤ 60 m |

---

## 8. Verificación final

Checklist antes de demo o producción:

- [ ] `/api/health` → `status: "ok"`
- [ ] Crear reporte con foto desde móvil
- [ ] Reporte aparece en mapa sin recargar (Realtime)
- [ ] Buscar destino y trazar ruta (modo segura y corta)
- [ ] Toast de proximidad al acercarse a un reporte
- [ ] (Opcional) Asistente de voz responde y traza ruta
- [ ] (Opcional) Clasificación IA en reporte con foto
