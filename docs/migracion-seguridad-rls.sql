-- ==========================================================================
-- MIGRACIÓN DE SEGURIDAD — Auditoría RLS completa
-- Ejecutar en Supabase SQL Editor ANTES de desplegar a producción.
-- ==========================================================================

-- ==========================================================================
-- 1. FIX CRÍTICO: Privilege escalation en usuarios
--    La política self_select no tenía WITH CHECK, permitiendo al
--    colaborador cambiarse el rol a 'administrador'.
-- ==========================================================================

-- Eliminar la política self_select antigua (SELECT only, sin WITH CHECK)
DROP POLICY IF EXISTS "usuarios_self_select" ON public.usuarios;

-- Recrear con SELECT + UPDATE separados
CREATE POLICY "usuarios_self_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "usuarios_self_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT rol FROM public.usuarios WHERE id = auth.uid())
    AND activo = (SELECT activo FROM public.usuarios WHERE id = auth.uid())
  );

-- ==========================================================================
-- 2. FIX CRÍTICO: Borrar políticas permisivas de facturas y pagos
--    migracion-colaborador-factura.sql creó INSERT/UPDATE con WITH CHECK(true)
--    que nunca se borraron. PostgreSQL ORa políticas → la más permisiva gana.
-- ==========================================================================

-- Facturas: borrar las políticas abiertas
DROP POLICY IF EXISTS "facturas_insert_authenticated" ON public.facturas;
DROP POLICY IF EXISTS "facturas_update_authenticated" ON public.facturas;

-- Pagos: borrar la política INSERT abierta
DROP POLICY IF EXISTS "pagos_insert_authenticated" ON public.pagos;

-- Asegurar que existan las políticas admin-only correctas
-- (migracion-rls-usuario-facturas.sql ya las creó, pero verificamos)
DO $$
BEGIN
  -- Si no existen las políticas admin, crearlas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'facturas_insert_admin' AND tablename = 'facturas'
  ) THEN
    CREATE POLICY "facturas_insert_admin" ON public.facturas
      FOR INSERT TO authenticated
      WITH CHECK (get_user_role() = 'administrador');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'facturas_update_admin' AND tablename = 'facturas'
  ) THEN
    CREATE POLICY "facturas_update_admin" ON public.facturas
      FOR UPDATE TO authenticated
      USING (get_user_role() = 'administrador')
      WITH CHECK (get_user_role() = 'administrador');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'pagos_insert_admin' AND tablename = 'pagos'
  ) THEN
    CREATE POLICY "pagos_insert_admin" ON public.pagos
      FOR INSERT TO authenticated
      WITH CHECK (get_user_role() = 'administrador');
  END IF;
END $$;

-- ==========================================================================
-- 3. FIX CRÍTICO: Agregar controles de rol a funciones SECURITY DEFINER
--    Cualquier usuario autenticado podía llamar estas funciones y bypassar RLS.
-- ==========================================================================

