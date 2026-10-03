-- ============================================================
-- Una orden puede tener UNA sola factura ACTIVA; las anuladas liberan.
-- Ejecutar en Supabase → SQL Editor (idempotente)
-- ============================================================
-- Antes: idx_facturas_orden_unica impedía facturar de nuevo una orden
-- anulada (la refacturación tras corregir errores era imposible).
-- Ahora: la unicidad solo rige para facturas no anuladas. Las ventas
-- directas (orden_id NULL) siguen sin colisionar.
--
-- Requiere: el código filtra por estado (ordenYaTieneFactura ignora
-- 'anulada' y listOrdenesFacturables pide estado_pago).

DROP INDEX IF EXISTS public.idx_facturas_orden_unica;

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_orden_activa
  ON public.facturas (orden_id)
  WHERE orden_id IS NOT NULL AND estado_pago <> 'anulada';

-- Verificación:
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE tablename = 'facturas' AND indexname LIKE 'idx_facturas_orden%';
-- Debe salir SOLO idx_facturas_orden_activa con WHERE ... <> 'anulada'.
