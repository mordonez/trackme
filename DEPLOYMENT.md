# Guía de Despliegue - TrackMe Mobile UI

## ✅ Base de Datos Local Actualizada

La base de datos local ya fue configurada con el nuevo esquema multi-usuario.

## 📦 Pasos para Desplegar a Producción

### 1. Actualizar la Base de Datos Remota

Ejecuta el siguiente comando para aplicar el nuevo esquema a tu base de datos en Cloudflare:

```bash
npx wrangler d1 execute trackme-db --remote --file=schema.sql
```

Esto creará:
- ✅ Tabla `users` con autenticación segura
- ✅ Tabla `symptom_logs` con soporte multi-usuario
- ✅ Tabla `symptom_types` (sin cambios)
- ✅ Índices optimizados para búsquedas rápidas

### 2. Crear Usuario Inicial (Opcional)

Si deseas crear un usuario administrador inicial, puedes hacerlo mediante la interfaz de registro o ejecutando:

```bash
# No es necesario - los usuarios se registran desde la app
```

### 3. Desplegar la Aplicación

```bash
npm run deploy
```

### 4. Verificar el Despliegue

1. Abre tu aplicación en el navegador
2. Verás la nueva pantalla de autenticación móvil
3. Toca "Registrarse" y crea tu cuenta (usuario + contraseña)
4. El registro debería completarse en menos de 5 segundos

## 🔄 Migración de Datos Existentes

Si tienes datos existentes en producción, necesitas migrarlos al nuevo sistema:

### Opción A: Asignar logs existentes a un usuario admin

```sql
-- 1. Crear usuario admin con contraseña "admin123" (hash SHA-256)
INSERT INTO users (id, username, password_hash, created_at)
VALUES (1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', CURRENT_TIMESTAMP);

-- 2. Añadir columna user_id a symptom_logs existente
ALTER TABLE symptom_logs ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;

-- 3. Actualizar todos los logs existentes para asignarlos al admin
UPDATE symptom_logs SET user_id = 1 WHERE user_id IS NULL;
```

### Opción B: Empezar desde cero

Si prefieres empezar con una base de datos limpia:

```bash
# Esto recreará las tablas vacías
npx wrangler d1 execute trackme-db --remote --file=schema.sql
```

## 🗑️ Eliminación de Variables de Entorno Obsoletas

El nuevo sistema ya NO utiliza las siguientes variables de entorno:
- ❌ `TRACKME_USER` (eliminado)
- ❌ `TRACKME_PASSWORD` (eliminado)

Los usuarios ahora se almacenan en la base de datos con contraseñas hasheadas (SHA-256).

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con SHA-256
- ✅ Tokens con expiración (7 días)
- ✅ Validación de usuarios activos en cada request
- ✅ Protección contra timing attacks
- ✅ Sanitización de inputs
- ✅ Límites de longitud en campos

## 📱 Características del Nuevo UI Móvil

- ✅ Registro en menos de 5 segundos
- ✅ Toggle instantáneo entre Login/Registro
- ✅ Validación en tiempo real
- ✅ Diseño mobile-first
- ✅ Animaciones suaves
- ✅ Botones touch-friendly
- ✅ Auto-login después de registro

## 🐛 Troubleshooting

### Error: "no such column: user_id"

**Causa**: La base de datos local tiene el esquema antiguo sin la columna `user_id`.

**Solución**: Necesitas eliminar y recrear la base de datos local:

```bash
# 1. Eliminar la base de datos local existente
rm -rf .wrangler/state/v3/d1

# 2. Recrear con el nuevo esquema
npx wrangler d1 execute trackme-db --local --file=schema.sql

# 3. Verificar que se creó correctamente
npx wrangler d1 execute trackme-db --local --command "PRAGMA table_info(symptom_logs);"
```

**Nota**: Esto borrará todos los datos locales. Para producción, ver la sección "Migración de Datos Existentes" más arriba.

### Error: "El nombre de usuario ya existe"

**Solución**: El usuario que intentas registrar ya existe. Usa otro nombre de usuario o inicia sesión con las credenciales existentes.

### La base de datos está vacía después del despliegue

**Solución**: Esto es normal. El schema.sql incluye datos de ejemplo para `symptom_types`. Si no aparecen, ejecuta:

```bash
npx wrangler d1 execute trackme-db --remote --command "INSERT OR IGNORE INTO symptom_types (id, name) VALUES (1, 'Dolor de cabeza'), (2, 'Alergia'), (3, 'Náuseas');"
```

## 📞 Soporte

Si encuentras algún problema, revisa los logs:

```bash
# Ver logs en tiempo real
npx wrangler tail

# Ver logs del worker
npx wrangler dev
```
