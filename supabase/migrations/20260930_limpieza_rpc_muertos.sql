-- ============================================================
-- Migración: eliminar RPCs muertos (nunca los llama la app)
-- Ejecutar en Supabase → SQL Editor (idempotente, se puede re-ejecutar)
-- ============================================================
-- Verificado por grep en lib/, app/ y components/: la única llamada RPC
-- de facturación en uso es `anular_factura_atomica(uuid, text)`.
-- Estas tres funciones quedaron de migraciones viejas y solo estorban
-- en revisiones futuras. NO tocar anular_factura_atomica(uuid, text).
--
-- Signaturas tomadas de docs/migracion-seguridad-rls.sql (gitignored).

DROP FUNCTION IF EXISTS public.crear_factura_directa(uuid, uuid, numeric, numeric, jsonb, jsonb, uuid);
DROP FUNCTION IF EXISTS public.registrar_pago_atomico(uuid, numeric, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.eliminar_factura_atomica(uuid);

-- Verificación (debe devolver 1 sola fila: anular_factura_atomica/2 args):
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--  WHERE proname LIKE '%factura%' OR proname LIKE '%pago_atomico%';
