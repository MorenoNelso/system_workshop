-- ============================================================
-- MIGRACIÓN: Índices FK faltantes
-- Ejecutar en: Supabase → SQL Editor → New query
-- Idempotente: usa IF NOT EXISTS para no fallar si ya existen.
-- ============================================================

-- tasas_cambio
create index if not exists idx_tasas_origen on public.tasas_cambio(moneda_origen_id);
create index if not exists idx_tasas_destino on public.tasas_cambio(moneda_destino_id);
create index if not exists idx_tasas_actualizado_por on public.tasas_cambio(actualizado_por);

-- configuracion_sistema
create index if not exists idx_config_moneda_base on public.configuracion_sistema(moneda_base_id);

-- empleados
create index if not exists idx_empleados_usuario on public.empleados(usuario_id);
create index if not exists idx_empleados_moneda_salario on public.empleados(moneda_salario_id);

-- repuestos (moneda_id — sku y categoria ya tienen índice)
create index if not exists idx_repuestos_moneda on public.repuestos(moneda_id);

-- ordenes_servicio (cliente_id y empleado_asignado — moto ya tiene índice)
create index if not exists idx_ordenes_cliente on public.ordenes_servicio(cliente_id);
create index if not exists idx_ordenes_empleado on public.ordenes_servicio(empleado_asignado_id);

-- movimientos_inventario (repuesto+fecha ya tiene índice compuesto)
create index if not exists idx_movimientos_usuario on public.movimientos_inventario(usuario_id);
create index if not exists idx_movimientos_orden on public.movimientos_inventario(orden_id);

-- orden_detalle_repuestos
create index if not exists idx_odr_orden on public.orden_detalle_repuestos(orden_id);
create index if not exists idx_odr_repuesto on public.orden_detalle_repuestos(repuesto_id);

-- orden_detalle_mano_obra
create index if not exists idx_odm_orden on public.orden_detalle_mano_obra(orden_id);
create index if not exists idx_odm_empleado on public.orden_detalle_mano_obra(empleado_id);

-- facturas (orden_id ya tiene UNIQUE, estado_pago y fecha ya tienen índice)
create index if not exists idx_facturas_cliente on public.facturas(cliente_id);

-- pagos
create index if not exists idx_pagos_factura on public.pagos(factura_id);
create index if not exists idx_pagos_moneda on public.pagos(moneda_id);

-- factura_detalle_repuestos
create index if not exists idx_fdr_factura on public.factura_detalle_repuestos(factura_id);
create index if not exists idx_fdr_repuesto on public.factura_detalle_repuestos(repuesto_id);

-- factura_detalle_servicios
create index if not exists idx_fds_factura on public.factura_detalle_servicios(factura_id);
create index if not exists idx_fds_empleado on public.factura_detalle_servicios(empleado_id);

-- gastos
create index if not exists idx_gastos_moneda on public.gastos(moneda_id);
create index if not exists idx_gastos_registrado_por on public.gastos(registrado_por);
create index if not exists idx_gastos_fecha on public.gastos(fecha);

-- deducciones_mecanico
create index if not exists idx_ded_empleado on public.deducciones_mecanico(empleado_id);
create index if not exists idx_ded_orden on public.deducciones_mecanico(orden_id);
create index if not exists idx_ded_moneda on public.deducciones_mecanico(moneda_id);
create index if not exists idx_ded_registrado_por on public.deducciones_mecanico(registrado_por);

-- logs_auditoria
create index if not exists idx_logs_usuario on public.logs_auditoria(usuario_id);
create index if not exists idx_logs_tabla on public.logs_auditoria(tabla_afectada);
create index if not exists idx_logs_fecha on public.logs_auditoria(fecha);
