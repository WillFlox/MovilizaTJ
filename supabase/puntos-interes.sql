-- ============================================================
-- Fase 4: Puntos de interés institucionales en Tijuana
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists public.puntos_interes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  categoria   text not null,
  direccion   text,
  latitude    double precision not null,
  longitude   double precision not null,
  location    geography(Point, 4326) generated always as (
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
              ) stored,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint puntos_interes_categoria_check check (
    categoria in (
      'imss', 'issste', 'hospital', 'dif', 'cespt', 'farmacia',
      'transporte', 'parque', 'educacion', 'gobierno'
    )
  )
);

create index if not exists poi_location_idx
  on public.puntos_interes using gist (location);
create index if not exists poi_categoria_idx
  on public.puntos_interes (categoria);

-- RLS: lectura pública, escritura solo service_role
alter table public.puntos_interes enable row level security;

drop policy if exists "Public read pois" on public.puntos_interes;
create policy "Public read pois"
  on public.puntos_interes for select to anon, authenticated
  using (activo = true);

drop policy if exists "Service role full access pois" on public.puntos_interes;
create policy "Service role full access pois"
  on public.puntos_interes for all to service_role
  using (true) with check (true);

-- ============================================================
-- SEED: 20 puntos reales en Tijuana
-- ============================================================

insert into public.puntos_interes (nombre, categoria, direccion, latitude, longitude) values

-- IMSS
('IMSS Clínica 1 — Tijuana',         'imss',    'Av. Padre Kino s/n, Col. Aviación',               32.5178, -117.0189),
('IMSS UMF 27 — Zona Río',           'imss',    'Blvd. Agua Caliente 4301, Zona Río',              32.5215, -117.0148),
('IMSS Hospital General de Zona 20', 'imss',    'Calle Caracol 7, Col. Cacho',                     32.5092, -117.0098),

-- ISSSTE
('ISSSTE Clínica Tijuana',           'issste',  'Av. Revolución 2550, Col. Hipódromo',             32.5260, -117.0380),

-- Hospitales
('Hospital General de Tijuana',      'hospital','Centenario 10851, Zona Río',                       32.5156, -117.0362),
('Hospital del Prado',               'hospital','Blvd. Insurgentes 2094, La Mesa',                  32.4881, -116.9712),
('Hospital Ángeles Tijuana',         'hospital','Blvd. Díaz Ordaz 4, Zona Río',                    32.5225, -117.0185),

-- DIF
('DIF Municipal Tijuana',            'dif',     'Av. Padre Kino 10090, Zona Río',                  32.5389, -116.9672),
('DIF Estatal Tijuana',              'dif',     'Blvd. General Rodolfo Sánchez Taboada 10401',     32.5167, -117.0064),

-- CESPT
('CESPT Oficinas Centrales',         'cespt',   'Blvd. Cuauhtémoc Sur 1001, Zona Río',             32.5198, -117.0220),
('CESPT Módulo Otay',                'cespt',   'Blvd. Fundadores 1800, Otay',                     32.5345, -116.9680),

-- Transporte público
('Central de Autobuses Tijuana',     'transporte','Blvd. Lázaro Cárdenas 4250, La Mesa',           32.4990, -116.9765),
('Terminal de Transferencia El Chaparral', 'transporte','Av. Internacional s/n, Centro',           32.5412, -117.0321),

-- Parques (accesibles)
('Parque Morelos',                   'parque',  'Av. Ocampo, Zona Centro',                         32.5278, -117.0285),
('Parque de la Amistad',             'parque',  'Blvd. Agua Caliente, Zona Río',                   32.5205, -117.0090),
('Parque Teniente Guerrero',         'parque',  'Av. Niños Héroes, Centro',                        32.5315, -117.0350),

-- Educación
('Universidad Autónoma de Baja California — Tijuana', 'educacion', 'Blvd. Universitario 1000, Otay', 32.4942, -116.9519),
('CETYS Universidad Tijuana',        'educacion','Av. CETYS s/n, Otay',                            32.5135, -116.9621),

-- Gobierno
('Palacio Municipal de Tijuana',     'gobierno','Calle 1ra. y Constitución, Zona Centro',           32.5342, -117.0380),
('Registro Civil Tijuana',           'gobierno','Av. Padre Kino 9950, Zona Río',                   32.5377, -116.9665);

-- Verificar
select categoria, count(*) from public.puntos_interes group by categoria order by categoria;
