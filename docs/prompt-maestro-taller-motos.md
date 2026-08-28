# Prompt maestro — Sistema de gestión para taller de motos

> Cómo usar este documento: no lo pegues completo de una sola vez. Cada "FASE" es un prompt independiente que le das a la IA (Claude Code idealmente) en una sesión separada, después de haber cerrado y revisado la fase anterior. El bloque "Contexto del proyecto" y el "Checklist de seguridad" van SIEMPRE presentes — lo ideal es copiarlos dentro de un archivo `CLAUDE.md` en la raíz del repo para que se carguen solos en cada sesión, en vez de pegarlos a mano cada vez.

---

## Contexto del proyecto (va en `AGENTS.md`)

Estoy construyendo un sistema de gestión para un taller de motos pequeño (1 taller, 1-3 usuarios: 1 administrador/dueño y 1-2 colaboradores/mecánicos). No hay facturación electrónica ni impresión física — la factura es un registro digital que se muestra en pantalla. El sistema maneja múltiples monedas (COP, USD, VES) con tasas de cambio actualizadas manualmente, nunca automáticas.

**Stack:**
- Frontend + Backend: Next.js (App Router), TypeScript
- Base de datos + Auth: Supabase (PostgreSQL + Row Level Security)
- ORM: Prisma (o cliente de Supabase directo, a decidir en Fase 1)
- Hosting: Netlify (frontend/API, plan Starter gratuito) + Supabase (BD/Auth)
- Monitoreo de errores: Sentry (plan gratuito)

**Roles del sistema:**
- `administrador`: acceso total.
- `colaborador`: mecánico o recepción — acceso operativo restringido (no puede ver reportes financieros completos, no puede modificar tasas de cambio, no puede eliminar registros históricos).

**Esquema de base de datos:** ya está definido (17 tablas — clientes, motos, repuestos, categorias_repuesto, proveedores, movimientos_inventario, empleados, usuarios, ordenes_servicio, orden_detalle_repuestos, orden_detalle_mano_obra, facturas, pagos, monedas, tasas_cambio, configuracion_sistema, logs_auditoria). Yo te paso el archivo `esquema-bd-taller-motos.md` con el detalle completo de columnas — úsalo como fuente de verdad, no inventes columnas ni tablas nuevas sin preguntarme primero.

**Regla de trabajo:** trabajamos por fases pequeñas. No implementes nada que no esté explícitamente pedido en la fase actual. Si algo no está claro, pregunta antes de asumir. Al final de cada fase, dame un resumen corto de qué cambiaste y qué falta probar.

---

## Checklist de seguridad no negociable (aplica en TODAS las fases)

### Backend e infraestructura
1. **Variables de entorno**: todas las claves, tokens y secretos van en `.env`, nunca hardcodeados en el código. `.env` debe estar en `.gitignore` desde el primer commit.
2. **Claves de Supabase**: usa la `anon/public key` únicamente en el frontend (protegida igualmente por RLS). La `service_role key` (privilegios totales) nunca se expone al cliente — solo se usa en funciones server-side/edge functions que corren en el servidor.
3. **CORS**: configura el backend para aceptar peticiones solo desde el dominio de la app (producción y localhost en desarrollo), rechazando cualquier otro origen.
4. **HTTPS obligatorio** en producción — Netlify y Supabase lo dan por defecto, no lo desactives.
5. **Rate limiting** en endpoints sensibles: login, creación de facturas, endpoints de escritura masiva. Si hay abuso, debe bloquear temporalmente esa IP/usuario, no colapsar el servidor.
6. **Parametrización de consultas SQL**: nunca concatenar strings para construir queries. Usa siempre el ORM (Prisma) o el cliente de Supabase, que parametrizan automáticamente — cero SQL crudo con interpolación de variables del usuario.
7. **Purga de secretos en Git**: si en algún momento se commitea una clave por error, no basta con borrarla en el siguiente commit — hay que reescribir el historial (`git filter-repo` o BFG Repo-Cleaner) y rotar esa clave inmediatamente en Supabase/el proveedor correspondiente.

