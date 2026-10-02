-- ============================================================
-- Migración CANÓNICA (rastread en git): facturación del colaborador
-- Ejecutar en Supabase → SQL Editor (idempotente, se puede re-ejecutar)
-- ============================================================
-- Contexto: el hardening (migracion-seguridad-rls.sql) dejó INSERT de
-- `facturas`/`pagos` solo-admin. El taller necesita que el colaborador
-- facture y cobre cuando el dueño no está. Este archivo es la fuente de
-- verdad versionada (los SQLs sueltos en docs/ están gitignored).
--
-- Reglas:
-- - Colaborador: INSERT en facturas, pagos y detalle + UPDATE de facturas
--   (para registrar el cobro). NUNCA delete, NUNCA anular.
-- - Anular (pendiente o pagada) y eliminar: solo administrador.
-- - La anulación de pagadas va por RPC atómico `anular_factura_atomica`
--   con motivo obligatorio (abajo).
--
-- NOTA: NO toca el RPC heredado `crear_factura_directa` (la app no lo
-- usa: inserta directo en tablas) ni `registrar_pago_atomico`.

-- ----------------------------------------------------------------
-- 1. INSERT en facturas: admin + colaborador (canónico, reemplaza
--    cualquier versión anterior suelta)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "facturas_insert_admin_colaborador" ON public.facturas;

CREATE POLICY "facturas_insert_admin_colaborador"
  ON public.facturas FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('administrador', 'colaborador'));

-- ----------------------------------------------------------------
-- 2. UPDATE en facturas: admin + colaborador (el cobro actualiza estado)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "facturas_update_admin_colaborador" ON public.facturas;

CREATE POLICY "facturas_update_admin_colaborador"
  ON public.facturas FOR UPDATE TO authenticated
  USING (get_user_role() IN ('administrador', 'colaborador'))
  WITH CHECK (get_user_role() IN ('administrador', 'colaborador'));

-- ----------------------------------------------------------------
-- 3. INSERT en pagos: admin + colaborador
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "pagos_insert_admin_colaborador" ON public.pagos;

CREATE POLICY "pagos_insert_admin_colaborador"
  ON public.pagos FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('administrador', 'colaborador'));

-- ----------------------------------------------------------------
-- 4. INSERT en detalle (canónico; ya existían con este mismo alcance)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "factura_det_rep_insert_admin_colaborador" ON public.factura_detalle_repuestos;

CREATE POLICY "factura_det_rep_insert_admin_colaborador"
  ON public.factura_detalle_repuestos FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('administrador', 'colaborador'));

DROP POLICY IF EXISTS "factura_det_serv_insert_admin_colaborador" ON public.factura_detalle_servicios;

CREATE POLICY "factura_det_serv_insert_admin_colaborador"
  ON public.factura_detalle_servicios FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('administrador', 'colaborador'));

-- ==================================================================
-- 5. RPC ATÓMICO: anular factura pendiente o pagada (solo admin)
--    Todo ocurre en una transacción: reversar pagos → devolver stock
--    (solo venta directa) → marcar anulada → fila de auditoría.
--    Si algo falla, NADA se aplica (rollback automático).
-- ==================================================================
DROP FUNCTION IF EXISTS public.anular_factura_atomica(uuid);
DROP FUNCTION IF EXISTS public.anular_factura_atomica(uuid, text);

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
  -- Solo el administrador (defensa en profundidad: el código TS también lo exige)
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
  IF v_estado = 'pagada' AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Para anular una factura pagada indica el motivo';
  END IF;

  -- 1. Reversar pagos asociados (solo existen si estaba pagada)
  DELETE FROM public.pagos WHERE factura_id = p_factura_id;

  -- 2. Devolver stock SOLO de venta directa. Las facturas desde orden
  --    tienen factura_detalle_repuestos vacío (el stock se descontó en la
  --    orden), así que este INSERT no hace nada en ese caso.
  INSERT INTO public.movimientos_inventario (repuesto_id, tipo, cantidad, motivo, usuario_id)
  SELECT repuesto_id, 'entrada', cantidad,
    'Devolución por anulación de factura', auth.uid()
  FROM public.factura_detalle_repuestos WHERE factura_id = p_factura_id;

  -- 3. Marcar anulada (la fila se conserva: la anulación no borra)
  UPDATE public.facturas SET estado_pago = 'anulada' WHERE id = p_factura_id;

  -- 4. Auditoría explícita con motivo y si hubo reversión de pago.
  --    OJO: `registro_id` es NOT NULL en la tabla real (verificado en vivo),
  --    y `accion` puede estar restringida a insert/update/delete: por eso se
  --    usa 'update' y el detalle (anulación, reversión, motivo) viaja en
  --    `datos_nuevos`.
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
      'operacion', CASE WHEN v_estado = 'pagada' THEN 'anular_pagada' ELSE 'anular' END,
      'pago_reversado', (v_estado = 'pagada'),
      'motivo', NULLIF(btrim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN jsonb_build_object('ok', true, 'pago_reversado', (v_estado = 'pagada'));
END;
$$;

-- ----------------------------------------------------------------
-- Verificación (correr después de aplicar):
-- SELECT policyname FROM pg_policies
--  WHERE tablename IN ('facturas','pagos','factura_detalle_repuestos','factura_detalle_servicios')
--  ORDER BY tablename, policyname;
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--  WHERE proname = 'anular_factura_atomica';
-- ----------------------------------------------------------------
