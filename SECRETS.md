# 🔐 Guía de Configuración de Secretos y Variables de Entorno

Esta guía explica cómo configurar credenciales y variables sensibles de forma segura **sin commitear secretos al repositorio**.

## 📋 Tabla de Contenidos

- [Desarrollo Local](#desarrollo-local)
- [Producción (Cloudflare Secrets)](#producción-cloudflare-secrets)
- [GitHub Actions (Pull Requests)](#github-actions-pull-requests)
- [Staging](#staging)
- [Verificación](#verificación)
- [Troubleshooting](#troubleshooting)

## 💻 Desarrollo Local

### Paso 1: Crear archivo `.dev.vars`

Las variables para desarrollo local se configuran en `.dev.vars` (este archivo está en `.gitignore` y **NUNCA se commitea**):

```bash
# Copiar la plantilla
cp .dev.vars.example .dev.vars
```

### Paso 2: Configurar tus credenciales

Edita `.dev.vars` con tus credenciales:

```bash
# .dev.vars
USER=admin
PASSWORD=mi-password-super-seguro-123
```

### Paso 3: Iniciar desarrollo

```bash
# Modo local (sin conexión a Cloudflare)
npm run dev:local

# O modo remoto (con DB de Cloudflare)
npm run dev
```

**✅ Ventajas:**
- ✅ Las credenciales están fuera del repositorio
- ✅ Cada desarrollador tiene sus propias credenciales
- ✅ Wrangler carga automáticamente `.dev.vars`

## 🚀 Producción (Cloudflare Secrets)

Para producción, usamos **Cloudflare Secrets** que se almacenan de forma segura en Cloudflare.

### Paso 1: Configurar secretos de Cloudflare

```bash
# Configurar USER
npx wrangler secret put USER

# Cuando se solicite, ingresa: admin (o tu usuario deseado)

# Configurar PASSWORD
npx wrangler secret put PASSWORD

# Cuando se solicite, ingresa tu password seguro
```

**IMPORTANTE:** Los secretos de Cloudflare:
- ✅ Se almacenan encriptados en Cloudflare
- ✅ Nunca aparecen en logs ni en el código
- ✅ Solo están disponibles en runtime del Worker
- ✅ No se pueden leer después de configurarlos (solo actualizar)

### Paso 2: Configurar Database ID

Edita `wrangler.toml` y actualiza el `database_id`:

```bash
# 1. Crear la base de datos de producción
npx wrangler d1 create trackme-db

# 2. Copiar el database_id que te muestra el comando

# 3. Editar wrangler.toml y reemplazar:
database_id = "YOUR_PRODUCTION_DATABASE_ID"  # ← Pega aquí tu ID
```

**⚠️ NOTA:** El `database_id` NO es sensible, pero es específico de cada entorno, por eso cada desarrollador debe configurar el suyo.

### Paso 3: Inicializar la base de datos

```bash
npm run db:init
```

### Paso 4: Desplegar

```bash
npm run deploy
```

## 🔧 Staging

Para el entorno de staging:

```bash
# 1. Crear DB de staging
npx wrangler d1 create trackme-db-staging

# 2. Actualizar database_id en wrangler.toml [env.staging]

# 3. Configurar secretos para staging
npx wrangler secret put USER --env staging
npx wrangler secret put PASSWORD --env staging

# 4. Inicializar DB
npx wrangler d1 execute trackme-db-staging --file=./schema.sql

# 5. Desplegar
npx wrangler deploy --env staging
```

## 🤖 GitHub Actions (Pull Requests)

Para que los workflows de PR funcionen automáticamente:

### Paso 1: Obtener Cloudflare API Token

1. Ve a: https://dash.cloudflare.com/profile/api-tokens
2. Clic en **"Create Token"**
3. Selecciona **"Create Custom Token"**
4. Configura los permisos:
   - **Account** → **D1** → **Edit**
   - **Account** → **Workers Scripts** → **Edit**
5. Copia el token generado (solo se muestra una vez)

### Paso 2: Obtener Cloudflare Account ID

1. Ve a: https://dash.cloudflare.com/
2. El Account ID está en la URL o en el dashboard
3. Ejemplo: `https://dash.cloudflare.com/abc123...` → `abc123...` es tu Account ID

### Paso 3: Configurar GitHub Secrets

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Clic en **"New repository secret"**
4. Agrega estos secretos:

| Nombre | Valor | Descripción |
|--------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | Tu API token | Token de Cloudflare con permisos |
| `CLOUDFLARE_ACCOUNT_ID` | Tu account ID | ID de cuenta de Cloudflare |
| `ADMIN_USER` | admin | Usuario para PRs (opcional) |
| `ADMIN_PASSWORD_BASE` | base-secret | Base para passwords de PR (opcional) |

### Paso 4: Verificar

Crea un PR de prueba y verifica que:
- ✅ El workflow se ejecuta sin errores
- ✅ Se crea la DB temporal
- ✅ Se despliega el Worker
- ✅ Aparece el comentario con la URL

## ✅ Verificación

### Verificar desarrollo local

```bash
# Verificar que .dev.vars existe y tiene contenido
cat .dev.vars

# Debería mostrar algo como:
# USER=admin
# PASSWORD=tu-password

# Iniciar el servidor
npm run dev:local

# Abrir http://localhost:8787 y hacer login
```

### Verificar secretos de producción

```bash
# Listar secretos configurados (no muestra los valores)
npx wrangler secret list

# Debería mostrar:
# [
#   {
#     "name": "USER",
#     "type": "secret_text"
#   },
#   {
#     "name": "PASSWORD",
#     "type": "secret_text"
#   }
# ]
```

### Verificar base de datos

```bash
# Listar bases de datos
npm run db:list

# Verificar contenido
npm run db:query "SELECT * FROM symptom_types"
```

## 🐛 Troubleshooting

### Error: "USER is not defined" en producción

**Causa:** No se configuraron los secretos de Cloudflare.

**Solución:**
```bash
npx wrangler secret put USER
npx wrangler secret put PASSWORD
npm run deploy
```

### Error: "Unauthorized" en desarrollo local

**Causa:** El archivo `.dev.vars` no existe o está mal configurado.

**Solución:**
```bash
# Crear el archivo desde la plantilla
cp .dev.vars.example .dev.vars

# Editar y configurar tus credenciales
nano .dev.vars

# Reiniciar el servidor
npm run dev:local
```

### Error: "Database not found"

**Causa:** El `database_id` en `wrangler.toml` no es correcto o la DB no existe.

**Solución:**
```bash
# Verificar que la DB existe
npm run db:list

# Si no existe, crearla
npm run db:create

# Copiar el database_id y actualizar wrangler.toml
```

### Los workflows de GitHub fallan

**Causas comunes:**

1. **Secretos no configurados:**
   - Verifica en Settings → Secrets → Actions
   - Deben existir `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`

2. **Token sin permisos:**
   - Crea un nuevo token con permisos de D1 y Workers
   - Actualiza el secret `CLOUDFLARE_API_TOKEN`

3. **Account ID incorrecto:**
   - Verifica que sea el correcto en el dashboard
   - Actualiza el secret `CLOUDFLARE_ACCOUNT_ID`

### Actualizar un secreto de producción

```bash
# Actualizar PASSWORD
npx wrangler secret put PASSWORD

# Ingresa el nuevo password cuando se solicite

# Redesplegar
npm run deploy
```

### Eliminar un secreto

```bash
# Eliminar un secreto
npx wrangler secret delete PASSWORD

# Listar para verificar
npx wrangler secret list
```

## 🔒 Mejores Prácticas de Seguridad

### ✅ DO (Hacer)

- ✅ Usar passwords fuertes (min 12 caracteres)
- ✅ Usar secretos diferentes para dev/staging/prod
- ✅ Mantener `.dev.vars` en `.gitignore`
- ✅ Documentar qué secretos son necesarios
- ✅ Rotar secretos periódicamente
- ✅ Usar tokens de API con permisos mínimos

### ❌ DON'T (No hacer)

- ❌ NUNCA commitear `.dev.vars`
- ❌ NUNCA poner passwords en `wrangler.toml`
- ❌ NUNCA compartir tokens de API en Slack/email
- ❌ NUNCA usar el mismo password en todos los entornos
- ❌ NUNCA poner secretos en logs o comentarios de código
- ❌ NUNCA usar passwords débiles como "admin123"

## 📚 Estructura de Archivos de Configuración

```
trackme/
├── .dev.vars                    # ❌ NO commitear (en .gitignore)
│   └── USER=admin
│   └── PASSWORD=local-password
│
├── .dev.vars.example            # ✅ Commitear (plantilla)
│   └── USER=admin
│   └── PASSWORD=tu-password-seguro
│
├── wrangler.toml                # ✅ Commitear (sin secretos)
│   └── database_id = "YOUR_..."  # Placeholder
│
└── .gitignore                   # ✅ Commitear
    └── .dev.vars                # ← Importante
```

## 🔄 Flujo de Trabajo Completo

### Desarrollador Nuevo (Primera Vez)

```bash
# 1. Clonar repo
git clone https://github.com/tu-usuario/trackme.git
cd trackme

# 2. Instalar dependencias
npm install

# 3. Configurar variables locales
cp .dev.vars.example .dev.vars
nano .dev.vars  # Editar credenciales

# 4. Autenticar con Cloudflare
npx wrangler login

# 5. Crear DB local
npx wrangler d1 create trackme-db-dev

# 6. Actualizar wrangler.toml con tu database_id

# 7. Inicializar DB
npm run db:init

# 8. Iniciar desarrollo
npm run dev:local
```

### Desplegar a Producción (Primera Vez)

```bash
# 1. Crear DB de producción
npx wrangler d1 create trackme-db

# 2. Actualizar database_id en wrangler.toml

# 3. Configurar secretos
npx wrangler secret put USER
npx wrangler secret put PASSWORD

# 4. Inicializar schema
npm run db:init

# 5. Desplegar
npm run deploy
```

## 📞 Soporte

Si tienes problemas con la configuración de secretos:

1. Revisa esta guía completa
2. Verifica los logs en Cloudflare Dashboard
3. Revisa los logs de GitHub Actions
4. Abre un issue con detalles del error

---

**🔐 Recuerda:** La seguridad es responsabilidad de todos. Nunca commitees credenciales.
