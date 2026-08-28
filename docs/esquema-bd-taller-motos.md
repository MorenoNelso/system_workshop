# Esquema de base de datos — Sistema de gestión para taller de motos

Motor sugerido: **PostgreSQL** (vía Supabase). Todas las tablas usan `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` salvo que se indique lo contrario, y `creado_en TIMESTAMPTZ DEFAULT now()` como estándar de auditoría básica.

---

## Diseño de moneda (decisión clave)

- No hay conversión automática vía API en el MVP. Los usuarios registran manualmente la tasa de cambio en `tasas_cambio`.
- **Regla de oro**: toda tabla que registre un monto de dinero en un momento específico (`facturas`, `orden_detalle_repuestos`, `orden_detalle_mano_obra`, `pagos`) **guarda su propia `moneda_id` y, cuando aplica, la tasa usada al momento de la transacción** (`tasa_aplicada`). Nunca se recalcula un documento histórico con la tasa actual — eso rompe la trazabilidad contable.
- `repuestos.precio_venta` sí puede vivir en una sola moneda "de referencia" (la que el taller usa para fijar precios) y convertirse *en pantalla* a otras monedas usando la tasa vigente — eso es solo para mostrar, no para registrar transacciones.

---

## 1. `monedas`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| codigo | varchar(3) | UNIQUE, NOT NULL (ej. COP, USD, VES) |
| nombre | varchar(50) | NOT NULL |
| simbolo | varchar(5) | NOT NULL |

## 2. `tasas_cambio`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| moneda_origen_id | uuid | FK → monedas.id |
| moneda_destino_id | uuid | FK → monedas.id |
| tasa | numeric(18,6) | NOT NULL |
| fuente | varchar(20) | 'manual' \| 'api' — default 'manual' |
| actualizado_por | uuid | FK → usuarios.id |
| fecha | timestamptz | NOT NULL, default now() |

## 3. `configuracion_sistema`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| nombre_taller | varchar(100) | NOT NULL |
| moneda_base_id | uuid | FK → monedas.id |
| logo_url | text | nullable |

## 4. `usuarios`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK — mismo id que `auth.users` de Supabase |
| email | varchar(150) | UNIQUE, NOT NULL |
| nombre | varchar(100) | NOT NULL |
| rol | varchar(20) | 'admin' \| 'mecanico' \| 'recepcion' |
| activo | boolean | default true |
| creado_en | timestamptz | default now() |

## 5. `empleados`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → usuarios.id, NULLABLE (un empleado no siempre necesita login) |
| nombre | varchar(100) | NOT NULL |
| documento | varchar(30) | nullable |
| telefono | varchar(20) | nullable |
| tipo_vinculacion | varchar(20) | 'salario_fijo' \| 'comision' \| 'mixto' |
| salario_base | numeric(14,2) | nullable |
| moneda_salario_id | uuid | FK → monedas.id, nullable |
| porcentaje_comision | numeric(5,2) | nullable (ej. 30.00 = 30%) |
| activo | boolean | default true |

## 6. `clientes`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(100) | NOT NULL |
| telefono | varchar(20) | NOT NULL |
| email | varchar(150) | nullable |
| documento | varchar(30) | nullable |
| direccion | text | nullable |
| creado_en | timestamptz | default now() |

## 7. `motos`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| cliente_id | uuid | FK → clientes.id, NOT NULL |
| marca | varchar(50) | NOT NULL |
| modelo | varchar(50) | NOT NULL |
| anio | smallint | nullable |
| placa | varchar(15) | UNIQUE, nullable |
| cilindraje | varchar(10) | nullable |
| color | varchar(30) | nullable |
| notas | text | nullable |

## 8. `categorias_repuesto`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(60) | NOT NULL, UNIQUE |

## 9. `proveedores`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(100) | NOT NULL |
| contacto | varchar(100) | nullable |
| telefono | varchar(20) | nullable |
| email | varchar(150) | nullable |
| direccion | text | nullable |

## 10. `repuestos`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| nombre | varchar(150) | NOT NULL |
| sku | varchar(50) | UNIQUE, nullable |
| categoria_id | uuid | FK → categorias_repuesto.id |
| proveedor_id | uuid | FK → proveedores.id, nullable |
| stock_actual | integer | default 0, CHECK >= 0 |
| stock_minimo | integer | default 1 |
| precio_costo | numeric(14,2) | nullable |
| precio_venta | numeric(14,2) | NOT NULL |
| moneda_id | uuid | FK → monedas.id, NOT NULL |
| activo | boolean | default true |

