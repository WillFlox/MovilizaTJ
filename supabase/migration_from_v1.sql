-- Migración si ya ejecutaste el schema.sql anterior (solo lat/lng)
-- Ejecutar en Supabase SQL Editor

create extension if not exists "postgis";

alter table public.reportes add column if not exists tipo text not null default 'obstaculo_general';
alter table public.reportes add column if not exists descripcion text;
alter table public.reportes add column if not exists foto_url text;
alter table public.reportes add column if not exists estado text not null default 'pendiente';
alter table public.reportes add column if not exists severidad text not null default 'media';

-- Columna geográfica generada (requiere PostGIS)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'reportes' and column_name = 'location'
  ) then
    alter table public.reportes add column location geography(Point, 4326)
      generated always as (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ) stored;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('reportes-fotos', 'reportes-fotos', true)
on conflict (id) do nothing;
