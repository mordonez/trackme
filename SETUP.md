# Configuración de TrackMe

## Requisitos Previos

- Node.js y npm instalados
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado
- Cuenta de Cloudflare

## Configuración Inicial

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd trackme
npm install
```

### 2. Configurar wrangler.toml

Copia el archivo de ejemplo y configúralo con tus valores:

```bash
cp wrangler.toml.example wrangler.toml
```

### 3. Crear base de datos D1

```bash
wrangler d1 create trackme-db
```

Toma nota del `database_id` que se genera y actualízalo en `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trackme-db"
database_id = "tu-database-id-aqui"
```

### 4. Inicializar el esquema de la base de datos

```bash
wrangler d1 execute trackme-db --remote --file=./schema.sql
```

### 5. Configurar Variables de Entorno

#### Para Desarrollo Local

Crea un archivo `.dev.vars` en la raíz del proyecto:

```bash
# .dev.vars
USER=tu-usuario
PASSWORD=tu-password-seguro
```

**IMPORTANTE**: El archivo `.dev.vars` NO se sube a git. Está en `.gitignore`.

#### Para Producción

Configura los secretos en Cloudflare usando Wrangler:

```bash
wrangler secret put USER
# Ingresa tu usuario cuando se te solicite

wrangler secret put PASSWORD
# Ingresa tu password cuando se te solicite
```

## Desarrollo Local

Para ejecutar el proyecto localmente:

```bash
wrangler dev
```

Esto iniciará un servidor local que usa las variables del archivo `.dev.vars`.

## Despliegue a Producción

```bash
wrangler deploy
```

## Seguridad

⚠️ **Nunca subas a git**:
- `wrangler.toml` (contiene IDs específicos de tu proyecto)
- `.dev.vars` (contiene credenciales de desarrollo)
- `.env` o archivos con secretos

✅ **Sí puedes subir a git**:
- `wrangler.toml.example` (plantilla sin datos sensibles)
- Código fuente
- Documentación

## Comandos Útiles

```bash
# Ver logs en producción
wrangler tail

# Ejecutar consultas en la base de datos
wrangler d1 execute trackme-db --remote --command="SELECT * FROM symptoms"

# Listar secretos configurados
wrangler secret list

# Eliminar un secreto
wrangler secret delete <nombre-secret>
```

## Solución de Problemas

### Error: "database_id not found"
- Verifica que creaste la base de datos con `wrangler d1 create trackme-db`
- Actualiza el `database_id` en `wrangler.toml` con el ID generado

### Error de autenticación
- Verifica que configuraste los secretos USER y PASSWORD
- Para desarrollo, verifica que `.dev.vars` existe y tiene las variables correctas
- Para producción, ejecuta `wrangler secret list` para ver los secretos configurados

### No se puede desplegar
- Ejecuta `wrangler login` para autenticarte con Cloudflare
- Verifica que tienes permisos en la cuenta de Cloudflare
