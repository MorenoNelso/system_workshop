-- ============================================================
-- ESQUEMA INICIAL COMPLETO — Sistema Taller de Motos
-- Pegar y ejecutar completo en: Supabase → SQL Editor → New query
-- ============================================================

create extension if not exists pgcrypto;

-- 1. monedas
create table public.monedas (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(3) unique not null,
  nombre varchar(50) not null,
  simbolo varchar(5) not null
);

-- 2. usuarios (vinculada 1 a 1 con auth.users)
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(150) unique not null,
  nombre varchar(100) not null,
  rol varchar(20) not null check (rol in ('administrador','colaborador')),
  activo boolean default true,
  creado_en timestamptz default now()
);

-- 3. empleados
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id),
  nombre varchar(100) not null,
  documento varchar(30),
  telefono varchar(20),
  tipo_vinculacion varchar(20) check (tipo_vinculacion in ('salario_fijo','comision','mixto')),
  salario_base numeric(14,2),
  moneda_salario_id uuid references public.monedas(id),
  porcentaje_comision numeric(5,2),
  activo boolean default true
);

-- 4. tasas_cambio
create table public.tasas_cambio (
  id uuid primary key default gen_random_uuid(),
  moneda_origen_id uuid references public.monedas(id) not null,
  moneda_destino_id uuid references public.monedas(id) not null,
  tasa numeric(18,6) not null,
  fuente varchar(20) default 'manual',
  actualizado_por uuid references public.usuarios(id),
  fecha timestamptz default now()
);

-- 5. configuracion_sistema
create table public.configuracion_sistema (
  id uuid primary key default gen_random_uuid(),
  nombre_taller varchar(100) not null,
  moneda_base_id uuid references public.monedas(id),
  logo_url text
);

-- 6. clientes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(100) not null,
  telefono varchar(20) not null,
  email varchar(150),
  documento varchar(30),
  direccion text,
  creado_en timestamptz default now()
);

-- 7. motos
create table public.motos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) not null,
  marca varchar(50) not null,
  modelo varchar(50) not null,
  anio smallint,
  placa varchar(15) unique,
  cilindraje varchar(10),
  color varchar(30),
  notas text
);

-- 8. categorias_repuesto
create table public.categorias_repuesto (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(60) unique not null
);

-- 9. proveedores
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(100) not null,
  contacto varchar(100),
  telefono varchar(20),
  email varchar(150),
  direccion text
);

-- 10. repuestos
create table public.repuestos (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(150) not null,
  sku varchar(50) unique,
  categoria_id uuid references public.categorias_repuesto(id),
  proveedor_id uuid references public.proveedores(id),
  stock_actual integer default 0 check (stock_actual >= 0),
  stock_minimo integer default 1,
  precio_costo numeric(14,2),
  precio_venta numeric(14,2) not null,
  moneda_id uuid references public.monedas(id) not null,
  activo boolean default true
);

-- 11. ordenes_servicio
create table public.ordenes_servicio (
  id uuid primary key default gen_random_uuid(),
  moto_id uuid references public.motos(id) not null,
  cliente_id uuid references public.clientes(id) not null,
  empleado_asignado_id uuid references public.empleados(id),
  estado varchar(20) default 'recibido' check (estado in ('recibido','en_proceso','terminado','entregado')),
  diagnostico text,
  observaciones text,
  fecha_ingreso timestamptz default now(),
  fecha_entrega_estimada date,
  fecha_entrega_real timestamptz
);

-- 12. movimientos_inventario (depende de repuestos y ordenes_servicio)
create table public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  repuesto_id uuid references public.repuestos(id) not null,
  tipo varchar(10) check (tipo in ('entrada','salida','ajuste')),
  cantidad integer not null,
  motivo text,
  orden_id uuid references public.ordenes_servicio(id),
  usuario_id uuid references public.usuarios(id),
  fecha timestamptz default now()
);

-- 13. orden_detalle_repuestos
create table public.orden_detalle_repuestos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references public.ordenes_servicio(id) not null,
  repuesto_id uuid references public.repuestos(id) not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario_aplicado numeric(14,2) not null,
  moneda_id uuid references public.monedas(id) not null
);

-- 14. orden_detalle_mano_obra
create table public.orden_detalle_mano_obra (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references public.ordenes_servicio(id) not null,
  empleado_id uuid references public.empleados(id) not null,
  descripcion varchar(200) not null,
  monto numeric(14,2) not null,
  moneda_id uuid references public.monedas(id) not null,
  porcentaje_comision_aplicado numeric(5,2),
  comision_calculada numeric(14,2)
);

-- 15. facturas
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references public.ordenes_servicio(id) unique,
  cliente_id uuid references public.clientes(id) not null,
  numero_consecutivo serial unique,
  subtotal numeric(14,2) not null,
  total numeric(14,2) not null,
  moneda_id uuid references public.monedas(id) not null,
  tasa_aplicada numeric(18,6),
  estado_pago varchar(15) default 'pendiente' check (estado_pago in ('pendiente','pagada','anulada')),
  fecha_emision timestamptz default now()
);