### Autenticación y sesión
8. **Autenticación forzada**: todas las rutas y endpoints, salvo login, deben verificar sesión activa en el servidor (middleware de Next.js), nunca confiar solo en ocultar un botón en el frontend.
9. **Verificación de rol/admin del lado del servidor**: cualquier chequeo de "¿es admin?" se hace en el backend con el rol guardado en la BD, nunca leyendo un valor que llega desde el cliente.
10. **Tokens de sesión**: usa cookies `httpOnly` y `secure` (esto lo maneja Supabase Auth Helpers para Next.js por defecto) — nunca guardes el token de sesión en `localStorage`, porque eso lo expone a robo vía XSS.
11. **Hasheo de contraseñas**: gestionado automáticamente por Supabase Auth (bcrypt) — no implementar hasheo manual.
12. **2FA/OTP**: obligatorio, al menos para el rol `administrador`. Usa el soporte nativo de Supabase Auth para TOTP o magic link como segundo factor.
13. **Reglas de contraseña**: mínimo 10 caracteres, activa la protección de Supabase contra contraseñas filtradas (leaked password protection) si está disponible en el plan.
14. **Rate limiting específico en login**: máximo de intentos fallidos antes de bloqueo temporal (ej. 5 intentos → bloqueo de 15 minutos), además del rate limiting general de la API.
15. **Recuperación/primer acceso vía código OTP**: el correo enviado contiene un código numérico de un solo uso con expiración corta (ej. 10 minutos), nunca la contraseña actual ni un link directo que auto-loguee sin verificación adicional. El sistema nunca debe confirmar si un email existe o no en la base de datos (mensaje genérico "si el correo está registrado, te enviamos un código" — evita que alguien use el formulario para descubrir qué correos están registrados). Rate limiting también aplica aquí, para que no se pueda saturar de solicitudes.
16. **SMTP externo obligatorio para correos de autenticación**: el servicio de email por defecto de Supabase está limitado a 2 correos por hora (aplica igual en Free y Pro) y no es apto para producción, ni siquiera con pocos usuarios. Configura un proveedor SMTP externo (Resend, Brevo o similar) con plan gratuito desde el inicio del proyecto.

### Datos y base de datos
17. **Row Level Security (RLS) activo en TODAS las tablas** desde el primer día — ninguna tabla se crea sin su política de RLS definida en el mismo PR/commit.
18. **Restricción de acceso a registros**: un `colaborador` solo debe ver/editar lo que su rol permite (ver el detalle de permisos por tabla en el esquema de BD) — esto se aplica vía políticas de RLS, no filtros en el frontend.
19. **Validación en backend**: cada dato que llega a un endpoint se valida en el servidor con un schema (Zod recomendado), sin importar que ya se haya validado en el frontend — el frontend nunca es una fuente confiable.
20. **Sanitización de inputs**: limpia cualquier input de texto libre (notas, descripciones) antes de guardarlo, para prevenir inyección de HTML/scripts si ese texto se muestra después en el dashboard.
21. **Prevención de mass assignment / manipulación de campos**: los endpoints solo aceptan explícitamente los campos que deben poder modificarse — nunca hagas un "spread" directo del body del request hacia el modelo de base de datos.
22. **Encriptación de datos sensibles**: cualquier dato personal sensible (documento de identidad de clientes, por ejemplo) se almacena considerando cifrado a nivel de columna si el volumen lo justifica; como mínimo, nunca se expone en logs ni en respuestas de error.

### Frontend
23. **Content Security Policy (CSP)**: configúrala en `next.config.js` para bloquear scripts de orígenes no autorizados (solo permitir el propio dominio y los CDNs estrictamente necesarios).
24. **Nunca mostrar errores técnicos ni stack traces al usuario final**. Cualquier error de consola/servidor se captura, se registra en Sentry, y al usuario se le muestra un mensaje amigable genérico ("Algo salió mal, intenta de nuevo" en vez del error crudo).
25. **Anti-bot**: como el sistema es privado (login requerido, sin formularios públicos expuestos), un captcha no es prioritario. Basta con el rate limiting de login. Si en el futuro se agrega algún formulario público (ej. agendar cita desde la web), ahí sí evaluamos algo ligero como Cloudflare Turnstile.

---

## Principios de UI/UX (aplican en toda la interfaz, no solo en un módulo)

