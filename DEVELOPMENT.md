# 🛠️ Guía de Desarrollo Local con Pull Requests

Esta guía explica cómo trabajar localmente y usar Pull Requests con entornos de preview automáticos.

## 📋 Tabla de Contenidos

- [Configuración Inicial](#configuración-inicial)
- [Desarrollo Local](#desarrollo-local)
- [Flujo de Trabajo con Pull Requests](#flujo-de-trabajo-con-pull-requests)
- [Entornos de Preview](#entornos-de-preview)
- [Scripts Disponibles](#scripts-disponibles)
- [Troubleshooting](#troubleshooting)

## 🚀 Configuración Inicial

### 1. Requisitos Previos

- Node.js v18 o superior
- Cuenta de Cloudflare
- Git configurado

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Autenticar Wrangler

```bash
npx wrangler login
```

### 4. Configurar Secretos de GitHub (Solo una vez)

Para que los workflows de GitHub Actions funcionen, necesitas configurar estos secretos en tu repositorio:

1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Agrega los siguientes secretos:

- `CLOUDFLARE_API_TOKEN`: Token de API de Cloudflare
  - Crea uno en: https://dash.cloudflare.com/profile/api-tokens
  - Permisos necesarios:
    - Account → D1 → Edit
    - Account → Workers Scripts → Edit

- `CLOUDFLARE_ACCOUNT_ID`: ID de tu cuenta de Cloudflare
  - Encuéntralo en: https://dash.cloudflare.com/ (en la URL o en el dashboard)

## 💻 Desarrollo Local

### Opción 1: Desarrollo con Base de Datos Local (Recomendado para desarrollo rápido)

Esta opción usa una base de datos SQLite local que persiste entre reinicios:

```bash
npm run dev:local
```

**Ventajas:**
- ✅ No necesita conexión a Cloudflare
- ✅ Más rápido
- ✅ Los datos persisten entre reinicios
- ✅ Ideal para desarrollo y pruebas

**Desventajas:**
- ❌ No refleja exactamente el entorno de producción

### Opción 2: Desarrollo con Base de Datos Remota

Esta opción conecta a una base de datos D1 real en Cloudflare:

```bash
# 1. Crear la base de datos de desarrollo (solo la primera vez)
npm run db:create

# 2. Actualizar el database_id en wrangler.toml

# 3. Inicializar el schema
npm run db:init

# 4. Iniciar el servidor de desarrollo
npm run dev
```

**Ventajas:**
- ✅ Entorno idéntico a producción
- ✅ Puedes compartir datos con otros desarrolladores

**Desventajas:**
- ❌ Requiere conexión a internet
- ❌ Más lento que el modo local

### Consultar la Base de Datos

```bash
# Listar todas las bases de datos
npm run db:list

# Ejecutar una consulta SQL
npm run db:query "SELECT * FROM symptom_types"
```

## 🔄 Flujo de Trabajo con Pull Requests

### Paso 1: Crear una Nueva Rama

```bash
git checkout -b feature/nueva-funcionalidad
```

### Paso 2: Hacer Cambios Locales

```bash
# Desarrollar con base de datos local
npm run dev:local

# Hacer tus cambios en el código
# Probar localmente
```

### Paso 3: Commit y Push

```bash
git add .
git commit -m "feat: agregar nueva funcionalidad"
git push origin feature/nueva-funcionalidad
```

### Paso 4: Crear Pull Request

1. Ve a GitHub y crea un Pull Request
2. **Automáticamente** se creará:
   - ✅ Una base de datos D1 temporal para tu PR
   - ✅ Un Worker de Cloudflare para tu PR
   - ✅ Un comentario en el PR con la URL del preview

### Paso 5: Validar en el Preview

El bot de GitHub comentará en tu PR con:
- 🌐 URL del preview
- 📊 Información de la base de datos
- 🔐 Credenciales de acceso

**Ejemplo:**
```
Preview URL: https://trackme-pr-123.workers.dev
User: admin
Password: preview-123
```

### Paso 6: Hacer Cambios Adicionales

```bash
# Hacer más cambios
git add .
git commit -m "fix: corregir bug"
git push

# El preview se actualizará automáticamente
```

### Paso 7: Merge del PR

Cuando hagas merge o cierres el PR:
- ✅ El Worker se borra automáticamente
- ✅ La base de datos se borra automáticamente
- ✅ No quedan recursos huérfanos

## 🎯 Entornos de Preview

### Crear Preview Manualmente (Opcional)

Si quieres crear un preview local sin hacer PR:

```bash
# Crear preview para la rama actual
npm run preview:create

# O especificar una rama
npm run preview:create feature/mi-rama
```

Esto creará:
- Base de datos: `trackme-feature-mi-rama`
- Worker: `trackme-feature-mi-rama`
- Archivo de config: `wrangler.feature-mi-rama.toml`

### Borrar Preview Manual

```bash
# Borrar preview de la rama actual
npm run preview:delete

# O especificar una rama
npm run preview:delete feature/mi-rama
```

## 📜 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo local con DB remota |
| `npm run dev:local` | Desarrollo local con DB local persistente |
| `npm run deploy` | Desplegar a producción |
| `npm run db:create` | Crear nueva base de datos D1 |
| `npm run db:init` | Inicializar schema de BD |
| `npm run db:list` | Listar todas las bases de datos |
| `npm run db:query` | Ejecutar consulta SQL |
| `npm run preview:create` | Crear preview manual |
| `npm run preview:delete` | Borrar preview manual |

## 🏗️ Entornos Disponibles

### Producción (por defecto)

```bash
npm run deploy
```

### Staging

```bash
# 1. Crear la DB de staging
npx wrangler d1 create trackme-db-staging

# 2. Actualizar el database_id en wrangler.toml [env.staging]

# 3. Inicializar schema
npx wrangler d1 execute trackme-db-staging --file=./schema.sql

# 4. Desplegar a staging
npx wrangler deploy --env staging
```

## 🐛 Troubleshooting

### Error: "Database not found"

```bash
# Verifica que la DB existe
npm run db:list

# Si no existe, créala
npm run db:create

# Inicializa el schema
npm run db:init
```

### El preview no se actualiza en el PR

1. Verifica que los secrets de GitHub estén configurados correctamente
2. Revisa los logs del workflow en la pestaña "Actions" de GitHub
3. Verifica que el workflow tenga permisos para comentar en PRs

### Error: "CLOUDFLARE_API_TOKEN not set"

Configura los secretos en GitHub Settings → Secrets and variables → Actions

### El workflow falla al crear la DB

- Verifica que el token de Cloudflare tenga permisos de D1
- Verifica que el ACCOUNT_ID sea correcto
- Revisa los logs detallados en GitHub Actions

### Limpiar previews huérfanos manualmente

Si por alguna razón quedaron recursos sin borrar:

```bash
# Listar todas las DBs
npm run db:list

# Listar todos los workers
npx wrangler deployments list

# Borrar DB específica
npx wrangler d1 delete trackme-pr-123 --skip-confirmation

# Borrar worker específico
npx wrangler delete trackme-pr-123 --force
```

## 💡 Mejores Prácticas

### 1. Nombres de Ramas

Usa nombres descriptivos:
- ✅ `feature/symptom-categories`
- ✅ `fix/login-bug`
- ✅ `refactor/database-queries`
- ❌ `test`
- ❌ `cambios`

### 2. Commits

Usa mensajes claros:
- ✅ `feat: add export functionality`
- ✅ `fix: resolve authentication timeout`
- ✅ `docs: update development guide`

### 3. Pull Requests

- Haz PRs pequeños y enfocados
- Prueba el preview antes de solicitar review
- Borra la rama después del merge

### 4. Base de Datos Local vs Remota

- **Usa local** para desarrollo día a día
- **Usa remota** cuando necesites probar con datos reales o compartir con el equipo

## 🔐 Seguridad

- ⚠️ **NUNCA** commits credenciales en el código
- ⚠️ **SIEMPRE** usa variables de entorno
- ⚠️ **CAMBIA** las credenciales por defecto en producción
- ⚠️ Las credenciales de preview son temporales y se borran con el PR

## 📚 Recursos Adicionales

- [Documentación de Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Documentación de D1](https://developers.cloudflare.com/d1/)
- [Documentación de Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

¿Tienes preguntas? Abre un issue en GitHub.