## 11. `movimientos_inventario`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| repuesto_id | uuid | FK → repuestos.id |
| tipo | varchar(10) | 'entrada' \| 'salida' \| 'ajuste' |
| cantidad | integer | NOT NULL |
| motivo | text | nullable |
| orden_id | uuid | FK → ordenes_servicio.id, nullable |
| usuario_id | uuid | FK → usuarios.id |
| fecha | timestamptz | default now() |

## 12. `ordenes_servicio`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| moto_id | uuid | FK → motos.id, NOT NULL |
| cliente_id | uuid | FK → clientes.id, NOT NULL |
| empleado_asignado_id | uuid | FK → empleados.id, nullable |
| estado | varchar(20) | 'recibido' \| 'en_proceso' \| 'terminado' \| 'entregado' |
| diagnostico | text | nullable |
| observaciones | text | nullable |
| fecha_ingreso | timestamptz | default now() |
| fecha_entrega_estimada | date | nullable |
| fecha_entrega_real | timestamptz | nullable |

## 13. `orden_detalle_repuestos`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| orden_id | uuid | FK → ordenes_servicio.id, NOT NULL |
| repuesto_id | uuid | FK → repuestos.id, NOT NULL |
| cantidad | integer | NOT NULL, CHECK > 0 |
| precio_unitario_aplicado | numeric(14,2) | NOT NULL (snapshot del precio al momento de la orden) |
| moneda_id | uuid | FK → monedas.id, NOT NULL |

## 14. `orden_detalle_mano_obra`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| orden_id | uuid | FK → ordenes_servicio.id, NOT NULL |
| empleado_id | uuid | FK → empleados.id, NOT NULL |
| descripcion | varchar(200) | NOT NULL |
| monto | numeric(14,2) | NOT NULL |
| moneda_id | uuid | FK → monedas.id, NOT NULL |
| porcentaje_comision_aplicado | numeric(5,2) | nullable (snapshot) |
| comision_calculada | numeric(14,2) | nullable (calculado: monto × %) |

## 15. `facturas`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| orden_id | uuid | FK → ordenes_servicio.id, UNIQUE |
| cliente_id | uuid | FK → clientes.id, NOT NULL |
| numero_consecutivo | integer | UNIQUE, NOT NULL (autoincremental interno, no fiscal) |
| subtotal | numeric(14,2) | NOT NULL |
| total | numeric(14,2) | NOT NULL |
| moneda_id | uuid | FK → monedas.id, NOT NULL |
| tasa_aplicada | numeric(18,6) | nullable (solo si se mostró en otra moneda) |
| estado_pago | varchar(15) | 'pendiente' \| 'pagada' \| 'anulada' |
| fecha_emision | timestamptz | default now() |

## 16. `pagos`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| factura_id | uuid | FK → facturas.id, NOT NULL |
| monto | numeric(14,2) | NOT NULL |
| moneda_id | uuid | FK → monedas.id, NOT NULL |
| metodo_pago | varchar(20) | 'efectivo' \| 'transferencia' \| 'tarjeta' |
| fecha | timestamptz | default now() |

## 17. `logs_auditoria`
| Columna | Tipo | Restricciones |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → usuarios.id |
| tabla_afectada | varchar(50) | NOT NULL |
| registro_id | uuid | NOT NULL |
| accion | varchar(10) | 'insert' \| 'update' \| 'delete' |
| datos_anteriores | jsonb | nullable |
| datos_nuevos | jsonb | nullable |
| fecha | timestamptz | default now() |

---

## Índices recomendados
- `repuestos(sku)`, `repuestos(categoria_id)`
- `ordenes_servicio(estado)`, `ordenes_servicio(moto_id)`
- `motos(cliente_id)`, `motos(placa)`
- `facturas(estado_pago)`, `facturas(numero_consecutivo)`
- `movimientos_inventario(repuesto_id, fecha)`

## Row Level Security (Supabase) — resumen de política
- Todas las tablas: RLS **ON** desde el día 1.
- `usuarios`, `empleados`, `logs_auditoria`: solo lectura/escritura para rol `admin`.
- `ordenes_servicio`, `orden_detalle_*`: lectura para `mecanico` y `recepcion`, escritura según el paso del flujo (un mecánico no debería poder cerrar una factura, por ejemplo).
- `facturas`, `pagos`: escritura restringida a `admin` y `recepcion`.
- `tasas_cambio`, `configuracion_sistema`: solo `admin`.

## Módulos pospuestos (no se diseñan tablas aún, pero el modelo no los bloquea)
- `citas` — relación futura simple con `clientes` y `motos`, sin dependencias cruzadas con `ordenes_servicio`.