- **Estados de carga**: nunca uses un spinner circular genérico. Usa **skeleton loaders** (placeholders grises con la forma del contenido que va a aparecer) mientras carga cualquier vista o lista.
- **UI optimista**: al guardar un formulario (ej. nuevo cliente), cierra el formulario y muestra el dato como guardado inmediatamente, mientras la petición real se completa en segundo plano. Si la petición falla, revierte visualmente y notifica el error — no bloquees al usuario esperando la respuesta del servidor.
- **Botones de acción en posición fija**: "Guardar", "Eliminar", "Cancelar" siempre en la misma posición en todos los formularios y modales del sistema (ej. siempre abajo a la derecha) — nunca varían de un módulo a otro.
- **Micro-interacciones sutiles**: los botones deben tener una transición/feedback visual al hacer clic (no exagerado — un cambio de opacidad o un pequeño scale es suficiente), para que el usuario sienta que la acción se registró.
- **Errores siempre amigables**: nunca un mensaje técnico o en inglés de una librería. Mensajes cortos, en español, orientados a qué hacer ("No se pudo guardar el cliente, verifica el teléfono e intenta de nuevo").

## Diseño visual — paleta de colores

Colores base: **azul, gris, negro y blanco** como paleta principal (fondo, texto, botones primarios, estados). El rosa se usa como **acento discreto, no como color estructural** — ideas concretas para incluirlo sin romper la seriedad del sistema: borde superior de 2-3px en tarjetas destacadas, indicador de "nuevo" o "favorito", detalle en el logo/avatar del sistema, o un acento en hover de algún elemento secundario. Nunca en botones primarios, textos de error/éxito (esos siguen la semántica estándar: rojo/verde) ni en grandes superficies.

*(Nota: para ejecutar esto, la IA debe consultar su skill de frontend-design/diseño de UI antes de generar componentes, para mantener coherencia de espaciado, tipografía y jerarquía visual en todo el sistema — no solo aplicar colores sueltos.)*

**Logo**: el logo del taller ya está disponible en `(RUTA_DEL_LOGO_AQUÍ)`. Úsalo directamente en navbar, login y favicon — no generes ni inventes un logo. Si el archivo en esa ruta no existe todavía, usa un placeholder simple (iniciales del taller en un círculo con los colores de la paleta) en su lugar, dejando ese componente fácilmente reemplazable. El campo `configuracion_sistema.logo_url` ya está contemplado en el esquema de BD para esto — debe apuntar a Supabase Storage una vez se suba el archivo definitivo.

---

## Estado actual del proyecto (leer antes de escribir cualquier prompt)

✅ **Ya está hecho, no se debe recrear ni modificar salvo pedido explícito:**
- Proyecto Next.js (App Router + TypeScript) scaffoldeado, dependencias instaladas, ESLint configurado.
- Repositorio Git privado en GitHub (`system_workshop`), con `.gitignore` correcto.
- Base de datos completa en Supabase: **17 tablas, RLS activo con políticas base en todas, función `get_user_role()`, y los 3 triggers/funciones de negocio** (auditoría automática, actualización de stock, cálculo de comisión). Documentado en `docs/schema-inicial-taller-motos.sql` y `docs/funciones-triggers-taller-motos.sql`.
- Carpetas base creadas: `components/{ui,forms,layout}`, `lib/{supabase,actions,validations}`, `types/`, `docs/`.

⬜ **Falta (esto es lo que le vas a pedir al agente, fase por fase):** todo el código de Next.js — desde auth hasta el dashboard final.

## Sugerencia de modelo por fase (para optimizar presupuesto en OpenCode Zen)
- **Fase 1 (auth/seguridad) y Fase 6 (hardening)**: modelo de mayor capacidad disponible en Zen — es donde un error sale más caro que el ahorro.
- **Fase 2 y 3 (CRUD repetitivo)**: modelo económico — el trabajo está muy bien especificado por el esquema y las skills.
- **Fase 4 (multi-moneda)**: modelo de capacidad media-alta, por la lógica de snapshots.
- **Fase 5 (dashboard/UI)**: priorizar un modelo con buena reputación en generación de interfaces, siempre apoyado en la skill `ui-ux-patterns`.

## FASE 0 — Setup del proyecto ✅ COMPLETADA (hecha manualmente por vos, no repetir)

**Prompt para la IA (referencia, ya no hace falta ejecutarlo):**
> Configura un proyecto Next.js (App Router, TypeScript) desde cero. Inicializa git con un `.gitignore` apropiado (incluyendo `.env*`). Crea la estructura de carpetas para: `app/`, `components/`, `lib/`, `types/`. Configura conexión a Supabase. Crea el archivo `AGENTS.md` en la raíz con el "Contexto del proyecto" y el "Checklist de seguridad" de este documento.

