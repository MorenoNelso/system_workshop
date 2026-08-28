<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Contexto del proyecto — Sistema de gestión Taller de Motos

Sistema de gestión para un taller de motos pequeño: **1 taller, 1–3 usuarios** (1 admin/dueño + 1–2 colaboradores/mecánicos). Sin facturación electrónica ni impresión física — la factura es un registro digital en pantalla. Maneja múltiples monedas (COP, USD, VES) con tasas de cambio **actualizadas manualmente**, nunca automáticas.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js (App Router), TypeScript |
| Base de datos + Auth | Supabase (PostgreSQL + RLS) |
| Auth helpers | `@supabase/ssr` |
| Validación | Zod |
| Hosting | Netlify (Starter gratuito) |
| Monitoreo | Sentry (plan gratuito) |

## Roles del sistema

- `admin` — acceso total.
- `mecanico` / `recepcion` — acceso operativo restringido: no pueden ver reportes financieros completos, no pueden modificar tasas de cambio, no pueden eliminar registros históricos.

> La verificación de rol **siempre** se hace en el servidor (middleware de Next.js + RLS de Supabase). Nunca confiar en checks del frontend.

---

## Estado actual — qué ya está hecho ✅

> **No recrear ni modificar sin pedido explícito.**

- **Next.js** scaffoldeado con App Router + TypeScript, ESLint configurado, `npm run dev` corre sin errores.
- **Repositorio Git** privado en GitHub (`MorenoNelso/system_workshop`), `.gitignore` correcto, `.env` fuera de git.
- **Supabase** — Base de datos completamente lista:
  - **17 tablas** creadas con RLS activo y políticas base en todas ellas.
  - Función `get_user_role()` disponible.
  - **3 triggers/funciones de negocio**: auditoría automática, actualización de stock, cálculo de comisión.
  - SQL documentado en `docs/schema-inicial-taller-motos.sql` y `docs/funciones-triggers-taller-motos.sql`.
  - **Pendiente**: pegar las API keys de Supabase en `.env.local` (ver sección Variables de entorno).
- **Estructura de carpetas** base creada:
  - `app/(auth)/login/` y `app/(auth)/recuperar/`
  - `app/(dashboard)/` con layout y página de clientes base
  - `lib/supabase/` — `client.ts`, `server.ts`, `middleware.ts`
  - `lib/actions/` — `clientes.ts`, `facturas.ts`, `inventario.ts`, `ordenes.ts` (estructura base)
  - `types/database.types.ts`
  - `middleware.ts` en raíz
- **Fases 2–5 implementadas**: CRUD completo (clientes, motos, categorías, proveedores, repuestos, empleados), órdenes de servicio con snapshots de precio/comisión y descuento de stock, facturación digital desde órdenes cerradas (sin PDF), pagos completos (sin abonos) y tasas de cambio manuales (`/tasas`, solo admin). Conversión en pantalla con tasa vigente sin recalcular montos congelados. Dashboard con alertas de stock bajo, pipeline de órdenes activas, gráfico de ventas semanales (puro CSS, sin librería), ingresos por mecánico y reporte de ventas por rango — con permisos por rol (`colaborador` ve solo su propia producción, no reportes financieros).

---

## Fases de desarrollo

| Fase | Descripción | Estado |
|---|---|---|
| 0 | Setup Next.js, Supabase, estructura de carpetas | ✅ Completa |
| 1 | Auth + roles (login, OTP, 2FA, middleware) | ✅ Completa |
| 2 | CRUD: Clientes, Motos, Repuestos, Proveedores | ✅ Completa |
| 3 | Órdenes de servicio, Mano de obra, Empleados | ✅ Completa |
| 4 | Facturación, Pagos, Multi-moneda | ✅ Completa |
| 5 | Dashboard y Reportes | ✅ Completa |
| 6 | Hardening de seguridad (auditoría completa) | ⬜ Pendiente |
| 7 | Testing | ⬜ Pendiente |
| 8 | Despliegue a producción (Netlify + Supabase Pro) | ⬜ Pendiente |

**Regla de trabajo:** fases pequeñas. No implementar nada que no esté en la fase actual. Si algo no está claro, preguntar antes de asumir.

---

## Base de datos — 17 tablas (fuente de verdad: `docs/esquema-bd-taller-motos.md`)

> No inventar columnas ni tablas nuevas sin pedido explícito. Usar siempre el esquema del archivo de docs como referencia.

