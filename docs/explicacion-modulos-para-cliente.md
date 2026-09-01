# Sistema de Gestión del Taller — Explicación por Módulos

## Panel de Control (Inicio)

Es la primera pantalla al entrar. Muestra en un vistazo:

- **Saludo y fecha** actual.
- **Repuestos por reponer**: alerta visual (ámbar) de los repuestos que están llegando al mínimo de stock, y en rojo los agotados. Si todo está saludable, muestra un mensaje verde.
- **Ventas semanales**: gráfico de líneas con las ventas de las últimas 12 semanas, en la moneda elegida. Solo lo ve el administrador.
- **Órdenes activas** (pipeline): cuántas motos están Recibidas, En Proceso y Terminadas, y cuántas se entregaron.
- **Ingresos por mecánico** (solo administrador): cuántos servicios hizo cada mecánico, cuánto generó en mano de obra y cuánto ganó en comisión.
- **Ventas por período** (solo administrador): consulta el total facturado entre dos fechas.
- **Mi producción** (solo colaborador/mecánico): cuántas órdenes tiene asignadas, servicios realizados, mano de obra y sus propias comisiones.

## Órdenes de Servicio

Es el corazón del taller. Registra cada moto que entra:

- Se asocia la **moto**, el **cliente** y el **mecánico** encargado.
- Se anota el **diagnóstico**, las **observaciones** y la **fecha estimada de entrega**.
- Tiene un **estado** que avanza: Recibido → En Proceso → Terminado → Entregado.
- Se van agregando los **repuestos** usados (se descuentan del inventario automáticamente) y la **mano de obra** (servicios) con su valor y moneda.
- Cada servicio calcula la **comisión del mecánico** automáticamente según su tipo de vinculación.
- Cuando la moto está lista, se cierra la orden y se puede **facturar**.

## Facturación

- Genera la **factura digital** a partir de una orden cerrada (no imprime nada: es un registro en pantalla, como funciona el taller hoy).
- Guarda un **congelado del precio**: el total no se recalcula nunca, ni aunque cambie la tasa de cambio o los precios después.
- **Venta rápida**: permite facturar directo un repuesto o servicio **sin crear una orden** (ej. alguien compra un repuesto en el mostrador). Ahí mismo puedes **dar de alta un cliente nuevo** sin salir del formulario.
- Cada factura muestra su detalle (repuestos, servicios, mano de obra, comisiones) y su **estado de pago**.
- El listado distingue si la factura viene de una **Orden** o es una **Venta directa**.

## Kardex / Stock (Inventario)

- Controla las **entradas, salidas y ajustes** de cada repuesto.
- Muestra el **movimiento histórico** de cada repuesto (quién lo usó, en qué orden, con qué proveedor entró).
- Marca los repuestos **agotados** y los que están por debajo de su **stock mínimo**.

## Clientes

Ficha completa de cada cliente. Se guarda:

- **Nombre** (obligatorio)
- **Teléfono** (obligatorio)
- **Correo electrónico** (opcional)
- **Cédula/documento** (opcional)
- **Dirección** (opcional)

## Motos

Registro de las motos de los clientes. Se guarda:

- El **cliente** dueño de la moto
- **Marca, modelo y año**
- **Placa, cilindraje y color**
- **Notas** (detalles del vehículo, accesorios, etc.)

## Repuestos

Catálogo de repuestos con:

- **Nombre**, **código SKU**, **categoría** y **proveedor**
- **Stock actual** y **stock mínimo** (para las alertas)
- **Precio de costo** y **precio de venta** en su moneda
- Cada repuesto puede activarse o desactivarse.

## Categorías

Agrupa los repuestos (ej. Frenos, Motores, Eléctrico, Carrocería) para ordenar el catálogo.

## Proveedores

Registro de a quién le compras repuestos:

- **Nombre**, **persona de contacto**, **teléfono**, **correo** y **dirección**.

## Empleados / Mecánicos

Ficha de cada trabajador:

- **Nombre**, **documento**, **teléfono**, y su **usuario del sistema** (para que entre con su propia cuenta).
- **Tipo de vinculación**: salario fijo, comisión o mixto (salario + comisión).
- Si gana **comisión**, el porcentaje y la moneda del salario.
- El sistema calcula y acumula **la comisión de cada mecánico** en cada servicio que realiza.

## Tasas de Cambio (solo administrador)

- Se registra **manualmente** el valor del día entre monedas (COP, USD, VES, etc.).
- Nunca se actualiza automático: el dueño decide cuándo y cuánto vale cada moneda.
- Se usa para **mostrar en pantalla** los montos convertidos, pero **no** recalcula documentos ya facturados (los precios quedan congelados en la moneda original).

## Seguridad y Acceso

- **Inicio de sesión** con correo y contraseña, y **clave de verificación** (2FA) obligatoria para el administrador.
- **Recuperación de acceso** por código de 6 dígitos que llega al correo.
- Hay **dos roles**:
  - **Administrador (dueño)**: ve todo, incluyendo reportes financieros, tasas de cambio y puede eliminar registros.
  - **Colaborador (mecánico/recepción)**: opera el día a día (órdenes, clientes, facturas, stock) pero **no ve los reportes financieros completos** ni modifica tasas.
- Todo lo que se elimina o cambia queda **registrado en un historial** (auditoría) para que sepas quién hizo qué y cuándo.