-- 16. pagos
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references public.facturas(id) not null,
  monto numeric(14,2) not null,
  moneda_id uuid references public.monedas(id) not null,
  metodo_pago varchar(20) check (metodo_pago in ('efectivo','transferencia','tarjeta')),
  fecha timestamptz default now()
);

-- 17. logs_auditoria
create table public.logs_auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id),
  tabla_afectada varchar(50) not null,
  registro_id uuid not null,
  accion varchar(10) check (accion in ('insert','update','delete')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  fecha timestamptz default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_repuestos_sku on public.repuestos(sku);
create index idx_repuestos_categoria on public.repuestos(categoria_id);
create index idx_ordenes_estado on public.ordenes_servicio(estado);
create index idx_ordenes_moto on public.ordenes_servicio(moto_id);
create index idx_motos_cliente on public.motos(cliente_id);
create index idx_motos_placa on public.motos(placa);
create index idx_facturas_estado on public.facturas(estado_pago);
create index idx_facturas_fecha on public.facturas(fecha_emision);
create index idx_movimientos_repuesto_fecha on public.movimientos_inventario(repuesto_id, fecha);

-- ============================================================
-- FUNCIÓN HELPER: obtiene el rol del usuario autenticado actual
-- ============================================================
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

-- ============================================================
-- RLS: activar en TODAS las tablas
-- ============================================================
alter table public.monedas enable row level security;
alter table public.usuarios enable row level security;
alter table public.empleados enable row level security;
alter table public.tasas_cambio enable row level security;
alter table public.configuracion_sistema enable row level security;
alter table public.clientes enable row level security;
alter table public.motos enable row level security;
alter table public.categorias_repuesto enable row level security;
alter table public.proveedores enable row level security;
alter table public.repuestos enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.ordenes_servicio enable row level security;
alter table public.orden_detalle_repuestos enable row level security;
alter table public.orden_detalle_mano_obra enable row level security;
alter table public.facturas enable row level security;
alter table public.pagos enable row level security;
alter table public.logs_auditoria enable row level security;

-- ============================================================
-- POLÍTICAS RLS BASE (el agente puede afinar granularidad en Fase 6)
-- ============================================================

-- monedas: lectura para todo autenticado, escritura solo admin
create policy "monedas_select" on public.monedas for select to authenticated using (true);
create policy "monedas_write" on public.monedas for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');

-- usuarios: solo admin gestiona; cada quien ve su propia fila
create policy "usuarios_admin_all" on public.usuarios for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');
create policy "usuarios_self_select" on public.usuarios for select to authenticated using (id = auth.uid());

-- empleados: solo admin
create policy "empleados_admin_only" on public.empleados for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');

-- tasas_cambio: lectura para todo autenticado, escritura solo admin
create policy "tasas_select" on public.tasas_cambio for select to authenticated using (true);
create policy "tasas_write" on public.tasas_cambio for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');

-- configuracion_sistema: solo admin
create policy "config_admin_only" on public.configuracion_sistema for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');

-- operativas: ambos roles (administrador y colaborador) leen y escriben
create policy "clientes_all_authenticated" on public.clientes for all to authenticated using (true) with check (true);
create policy "motos_all_authenticated" on public.motos for all to authenticated using (true) with check (true);
create policy "categorias_all_authenticated" on public.categorias_repuesto for all to authenticated using (true) with check (true);
create policy "proveedores_all_authenticated" on public.proveedores for all to authenticated using (true) with check (true);
create policy "repuestos_all_authenticated" on public.repuestos for all to authenticated using (true) with check (true);
create policy "movimientos_all_authenticated" on public.movimientos_inventario for all to authenticated using (true) with check (true);
create policy "ordenes_all_authenticated" on public.ordenes_servicio for all to authenticated using (true) with check (true);
create policy "orden_repuestos_all_authenticated" on public.orden_detalle_repuestos for all to authenticated using (true) with check (true);
create policy "orden_mano_obra_all_authenticated" on public.orden_detalle_mano_obra for all to authenticated using (true) with check (true);

-- facturas y pagos: todos leen, solo admin escribe/modifica/anula
create policy "facturas_select" on public.facturas for select to authenticated using (true);
create policy "facturas_write" on public.facturas for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');
create policy "pagos_select" on public.pagos for select to authenticated using (true);
create policy "pagos_write" on public.pagos for all to authenticated using (get_user_role() = 'administrador') with check (get_user_role() = 'administrador');

-- logs_auditoria: solo admin lee; se inserta desde funciones/triggers, no directo desde el cliente
create policy "logs_admin_select" on public.logs_auditoria for select to authenticated using (get_user_role() = 'administrador');

-- ============================================================
-- DATOS INICIALES
-- ============================================================
insert into public.monedas (codigo, nombre, simbolo) values
  ('COP', 'Peso Colombiano', '$'),
  ('USD', 'Dólar Estadounidense', '$'),
  ('VES', 'Bolívar Venezolano', 'Bs');