**Revisión:** ✅ `npm run dev` corre sin errores, ✅ `.env.local` fuera de git, ✅ carpetas base creadas.

---

## FASE 1 — Autenticación y roles (la base de datos YA está lista, ver "Estado actual")

**Prompt para la IA:**
> Las 17 tablas, RLS, y las funciones/triggers de negocio (auditoría, stock, comisiones) ya están creadas en Supabase — no crees ni modifiques tablas, funciones ni triggers en esta fase, solo consulta `docs/esquema-bd-taller-motos.md` como referencia de estructura. Implementa el flujo de autenticación con Supabase Auth usando `@supabase/ssr`: login, logout, **recuperación/primer acceso vía código OTP por email** (el usuario ingresa su correo → recibe un código numérico de 6 dígitos, nunca la contraseña actual → lo ingresa en el sistema → puede definir/actualizar su contraseña), protección de rutas vía middleware de Next.js, y el segundo factor (2FA/TOTP). **Antes de implementar el envío de correos, configura un proveedor SMTP externo gratuito (Resend recomendado — plan gratuito con volumen de sobra para 1-3 usuarios) en el dashboard de Supabase; no uses el servicio de email por defecto de Supabase, que está limitado a 2 correos por hora y no es apto ni para pruebas serias.** Crea la lógica de roles (`administrador` / `colaborador`) verificada siempre en el servidor. Aplica el checklist de seguridad de las secciones "Autenticación y sesión" y "Datos y base de datos" de `CLAUDE.md`.

**Revisión antes de avanzar:** probar login con usuario admin y con colaborador, confirmar que un colaborador no puede acceder a rutas de admin ni manipulando la URL directamente. Verificar en el dashboard de Supabase que RLS está activo en cada tabla creada (no solo definido, sino "Enabled").

---

## FASE 2 — Clientes, motos e inventario

**Prompt para la IA:**
> Implementa los módulos de `clientes`, `motos`, `categorias_repuesto`, `proveedores` y `repuestos` (CRUD completo). Sigue el esquema de `esquema-bd-taller-motos.md`. Aplica validación de datos en backend con Zod para cada endpoint. Aplica sanitización a los campos de texto libre. La UI debe usar skeleton loaders al cargar listas y UI optimista al crear/editar registros, según lo definido en "Principios de UI/UX" de `CLAUDE.md`. Los formularios deben tener los botones de acción en posición fija según ese mismo documento.

**Revisión antes de avanzar:** crear un cliente con datos inválidos (teléfono vacío, por ejemplo) y confirmar que el backend lo rechaza aunque se manipule el frontend. Confirmar que un colaborador puede ver/crear repuestos pero no eliminar el historial si esa restricción aplica.

---

## FASE 3 — Órdenes de servicio, mano de obra y empleados

**Prompt para la IA:**
> Implementa `empleados` (con su lógica de `tipo_vinculacion` y `porcentaje_comision`), `ordenes_servicio`, `orden_detalle_repuestos` y `orden_detalle_mano_obra`. Al agregar un repuesto o mano de obra a una orden, guarda el precio/comisión como snapshot (no como referencia viva), tal como está definido en el esquema. Implementa el descuento automático de `stock_actual` en `repuestos` al agregar un repuesto a una orden, registrando el movimiento en `movimientos_inventario`.

**Revisión antes de avanzar:** crear una orden de servicio completa de principio a fin, confirmar que el stock se descuenta correctamente y que el cálculo de comisión del mecánico es el esperado.

---

## FASE 4 — Facturación, pagos y multi-moneda

**Prompt para la IA:**
> Implementa `facturas` (vista en pantalla, sin generación de PDF por ahora), `pagos` y el módulo manual de `tasas_cambio` (solo accesible para `administrador`). La factura se genera a partir de una orden de servicio cerrada. Implementa la conversión de precios en pantalla a distintas monedas usando la tasa vigente, sin alterar los montos ya registrados en facturas pasadas (usar el campo `tasa_aplicada` como snapshot).

**Revisión antes de avanzar:** cambiar la tasa de cambio y confirmar que una factura ya emitida NO cambia de valor, mientras que una nueva factura sí usa la tasa actualizada.

---

## FASE 5 — Dashboard y reportes