-- 3a. crear_factura_directa
CREATE OR REPLACE FUNCTION crear_factura_directa(
  p_cliente_id uuid,
  p_moneda_id uuid,
  p_total numeric,
  p_tasa_aplicada numeric,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_servicios jsonb DEFAULT '[]'::jsonb,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_factura_id uuid;
  v_rep jsonb;
  v_svc jsonb;
  vResultado jsonb;
BEGIN
  -- CONTROL DE ROL: Solo administradores
  IF public.get_user_role() != 'administrador' THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear facturas directas';
  END IF;

  INSERT INTO facturas (cliente_id, moneda_id, subtotal, total, tasa_aplicada, estado_pago, usuario_id)
  VALUES (p_cliente_id, p_moneda_id, p_total, p_total, p_tasa_aplicada, 'pendiente', p_usuario_id)
  RETURNING id INTO v_factura_id;

  FOR v_rep IN SELECT * FROM jsonb_array_elements(p_repuestos)
  LOOP
    INSERT INTO factura_detalle_repuestos (factura_id, repuesto_id, cantidad, precio_unitario_aplicado, precio_costo_aplicado, moneda_id)
    VALUES (
      v_factura_id,
      (v_rep->>'repuesto_id')::uuid,
      (v_rep->>'cantidad')::int,
      (v_rep->>'precio_unitario_aplicado')::numeric,
      (v_rep->>'precio_costo_aplicado')::numeric,
      (v_rep->>'moneda_id')::uuid
    );
  END LOOP;

  FOR v_rep IN SELECT * FROM jsonb_array_elements(p_repuestos)
  LOOP
    INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, motivo, usuario_id)
    VALUES (
      (v_rep->>'repuesto_id')::uuid,
      'salida',
      (v_rep->>'cantidad')::int,
      'Venta directa — factura ' || (SELECT numero_consecutivo FROM facturas WHERE id = v_factura_id),
      p_usuario_id
    );
  END LOOP;

  FOR v_svc IN SELECT * FROM jsonb_array_elements(p_servicios)
  LOOP
    INSERT INTO factura_detalle_servicios (factura_id, empleado_id, descripcion, monto, porcentaje_comision_aplicado, comision_calculada)
    VALUES (
      v_factura_id,
      (v_svc->>'empleado_id')::uuid,
      v_svc->>'descripcion',
      (v_svc->>'monto')::numeric,
      (v_svc->>'porcentaje_comision_aplicado')::numeric,
      (v_svc->>'comision_calculada')::numeric
    );
  END LOOP;

  SELECT jsonb_build_object('id', f.id, 'numero_consecutivo', f.numero_consecutivo, 'total', f.total)
  INTO vResultado
  FROM facturas f WHERE f.id = v_factura_id;

  RETURN vResultado;
END;
$$;

