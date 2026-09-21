-- ==========================================================================
-- LIMPIEZA DE DATOS FICTICIOS
-- Ejecutar en Supabase SQL Editor.
-- ELIMINA todos los datos de prueba. Mantiene: monedas, usuarios,
-- configuracion_sistema, tasas_cambio.
-- ==========================================================================

-- Orden de eliminación respetando foreign keys
DELETE FROM public.logs_auditoria;
DELETE FROM public.pagos;
DELETE FROM public.deducciones_mecanico;
DELETE FROM public.facturas;
DELETE FROM public.orden_detalle_repuestos;
DELETE FROM public.orden_detalle_mano_obra;
DELETE FROM public.movimientos_inventario;
DELETE FROM public.ordenes_servicio;
DELETE FROM public.repuestos;
DELETE FROM public.motos;
DELETE FROM public.empleados;
DELETE FROM public.clientes;
DELETE FROM public.categorias_repuesto;
DELETE FROM public.proveedores;

-- Resetear secuencia de facturas al máximo actual + 1
-- (si no hay facturas, empieza en 1)
SELECT setval(
  pg_get_serial_sequence('public.facturas', 'numero_consecutivo'),
  GREATEST((SELECT COALESCE(MAX(numero_consecutivo), 0) FROM public.facturas), 0)
);

-- Verificar estado
SELECT 'clientes' as tabla, COUNT(*) as registros FROM public.clientes
UNION ALL SELECT 'motos', COUNT(*) FROM public.motos
UNION ALL SELECT 'repuestos', COUNT(*) FROM public.repuestos
UNION ALL SELECT 'categorias_repuesto', COUNT(*) FROM public.categorias_repuesto
UNION ALL SELECT 'proveedores', COUNT(*) FROM public.proveedores
UNION ALL SELECT 'empleados', COUNT(*) FROM public.empleados
UNION ALL SELECT 'ordenes_servicio', COUNT(*) FROM public.ordenes_servicio
UNION ALL SELECT 'facturas', COUNT(*) FROM public.facturas
UNION ALL SELECT 'pagos', COUNT(*) FROM public.pagos
UNION ALL SELECT 'logs_auditoria', COUNT(*) FROM public.logs_auditoria
UNION ALL SELECT 'monedas', COUNT(*) FROM public.monedas
UNION ALL SELECT 'usuarios', COUNT(*) FROM public.usuarios
UNION ALL SELECT 'tasas_cambio', COUNT(*) FROM public.tasas_cambio
UNION ALL SELECT 'configuracion_sistema', COUNT(*) FROM public.configuracion_sistema;
