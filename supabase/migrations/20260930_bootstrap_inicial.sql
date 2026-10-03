-- ============================================================
-- BOOTSTRAP INICIAL (deploy fresco / BD vacía)
-- Ejecutar en Supabase → SQL Editor, UNA vez por proyecto nuevo
-- (idempotente: se puede re-ejecutar sin duplicar)
-- ============================================================
-- Sin esto el dashboard crashea (`monedas[0]` vacío) y nadie puede
-- entrar (no existe admin). Orden sugerido en deploy fresco:
--   1. Este archivo (monedas + configuración)
--   2. docs/schema-inicial + triggers + RLS (si el proyecto parte de cero)
--   3. Crear bucket `logos` en Storage (público, para logos del taller)
--   4. Crear el primer usuario en Auth → Dashboard → Authentication → Users
--   5. Paso PRIMER ADMIN (abajo) con el UUID del paso 4
--   6. Entrar a /tasas y registrar las tasas vigentes (manual, nunca auto)
--
-- UUIDs fijos para que futuros seeds/scripts referencien monedas estables.

-- ---- 1. Monedas base ----
INSERT INTO public.monedas (id, codigo, nombre, simbolo) VALUES
  ('10000000-0000-4000-8000-000000000001', 'COP', 'Peso Colombiano', '$'),
  ('10000000-0000-4000-8000-000000000002', 'USD', 'Dólar Estadounidense', '$'),
  ('10000000-0000-4000-8000-000000000003', 'VES', 'Bolívar Venezolano', 'Bs')
ON CONFLICT (codigo) DO NOTHING;

-- ---- 2. Configuración del taller ----
INSERT INTO public.configuracion_sistema (nombre_taller)
SELECT 'Pacho Motos'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_sistema);

-- ---- 3. PRIMER ADMIN (descomentar y reemplazar) ----
-- 3a. Crea el usuario en el Dashboard: Authentication → Users → Add user
--     (email real del taller + contraseña de mínimo 10 caracteres).
-- 3b. Copia su UUID (columna UID) y pégalo abajo en <ADMIN_UUID> (2 veces).
-- 3c. Ejecuta solo este bloque.
--
-- INSERT INTO public.usuarios (id, email, nombre, rol, activo)
-- VALUES ('<ADMIN_UUID>', 'taller@tudominio.com', 'Dueño', 'administrador', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- INSERT INTO public.empleados (usuario_id, nombre, porcentaje_comision, activo)
-- SELECT '<ADMIN_UUID>', 'Dueño', 100, true
-- WHERE NOT EXISTS (SELECT 1 FROM public.empleados WHERE usuario_id = '<ADMIN_UUID>');

-- ---- Verificación ----
-- SELECT codigo FROM public.monedas ORDER BY codigo;  -- COP, USD, VES
-- SELECT nombre_taller FROM public.configuracion_sistema;
-- SELECT email, rol FROM public.usuarios WHERE rol = 'administrador';