**Prompt para la IA:**
> Crea el dashboard principal con: alertas de repuestos bajo `stock_minimo`, resumen de órdenes activas por estado, reporte de ingresos por mecánico (usando `comision_calculada`), reporte de ventas por rango de fechas, y un **gráfico de ventas semanales** (total facturado agrupado por semana, últimas 8-12 semanas) usando `facturas.fecha_emision` y `facturas.total` — no requiere tabla nueva, es una consulta agregada (`date_trunc('week', fecha_emision)`). Este módulo debe respetar los permisos por rol — un `colaborador` no ve reportes financieros completos, solo su propia producción.

**Revisión antes de avanzar:** verificar con datos de prueba que las alertas de stock aparecen correctamente, que un colaborador no puede ver los ingresos totales del taller, y que el gráfico semanal suma correctamente facturas de distintas semanas sin mezclarlas.

---

## FASE 6 — Hardening de seguridad (auditoría completa)

**Prompt para la IA:**
> Haz una auditoría completa del proyecto contra el "Checklist de seguridad no negociable" de `AGENTS.md`, punto por punto. Repórtame explícitamente cuáles están cumplidos, cuáles faltan, y corrige lo que falte. Presta especial atención a: CSP y el resto de los headers de seguridad (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) en `next.config.js`, CORS, rate limiting en todos los endpoints (no solo login), y que ningún error técnico se filtre al usuario final (revisa todos los `catch` y `error boundaries`). Ejecuta también `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;` en Supabase y confirmá que no devuelve ninguna fila.

**Verificación manual tuya (no del agente) antes de cerrar esta fase:**
- Abrir el sitio desplegado, DevTools → Sources, buscar el texto `service_role` en los archivos JS — si aparece, hay una fuga real que corregir antes de seguir.
- Correr el sitio por securityheaders.com y apuntar a nota A o A+.
- Configurar un pre-commit hook con gitleaks para detectar secretos antes de cada commit (el repo es privado, así que el escaneo nativo de GitHub no cubre esto gratis).

**Revisión antes de avanzar:** revisar el reporte manualmente, no solo confiar en que la IA dice "todo cumplido" — pedirle evidencia concreta (archivo y línea) de cada punto.

---

## FASE 7 — Testing

**Prompt para la IA:**
> Escribe pruebas para los flujos críticos: creación de orden de servicio completa (con descuento de stock y cálculo de comisión), emisión de factura con snapshot de tasa de cambio, y control de acceso por rol (que un colaborador no pueda ejecutar acciones de admin ni vía UI ni vía llamada directa al endpoint). Dame también una checklist manual de QA para que yo pruebe antes de producción.

---

## FASE 8 — Despliegue a producción

**Antes de empezar esta fase — propiedad de las cuentas:** crea la Organización de Supabase y el Team de Netlify a nombre del taller (no en tu cuenta personal), invita al dueño del taller como Owner con su propio correo, y agregate vos como miembro/desarrollador. Esto evita que el sistema quede atado a tu cuenta personal — el login con GitHub que uses para entrar es independiente de quién es el dueño real de la organización/proyecto.

**Prompt para la IA:**
> Prepara el proyecto para despliegue en Netlify (plan Starter/gratuito, permite uso comercial) + Supabase (plan Pro). Es un deploy único de todo el proyecto Next.js (frontend, Server Actions, API routes y middleware juntos) — Netlify detecta el framework automáticamente y separa internamente lo estático de las funciones server-side, no requiere configuración manual de "frontend" y "backend" por separado. Configura las variables de entorno en Netlify (nunca en el repo). Integra Sentry para monitoreo de errores. Dame una checklist de despliegue: dominio, HTTPS, backups activos en Supabase, verificación de que RLS sigue activo en producción, y rotación de cualquier clave que se haya usado en desarrollo antes de ir a producción. Verifica específicamente que las features usadas (Server Actions, middleware de auth) funcionan correctamente bajo el adaptador de Next.js de Netlify — si algo no despliega como en local, revisar la documentación de compatibilidad antes de forzar workarounds.

---

## Notas finales

- Cada fase termina con una revisión tuya — no avances a la siguiente sin haber probado la anterior.
- Si en algún punto la IA empieza a "adivinar" requisitos que no están en este documento, corrígela pidiéndole que se ciña estrictamente a lo definido acá y en `esquema-bd-taller-motos.md`.
- Guarda este archivo y el del esquema de BD en el repositorio (`docs/`) para que quede como referencia viva del proyecto.