-- 3b. registrar_pago_atomico
CREATE OR REPLACE FUNCTION registrar_pago_atomico(
  p_factura_id uuid,
  p_monto numeric,
  p_moneda_id uuid,
  p_metodo text,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.get_user_role() != 'administrador' THEN
    RAISE EXCEPTION 'Solo los administradores pueden registrar pagos';
  END IF;

  INSERT INTO pagos (factura_id, monto, moneda_id, metodo_pago, registrado_por)
  VALUES (p_factura_id, p_monto, p_moneda_id, p_metodo, p_usuario_id);

  UPDATE facturas SET estado_pago = 'pagada' WHERE id = p_factura_id;
END;
$$;

-- 3c. anular_factura_atomica
CREATE OR REPLACE FUNCTION anular_factura_atomica(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rep RECORD;
BEGIN
  IF public.get_user_role() != 'administrador' THEN
    RAISE EXCEPTION 'Solo los administradores pueden anular facturas';
  END IF;

  FOR v_rep IN
    SELECT repuesto_id, cantidad FROM factura_detalle_repuestos WHERE factura_id = p_factura_id
  LOOP
    INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, motivo)
    VALUES (v_rep.repuesto_id, 'entrada', v_rep.cantidad, 'Devolución por anulación de factura');
  END LOOP;

  UPDATE facturas SET estado_pago = 'anulada' WHERE id = p_factura_id;
END;
$$;

-- 3d. eliminar_factura_atomica
CREATE OR REPLACE FUNCTION eliminar_factura_atomica(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rep RECORD;
BEGIN
  IF public.get_user_role() != 'administrador' THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar facturas';
  END IF;

  FOR v_rep IN
    SELECT repuesto_id, cantidad FROM factura_detalle_repuestos WHERE factura_id = p_factura_id
  LOOP
    INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, motivo)
    VALUES (v_rep.repuesto_id, 'entrada', v_rep.cantidad, 'Devolución por eliminación de factura');
  END LOOP;

  DELETE FROM pagos WHERE factura_id = p_factura_id;
  DELETE FROM factura_detalle_repuestos WHERE factura_id = p_factura_id;
  DELETE FROM factura_detalle_servicios WHERE factura_id = p_factura_id;
  DELETE FROM facturas WHERE id = p_factura_id;
END;
$$;

-- ==========================================================================
-- 4. FIX MAYOR: Borrar políticas base permisivas restantes
--    La migracion-rls-roles.sql ya las borró para varias tablas, pero
--    verificamos que no queden políticas *_all_authenticated sueltas.
-- ==========================================================================

-- Estas políticas ya fueron borradas por migracion-rls-roles.sql:
-- clientes_all_authenticated, motos_all_authenticated, categorias_all_authenticated,
-- proveedores_all_authenticated, repuestos_all_authenticated,
-- movimientos_all_authenticated, ordenes_all_authenticated,
-- orden_repuestos_all_authenticated, orden_mano_obra_all_authenticated
-- Verificamos por si acaso:

DROP POLICY IF EXISTS "clientes_all_authenticated" ON public.clientes;
DROP POLICY IF EXISTS "motos_all_authenticated" ON public.motos;
DROP POLICY IF EXISTS "categorias_all_authenticated" ON public.categorias_repuesto;
DROP POLICY IF EXISTS "proveedores_all_authenticated" ON public.proveedores;
DROP POLICY IF EXISTS "repuestos_all_authenticated" ON public.repuestos;
DROP POLICY IF EXISTS "movimientos_all_authenticated" ON public.movimientos_inventario;
DROP POLICY IF EXISTS "ordenes_all_authenticated" ON public.ordenes_servicio;
DROP POLICY IF EXISTS "orden_repuestos_all_authenticated" ON public.orden_detalle_repuestos;
DROP POLICY IF EXISTS "orden_mano_obra_all_authenticated" ON public.orden_detalle_mano_obra;

-- También eliminar la política write del schema inicial que fue reemplazada
DROP POLICY IF EXISTS "facturas_write" ON public.facturas;
DROP POLICY IF EXISTS "pagos_write" ON public.pagos;

-- ==========================================================================
-- 5. FIX MAYOR: Empleados — restringir SELECT a solo id y nombre para
--    colaboradores. Los datos de salario/solo admin.
-- ==========================================================================

-- Eliminar la política amplia de SELECT
DROP POLICY IF EXISTS "empleados_select_authenticated" ON public.empleados;

-- SELECT para admin (todos los campos)
CREATE POLICY "empleados_select_admin" ON public.empleados
  FOR SELECT TO authenticated
  USING (get_user_role() = 'administrador');

-- SELECT para colaborador (solo id y nombre — los campos necesarios para dropdowns)
-- Nota: PostgreSQL RLS no puede filtrar columnas, solo filas.
-- La política de fila permite acceso, pero la app debe controlar qué columnas muestra.
-- Para proteger a nivel DB, crear una vista para colaboradores:
CREATE OR REPLACE VIEW public.empleados_public AS
  SELECT id, nombre FROM public.empleados WHERE activo = true;

-- Política de SELECT para colaboradores en la tabla original
-- (solo puede ver filas, pero la app usa la vista para dropdowns)
CREATE POLICY "empleados_select_colaborador" ON public.empleados
  FOR SELECT TO authenticated
  USING (get_user_role() = 'colaborador');

-- ==========================================================================
-- 6. FIX MAYOR: Auditoría en facturas y pagos
--    Agregar triggers de auditoría a tablas financieras.
-- ==========================================================================

-- Función de auditoría para facturas
CREATE OR REPLACE FUNCTION public.fn_audit_facturas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.logs_auditoria (tabla_afectada, accion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'facturas',
    lower(TG_OP),
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger en facturas
DROP TRIGGER IF EXISTS audit_facturas ON public.facturas;
CREATE TRIGGER audit_facturas
  AFTER INSERT OR UPDATE OR DELETE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_facturas();

-- Función de auditoría para pagos
CREATE OR REPLACE FUNCTION public.fn_audit_pagos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.logs_auditoria (tabla_afectada, accion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'pagos',
    lower(TG_OP),
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger en pagos
DROP TRIGGER IF EXISTS audit_pagos ON public.pagos;
CREATE TRIGGER audit_pagos
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_pagos();

-- ==========================================================================
-- 7. FIX MENOR: Asegurar que logs_auditoria tenga INSERT policy
--    para que los triggers funcionen correctamente.
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'logs_insert_trigger' AND tablename = 'logs_auditoria'
  ) THEN
    CREATE POLICY "logs_insert_trigger" ON public.logs_auditoria
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- ==========================================================================
-- 8. FIX MENOR: Revocar privilegios excesivos del rol anon
-- ==========================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ==========================================================================
-- VERIFICACIÓN: Listar todas las políticas activas por tabla
-- (Ejecutar después de la migración para confirmar el estado)
-- ==========================================================================

-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
