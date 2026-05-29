-- ============================================================
-- SEED: Reportes de barreras de accesibilidad en Tijuana
-- Ejecutar en Supabase SQL Editor para poblar el mapa con
-- datos reales de zonas críticas de la ciudad.
-- ============================================================

INSERT INTO reportes (latitude, longitude, tipo, descripcion, severidad, estado, created_at)
VALUES

-- ── Zona Centro / Av. Revolución ──────────────────────────────
(32.5299, -117.0358, 'banqueta_danada',
 'Banqueta completamente rota frente a farmacia. Imposible pasar en silla de ruedas.',
 'alta', 'pendiente', now() - interval '2 hours'),

(32.5290, -117.0372, 'sin_rampa',
 'Esquina sin rebaje de banqueta. Vehículos estacionados bloquean la bocacalle.',
 'alta', 'pendiente', now() - interval '5 hours'),

(32.5275, -117.0345, 'obstaculo_general',
 'Puesto semifijo ocupa toda la acera. No hay paso peatonal.',
 'media', 'pendiente', now() - interval '1 day'),

-- ── IMSS Clínica 1 (Av. Padre Kino) ──────────────────────────
(32.5178, -117.0189, 'rampa_bloqueada',
 'Rampa de acceso al IMSS bloqueada por vehículo estacionado.',
 'alta', 'pendiente', now() - interval '30 minutes'),

(32.5171, -117.0195, 'banqueta_danada',
 'Tramo de 20 m con banqueta inexistente camino al IMSS. Hay que caminar sobre la calle.',
 'alta', 'pendiente', now() - interval '3 hours'),

(32.5185, -117.0182, 'sin_rampa',
 'Cruce peatonal sin rebaje. Personas en silla de ruedas deben dar vuelta a la manzana.',
 'media', 'verificado', now() - interval '2 days'),

-- ── Hospital General de Tijuana (Centenario) ──────────────────
(32.5156, -117.0362, 'bache',
 'Bache grande en la entrada al hospital. Hace difícil el acceso con carriola.',
 'media', 'pendiente', now() - interval '6 hours'),

(32.5149, -117.0370, 'banqueta_danada',
 'Loseta levantada y desnivel de 12 cm en acceso principal al hospital.',
 'alta', 'pendiente', now() - interval '1 day'),

-- ── Zona Río / Plaza Río ──────────────────────────────────────
(32.5230, -117.0141, 'sin_rampa',
 'Acceso al paso peatonal del Blvd. Agua Caliente sin rampa en ninguno de los lados.',
 'alta', 'pendiente', now() - interval '4 hours'),

(32.5215, -117.0130, 'transporte_inaccesible',
 'Parada de camión sin espacio para silla de ruedas. El vehículo no baja rampa.',
 'media', 'pendiente', now() - interval '8 hours'),

(32.5238, -117.0158, 'banqueta_danada',
 'Banqueta angosta con árbol que la rompe. Paso de apenas 30 cm.',
 'baja', 'pendiente', now() - interval '3 days'),

-- ── Otay / DIF Municipal ──────────────────────────────────────
(32.5389, -116.9672, 'rampa_bloqueada',
 'Rampa de acceso al DIF bloqueada con conos de construcción desde hace 2 semanas.',
 'alta', 'verificado', now() - interval '12 hours'),

(32.5401, -116.9660, 'bache',
 'Calle en muy mal estado, zona Otay. Camino principal al DIF.',
 'media', 'pendiente', now() - interval '2 days'),

-- ── Zona Este / Clínica ISSSTE ────────────────────────────────
(32.5101, -116.9990, 'banqueta_danada',
 'Banqueta inexistente en tramo de 50 m. Adultos mayores caminan en la calle.',
 'alta', 'pendiente', now() - interval '5 hours'),

(32.5092, -116.9978, 'sin_rampa',
 'Cruce en zona escolar sin señalización ni rampa accesible.',
 'media', 'pendiente', now() - interval '1 day'),

-- ── Playas de Tijuana ──────────────────────────────────────────
(32.5307, -117.1218, 'transporte_inaccesible',
 'Ruta costera no cuenta con unidades accesibles en horario matutino.',
 'baja', 'pendiente', now() - interval '2 days'),

(32.5289, -117.1194, 'obstaculo_general',
 'Rampa de playa en mal estado. Superficie de arena sin compactar imposible para silla de ruedas.',
 'media', 'pendiente', now() - interval '4 days'),

-- ── Zona Norte / El Chaparral ─────────────────────────────────
(32.5412, -117.0321, 'banqueta_danada',
 'Banqueta completamente rota en Calle 2. Zona de alto tráfico peatonal hacia el cruce.',
 'alta', 'pendiente', now() - interval '1 hour'),

(32.5420, -117.0309, 'sin_rampa',
 'Cruce peatonal Internacional sin rebaje accesible en lado norte.',
 'alta', 'pendiente', now() - interval '6 hours'),

-- ── Colonia Libertad ──────────────────────────────────────────
(32.5068, -116.9842, 'bache',
 'Colonia Libertad: baches en toda la calle principal, imposible para silla de ruedas.',
 'alta', 'pendiente', now() - interval '3 hours'),

(32.5079, -116.9855, 'rampa_bloqueada',
 'Rampa cubierta de basura y escombros. Reportada 3 veces sin solución.',
 'alta', 'pendiente', now() - interval '5 days');

-- Verificar inserción
SELECT COUNT(*) AS total_reportes FROM reportes;
