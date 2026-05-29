-- MovilizaTJ — esquema híbrido (Leaflet + Supabase + Google Places)
-- Ejecutar en Supabase SQL Editor

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- Reportes ciudadanos de barreras
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  latitude double precision not null,
  longitude double precision not null,
  location geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) stored,
  tipo text not null default 'obstaculo_general',
  descripcion text,
  foto_url text,
  estado text not null default 'pendiente',
  severidad text not null default 'media',
  created_at timestamptz not null default now(),
  constraint reportes_tipo_check check (
    tipo in (
      'banqueta_danada',
      'rampa_bloqueada',
      'bache',
      'sin_rampa',
      'transporte_inaccesible',
      'obstaculo_general'
    )
  ),
  constraint reportes_estado_check check (
    estado in ('pendiente', 'verificado', 'resuelto', 'rechazado')
  ),
  constraint reportes_severidad_check check (
    severidad in ('baja', 'media', 'alta')
  )
);

create index if not exists reportes_location_idx on public.reportes using gist (location);
create index if not exists reportes_created_at_idx on public.reportes (created_at desc);
create index if not exists reportes_estado_idx on public.reportes (estado);

-- Usuarios activos (tracking GPS)
create table if not exists public.usuarios_activos (
  usuario_id text primary key,
  latitud double precision not null,
  longitud double precision not null,
  ultima_actualizacion timestamptz not null default now()
);

-- Bucket para fotos de reportes
insert into storage.buckets (id, name, public)
values ('reportes-fotos', 'reportes-fotos', true)
on conflict (id) do nothing;

-- RLS
alter table public.reportes enable row level security;
alter table public.usuarios_activos enable row level security;

drop policy if exists "Service role full access reportes" on public.reportes;
create policy "Service role full access reportes"
on public.reportes for all to service_role
using (true) with check (true);

drop policy if exists "Public read reportes activos" on public.reportes;
create policy "Public read reportes activos"
on public.reportes for select to anon, authenticated
using (estado in ('pendiente', 'verificado'));

drop policy if exists "Service role full access usuarios_activos" on public.usuarios_activos;
create policy "Service role full access usuarios_activos"
on public.usuarios_activos for all to service_role
using (true) with check (true);

-- Storage policies
drop policy if exists "Public read report photos" on storage.objects;
create policy "Public read report photos"
on storage.objects for select to public
using (bucket_id = 'reportes-fotos');

drop policy if exists "Service role upload report photos" on storage.objects;
create policy "Service role upload report photos"
on storage.objects for insert to service_role
with check (bucket_id = 'reportes-fotos');

-- Habilitar Realtime en Dashboard > Database > Replication > reportes

-- Migración desde esquema anterior (descomentar si aplica):
-- alter table public.reportes add column if not exists tipo text not null default 'obstaculo_general';
-- alter table public.reportes add column if not exists descripcion text;
-- alter table public.reportes add column if not exists foto_url text;
-- alter table public.reportes add column if not exists estado text not null default 'pendiente';
-- alter table public.reportes add column if not exists severidad text not null default 'media';
