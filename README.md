# Pacho Motos — Sistema de Gestión

Sistema de gestión integral para taller de motos. 1 taller, 1–3 usuarios (admin/dueño + colaboradores/mecánicos).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, Turbopack), TypeScript |
| Base de datos + Auth | Supabase (PostgreSQL + RLS) |
| Validación | Zod v4 |
| PWA / Offline | Serwist |
| Monitoreo | Sentry |
| Testing | Vitest |
| Hosting | Netlify |

## Módulos

### Taller
- **Órdenes de servicio** — diagnóstico, repuestos, mano de obra, snapshots de precio
- **Facturación** — desde órdenes cerradas o venta directa, sin PDF
- **Inventario / Kardex** — movimientos de stock con trazabilidad
- **Dashboard** — alertas de stock, pipeline de órdenes, gráfico de ventas, ingresos por mecánico

### Catálogo
- **Clientes** — CRUD con motos asociadas
- **Motos** — marcas, modelos, placas, colores
- **Repuestos** — stock, precio costo/venta, calidad (original/genérica)
- **Categorías** y **Proveedores**

### Administración
- **Empleados / Mecánicos** — vinculación salarial, comisiones, ayudantes
- **Contabilidad** — retiros personales del dueño, deducciones a mecánicos, ganancia neta
- **Tasas de cambio** — manual (COP, USD, VES)
- **Usuarios** — roles admin/colaborador con permisos granulares
- **Auditoría** — logs automáticos de acciones críticas
- **Seguridad** — 2FA/TOTP, rate limiting, CSP

### Autenticación
- Login con email + contraseña
- 2FA/TOTP (obligatorio para admin)
- Recuperación por código OTP numérico

## Instalación

```bash
cp .env.example .env.local
# Pegar las keys de Supabase en .env.local
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar en producción |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (53 tests) |

## Base de datos

19 tablas con RLS activo. Documentación en `docs/`:

- `esquema-bd-taller-motos.md` — esquema completo
- `funciones-triggers-taller-motos.sql` — triggers de negocio
- `migracion-*.sql` — migraciones post-esquema

## Seguridad

- RLS en todas las tablas
- Roles: `administrador` / `colaborador`
- Rate limiting distribuido (Supabase RPC)
- CSP headers configurados
- `.env` nunca se commitea

## Paleta

- Azul vivido `#1234ab` (brand-600) — botones, links
- Azul oscuro `#2e3747` (brand-900) — fondos
- Neutros: `zinc-*`

## Deploy

Hosting en Netlify. Configuración en `netlify.toml`.

## Licencia

Privado — Pacho Motos.
