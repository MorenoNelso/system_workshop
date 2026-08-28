# Manual de mantenimiento post-lanzamiento — Sistema del taller de motos

> Este documento es para vos (como recordatorio de qué revisar) y también para dejarle una copia al dueño del taller, para que entienda qué implica mantener el sistema y no dependa de una explicación verbal tuya en el momento que menos tiempo tengas.

---

## Qué hace Supabase automáticamente (no requiere acción tuya)
- Backups diarios de la base de datos (plan Pro)
- Parches de seguridad del servidor y la base de datos
- Certificados SSL/HTTPS
- Disponibilidad del servidor (uptime)

## Qué revisar vos, y con qué frecuencia

| Frecuencia | Qué revisar | Dónde |
|---|---|---|
| Cuando llegue una alerta | Errores reportados por Sentry | Dashboard de Sentry (llega por email) |
| Mensual | Uso de la base de datos (¿se acerca al límite del plan?) | Dashboard de Supabase → Usage |
| Mensual | Créditos de Netlify (¿se acerca a los 300 del plan gratuito?) | Dashboard de Netlify → Usage. Si se acercan al límite, subir al plan Personal ($9/mes, 1,000 créditos) antes de considerar el Pro ($20/mes) |
| Mensual | Que el dominio y el plan de Netlify/Supabase sigan activos | Dashboard de Netlify / Supabase |
| Cada 6 meses | Rotar la contraseña del usuario `administrador` como buena práctica | Dentro del sistema |
| Cuando el taller lo pida | Cambios de funcionalidad, ajustes de precios de repuestos, nuevos reportes | A cotizar según alcance |

## Qué hacer si algo falla (guía rápida)

1. **El sistema no carga / da error general**: revisar el estado de Supabase en [status.supabase.com] y de Netlify en [netlifystatus.com] — puede ser una caída del proveedor, no del código.
2. **Un usuario no puede iniciar sesión**: verificar en Supabase → Authentication si el usuario existe y no está bloqueado por intentos fallidos.
3. **No llegan los correos de recuperación/OTP**: revisar el dashboard del proveedor SMTP (Resend) — puede ser que se alcanzó el límite del plan gratuito o hay un problema de configuración.
4. **Un dato se ve incorrecto (precio, stock, etc.)**: revisar `logs_auditoria` para ver qué usuario y cuándo se modificó ese registro, antes de asumir que es un bug.
5. **El taller reporta que "todo se ve raro" en la laptop**: probar primero en otro navegador/dispositivo — puede ser un problema local de esa laptop (caché, actualización pendiente de Windows), no del sistema.

## Alcance de soporte (para conversar con el dueño del taller)

Sugerencia de acuerdo simple a proponer:
- **Incluido sin costo adicional**: corrección de errores/bugs del sistema tal como fue entregado, durante los primeros ___ meses tras el lanzamiento.
- **Fuera de ese alcance** (se cotiza aparte): funcionalidades nuevas, cambios de diseño, módulos adicionales (como el de citas que quedó pendiente), migraciones de datos masivas.
- **Costos recurrentes del taller** (no tuyos): el plan de Supabase Pro (~$25/mes) y cualquier dominio/correo profesional que hayan contratado — esto corre por cuenta del taller, asociado a su propia organización (ver nota de propiedad de cuentas en la Fase 8 del prompt maestro).

## Contacto de emergencia (a completar antes del lanzamiento)
- Tu contacto de respaldo (otro desarrollador, comunidad, o vos mismo con tiempo acotado): _______
- Acceso de emergencia: el dueño del taller, como Owner de la organización de Supabase y Netlify, siempre puede invitar a otro desarrollador para que revise el sistema aunque vos no estés disponible — por eso es tan importante que la propiedad de esas cuentas quede en su nombre desde el día 1.