Tablas: `monedas`, `tasas_cambio`, `configuracion_sistema`, `usuarios`, `empleados`, `clientes`, `motos`, `categorias_repuesto`, `proveedores`, `repuestos`, `movimientos_inventario`, `ordenes_servicio`, `orden_detalle_repuestos`, `orden_detalle_mano_obra`, `facturas`, `pagos`, `logs_auditoria`.

**Regla de oro de monedas:** toda tabla con montos (`facturas`, `orden_detalle_repuestos`, `orden_detalle_mano_obra`, `pagos`) guarda su `moneda_id` y el snapshot de `tasa_aplicada`. **Nunca recalcular documentos históricos** con la tasa actual.

---

## Variables de entorno

Archivo `.env.local` en la raíz (nunca commitear — ya está en `.gitignore`). Ver `.env.example` como plantilla.

```env
# Supabase — pegar desde el dashboard de tu proyecto en supabase.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Clave pública — segura en el cliente (protegida por RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # NUNCA exponer al cliente, solo en server actions/edge functions

# Sentry (fase 6+)
SENTRY_DSN=
```

> **La `service_role` key tiene privilegios totales** — solo usarla en código server-side. Si llega al cliente, hay que rotarla inmediatamente en el dashboard de Supabase.

---

## Checklist de seguridad no negociable

### Backend
- Todas las claves en `.env` — nunca hardcodeadas.
- `anon key` solo en el cliente; `service_role` solo server-side.
- CORS: aceptar peticiones solo desde el dominio de la app.
- HTTPS obligatorio en producción (Netlify y Supabase lo dan por defecto).
- Rate limiting en endpoints sensibles: login, creación de facturas, escritura masiva.
- **Nunca concatenar strings para construir queries SQL** — usar siempre el cliente de Supabase o Prisma (parametrizan automáticamente).
- Si se commitea una clave por error: reescribir historial con `git filter-repo` + rotar clave inmediatamente.

### Auth y sesión
- Todas las rutas (salvo `/login`) verifican sesión activa en el servidor (middleware de Next.js).
- Verificación de rol **siempre en el backend**, nunca desde el cliente.
- Cookies `httpOnly` + `secure` — gestionadas por `@supabase/ssr` por defecto. **Nunca guardar token en `localStorage`**.
- Contraseñas gestionadas por Supabase Auth (bcrypt automático). Sin hasheo manual.
- 2FA/TOTP obligatorio al menos para `admin`.
- Mínimo 10 caracteres de contraseña.
- Recuperación de acceso vía **código OTP numérico de 6 dígitos** con expiración corta (10 min). Nunca un link directo que auto-loguee. Mensaje genérico que no confirme si el email existe.
- **SMTP externo obligatorio** (Resend o Brevo — plan gratuito) — el SMTP por defecto de Supabase está limitado a 2 correos/hora y no es apto para producción.

### Base de datos
- RLS activo en **todas** las tablas desde el día 1.
- Validación de datos en backend con Zod en cada endpoint.
- Sanitizar inputs de texto libre antes de guardar.
- Los endpoints solo aceptan explícitamente los campos permitidos — nunca spread directo del body al modelo.

### Frontend
- CSP configurada en `next.config.js`.
- **Nunca mostrar errores técnicos ni stack traces al usuario** — capturar con Sentry, mostrar mensaje amigable en español.

---

## UI/UX — principios del sistema

- **Skeleton loaders** (no spinners genéricos) mientras carga cualquier vista o lista.
- **UI optimista**: guardar formulario → cerrar y mostrar inmediatamente → revertir si falla la petición.
- **Botones de acción** (`Guardar`, `Cancelar`, `Eliminar`) siempre en la misma posición en todos los formularios (abajo a la derecha).
- **Micro-interacciones sutiles** en botones (cambio de opacidad o pequeño scale al clic).
- **Errores en español**, amigables, orientados a qué hacer (ej. "No se pudo guardar el cliente, verifica el teléfono e intenta de nuevo").

## Paleta de colores

Base: **azul, gris, negro y blanco**. Rosa como **acento discreto** únicamente (borde superior de tarjetas, indicador "nuevo", detalle de logo) — nunca en botones primarios ni textos de error/éxito.

Logo: campo `configuracion_sistema.logo_url` apunta a Supabase Storage. Si el archivo no existe aún, usar placeholder con iniciales del taller en la paleta de colores.
