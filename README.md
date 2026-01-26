# 📊 TrackMe - Rastreador de Síntomas

PoC para registrar síntomas (dolor de cabeza, alergias, etc.) usando **Hono + Cloudflare D1 + HTMX**. Proyecto personal para probar y aprender: HTMLX y Cloudflare workers.

## ✨ Características

- Interfaz con botones grandes para registrar eventos rápidamente
- Campo de notas opcionales y checkbox de medicación
- Historial de los últimos 90 días
- Panel de administración para gestionar tipos de síntomas
- Autenticación segura con cookies HTTP-only
- 100% serverless en Cloudflare Workers

## 🚀 Stack

- **Backend**: Hono (framework web ultrarrápido)
- **Base de datos**: Cloudflare D1 (SQLite)
- **Frontend**: HTMX + JSX (sin React)
- **Testing**: Vitest
- **Deploy**: Cloudflare Workers

## 🛠️ Inicio Rápido

### 1. Instalar

```bash
npm install
cp wrangler.toml.example wrangler.toml
```

### 2. Crear Base de Datos

```bash
npx wrangler d1 create trackme-db
```

Copia el `database_id` que te da y actualízalo en `wrangler.toml`.

### 3. Inicializar Base de Datos

```bash
npm run db:init  # Para desarrollo local
```

### 4. Configurar Credenciales

Crea `.dev.vars` en la raíz:

```
TRACKME_USER=tu-usuario
TRACKME_PASSWORD=tu-password
SESSION_SECRET=clave-secreta-aleatoria
```

### 5. Ejecutar

```bash
npm run dev
```

Abre `http://localhost:8787`

## 🚢 Despliegue a Producción

```bash
npx wrangler login
wrangler secret put TRACKME_USER
wrangler secret put TRACKME_PASSWORD
wrangler secret put SESSION_SECRET
npm run deploy
npm run db:init:remote  # Solo la primera vez
```

## 📖 Uso

1. Haz login con tus credenciales
2. Clic en un botón de síntoma para registrar
3. Opcionalmente agrega notas y marca si tomaste medicación
4. El historial se actualiza automáticamente
5. Usa el Panel Admin para agregar/eliminar tipos de síntomas

## 🔧 Comandos Principales

```bash
npm run dev              # Desarrollo local
npm run deploy           # Desplegar a producción
npm test                 # Ejecutar tests
npm run db:init          # Inicializar DB local
npm run db:init:remote   # Inicializar DB producción
```

## 🗄️ Base de Datos

- **symptom_types**: Tipos de síntomas configurables
- **symptom_logs**: Registros con fecha, notas y medicación

### Migraciones

Automáticas en producción al hacer push a `main`.

Para desarrollo local:

```bash
npx wrangler d1 execute trackme-db --local --file=./migrations/001_add_medication_taken.sql
```

Ver `migrations/README.md` para más detalles.

## 🔐 Seguridad

- Cookies HTTP-only seguras
- HTTPS por defecto (Cloudflare)
- Validación de entrada con Zod
- Headers de seguridad (CSP, HSTS, etc.)
- Nunca subas `.dev.vars` o `wrangler.toml` a git

## 🐛 Problemas Comunes

**Database not found**: Verifica `database_id` en `wrangler.toml`

**Unauthorized**: Revisa que `.dev.vars` existe o ejecuta `wrangler secret list`

**Cambios no se reflejan**: Reinicia con `npm run dev`

## 📝 Licencia

MIT

---

Hecho con ❤️ usando Cloudflare Workers
