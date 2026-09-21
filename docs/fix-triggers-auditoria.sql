-- ==========================================================================
-- FIX: Triggers de auditoría usan columna incorrecta
-- La columna se llama `tabla_afectada`, no `tabla`.
-- ==========================================================================

-- Fix fn_audit_facturas
CREATE OR REPLACE FUNCTION public.fn_audit_facturas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.logs_auditoria (tabla_afectada, accion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'facturas',
    TG_OP,
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

-- Fix fn_audit_pagos
CREATE OR REPLACE FUNCTION public.fn_audit_pagos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.logs_auditoria (tabla_afectada, accion, registro_id, datos_nuevos, usuario_id)
  VALUES (
    'pagos',
    TG_OP,
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

-- ==========================================================================
-- FIX: Vista empleados_public con SECURITY DEFINER → eliminar
-- El RLS ya protege la tabla. La vista no necesita SECURITY DEFINER.
-- ==========================================================================

DROP VIEW IF EXISTS public.empleados_public;

-- Recrear sin SECURITY DEFINER (usa SECURITY INVOKER por defecto)
CREATE VIEW public.empleados_public AS
  SELECT id, nombre FROM public.empleados WHERE activo = true;
