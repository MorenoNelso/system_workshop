-- ============================================================
-- FUNCIONES Y TRIGGERS — Sistema Taller de Motos
-- Ejecutar en Supabase → SQL Editor, DESPUÉS de haber corrido
-- schema-inicial-taller-motos.sql
-- ============================================================

-- ============================================================
-- 1. AUDITORÍA AUTOMÁTICA
-- ============================================================
-- Registra automáticamente cualquier insert/update/delete en las
-- tablas sensibles, sin que la app tenga que programarlo a mano.

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.logs_auditoria (usuario_id, tabla_afectada, registro_id, accion, datos_anteriores, datos_nuevos)
  values (
    auth.uid(),
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    lower(TG_OP),
    case when TG_OP in ('DELETE','UPDATE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

-- Se conecta a las tablas donde de verdad importa el rastro de auditoría:
create trigger trg_audit_facturas
  after insert or update or delete on public.facturas
  for each row execute function public.fn_audit_log();

create trigger trg_audit_pagos
  after insert or update or delete on public.pagos
  for each row execute function public.fn_audit_log();

create trigger trg_audit_repuestos
  after insert or update or delete on public.repuestos
  for each row execute function public.fn_audit_log();

create trigger trg_audit_tasas_cambio
  after insert or update or delete on public.tasas_cambio
  for each row execute function public.fn_audit_log();

create trigger trg_audit_empleados
  after insert or update or delete on public.empleados
  for each row execute function public.fn_audit_log();

-- ============================================================
-- 2. ACTUALIZACIÓN AUTOMÁTICA DE STOCK
-- ============================================================
-- Al insertar un movimiento de inventario, actualiza el stock_actual
-- del repuesto correspondiente automáticamente.
-- 'entrada' suma, 'salida' resta, 'ajuste' aplica la cantidad como
-- delta directo (puede ser positiva o negativa, según la corrección).

create or replace function public.fn_actualizar_stock()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.tipo = 'entrada' then
    update public.repuestos set stock_actual = stock_actual + NEW.cantidad where id = NEW.repuesto_id;
  elsif NEW.tipo = 'salida' then
    update public.repuestos set stock_actual = stock_actual - NEW.cantidad where id = NEW.repuesto_id;
  elsif NEW.tipo = 'ajuste' then
    update public.repuestos set stock_actual = stock_actual + NEW.cantidad where id = NEW.repuesto_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_actualizar_stock
  after insert on public.movimientos_inventario
  for each row execute function public.fn_actualizar_stock();

-- ============================================================
-- 3. CÁLCULO AUTOMÁTICO DE COMISIÓN EN MANO DE OBRA
-- ============================================================
-- Si no se especifica el % de comisión al insertar, lo toma del
-- empleado (snapshot). Siempre calcula comision_calculada = monto * %.

create or replace function public.fn_mano_obra_before_insert()
returns trigger
language plpgsql
as $$
begin
  if NEW.porcentaje_comision_aplicado is null then
    select porcentaje_comision into NEW.porcentaje_comision_aplicado
    from public.empleados where id = NEW.empleado_id;
  end if;

  if NEW.porcentaje_comision_aplicado is not null then
    NEW.comision_calculada := round(NEW.monto * NEW.porcentaje_comision_aplicado / 100, 2);
  end if;

  return NEW;
end;
$$;

create trigger trg_mano_obra_before_insert
  before insert on public.orden_detalle_mano_obra
  for each row execute function public.fn_mano_obra_before_insert();
