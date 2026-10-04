-- ============================================================
-- Fiados por cuotas: estado intermedio + motivo en anulación con cobros
-- Ejecutar en Supabase → SQL Editor (idempotente)
-- ============================================================
-- El taller fía: un pago puede cubrir solo parte del total.
-- Nuevo estado `cuotas` (= "En cuotas" en UI). Sin límite mínimo por
-- abono (se acuerda verbal); el sistema solo bloquea sobrepago y $0.
--
-- 1. Ampliar el CHECK de estado_pago (nombre real del constraint varía;
--    se detecta y reemplaza dinámicamente).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.facturas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%estado_pago%'
  LOOP
    EXECUTE format('ALTER TABLE public.facturas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_estado_pago_check
  CHECK (estado_pago IN ('pendiente', 'cuotas', 'pagada', 'anulada'));

-- 2. Anulación: motivo exigible también en cuotas (ya hay dinero movido).
--    Reemplaza la versión anterior (misma firma, cuerpo actualizado).
CREATE OR REPLACE FUNCTION public.anular_factura_atomica(
  p_factura_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_numero integer;
  v_total numeric;
BEGIN
  IF public.get_user_role() != 'administrador' THEN
    RAISE EXCEPTION 'Solo el administrador puede anular facturas';
  END IF;

  SELECT estado_pago, numero_consecutivo, total
    INTO v_estado, v_numero, v_total
    FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe';
  END IF;
  IF v_estado = 'anulada' THEN
    RAISE EXCEPTION 'La factura ya está anulada';
  END IF;
  IF v_estado IN ('pagada', 'cuotas') AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Para anular una factura con cobros indica el motivo';
  END IF;

  -- 1. Reversar TODOS los pagos asociados (uno o varios abonos)
  DELETE FROM public.pagos WHERE factura_id = p_factura_id;

  -- 2. Devolver stock SOLO de venta directa (detalle vacío en órdenes:
  --    ahí el stock se descontó en la orden, no hay doble devolución).
  INSERT INTO public.movimientos_inventario (repuesto_id, tipo, cantidad, motivo, usuario_id)
  SELECT repuesto_id, 'entrada', cantidad,
    'Devolución por anulación de factura', auth.uid()
  FROM public.factura_detalle_repuestos WHERE factura_id = p_factura_id;

  -- 3. Marcar anulada (la fila se conserva: la anulación no borra)
  UPDATE public.facturas SET estado_pago = 'anulada' WHERE id = p_factura_id;

  -- 4. Auditoría explícita (registro_id es NOT NULL en la tabla real;
  --    accion 'update' por el CHECK de la tabla).
  INSERT INTO public.logs_auditoria (usuario_id, tabla_afectada, registro_id, accion, datos_anteriores, datos_nuevos)
  VALUES (
    auth.uid(),
    'facturas',
    p_factura_id,
    'update',
    jsonb_build_object('factura_id', p_factura_id, 'estado_pago', v_estado),
    jsonb_build_object(
      'factura_id', p_factura_id,
      'numero_consecutivo', v_numero,
      'total', v_total,
      'estado_pago', 'anulada',
      'operacion', CASE WHEN v_estado IN ('pagada', 'cuotas') THEN 'anular_pagada' ELSE 'anular' END,
      'pago_reversado', (v_estado IN ('pagada', 'cuotas')),
      'motivo', NULLIF(btrim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN jsonb_build_object('ok', true, 'pago_reversado', (v_estado IN ('pagada', 'cuotas')));
END;
$$;

-- ----------------------------------------------------------------
-- Verificación:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.facturas'::regclass AND contype = 'c';
-- Debe salir facturas_estado_pago_check con IN ('pendiente','cuotas','pagada','anulada').
-- ----------------------------------------------------------------
