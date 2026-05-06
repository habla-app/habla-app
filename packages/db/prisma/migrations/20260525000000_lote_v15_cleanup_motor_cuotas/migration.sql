-- Lote V.15 — Cleanup motor de cuotas (May 2026)
--
-- Drop tablas muertas que ningún path productivo lee:
--   - event_ids_externos: tabla de vinculación manual de event IDs por
--     casa. Único consumidor era VincularEventIdModal (UI eliminado en
--     V.14.3) + endpoint PATCH /event-ids (eliminado en V.15). El motor
--     V.12+ descubre eventos por matching automático de equipos vía XHR
--     intercept; no necesita hints.
--   - alias_equipos: tabla de auto-aprendizaje fuzzy (Lote V.7). La
--     única función que la leía (`matchearEquiposContraPartido`) no
--     tiene callers — los 5 scrapers V.12 hacen matching internamente
--     con `fuzzy-match.ts` directamente. La escritura via
--     `aprenderAlias` era un dead write.
--
-- Riesgo: BAJO. event_ids_externos.partidoId tiene FK ON DELETE CASCADE
-- hacia partidos (drop de la tabla cascadea limpio). alias_equipos es
-- standalone (sin FKs). Las tablas pueden contener filas pero ningún
-- path productivo las consume.
--
-- NO requiere backup pre-deploy: las tablas no contienen data
-- productiva.

DROP TABLE IF EXISTS "event_ids_externos";
DROP TABLE IF EXISTS "alias_equipos";
