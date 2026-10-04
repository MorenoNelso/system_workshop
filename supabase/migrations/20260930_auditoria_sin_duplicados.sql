-- ============================================================
-- Auditoría sin duplicados: eliminar triggers viejos en facturas/pagos
-- Ejecutar en Supabase → SQL Editor (idempotente)
-- ============================================================
-- Causa: en facturas y pagos disparaban DOS triggers por evento —
-- los viejos trg_audit_facturas/pagos (funciones-triggers-taller-motos)
-- más los nuevos audit_facturas/pagos (migracion-seguridad-rls).
-- Cada INSERT/UPDATE/DELETE escribía 2 filas casi idénticas.
--
-- Se conservan los nuevos (audit_*) y TODOS los de repuestos, tasas y
-- empleados (esos no tienen reemplazo y hay que seguir auditándolos).
-- Las filas históricas duplicadas se dejan (no se borra historial).

DROP TRIGGER IF EXISTS trg_audit_facturas ON public.facturas;
DROP TRIGGER IF EXISTS trg_audit_pagos ON public.pagos;

-- Verificación: debe salir 1 trigger de auditoría por tabla.
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid IN ('public.facturas'::regclass, 'public.pagos'::regclass)
--    AND NOT tgisinternal ORDER BY tgname;
-- Esperado: audit_facturas, audit_pagos (y NADA con prefijo trg_audit_).
