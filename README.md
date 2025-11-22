# 📊 TrackMe - Minimalist Symptom Tracker

Una aplicación web minimalista para trackear síntomas o eventos (dolor de cabeza, alergias, etc.) usando **Hono + Cloudflare D1 + HTMX**.

## ✨ Características

- **Ultra-simple**: Interfaz con botones grandes para registrar eventos rápidamente
- **Notas opcionales**: Campo de texto para agregar detalles adicionales
- **Historial**: Visualiza los últimos 14 días de registros
- **Panel Admin**: Gestiona los tipos de síntomas a trackear
- **Autenticación**: Login seguro con cookies HTTP-only
- **Serverless**: 100% en Cloudflare Workers (sin servidor tradicional)
- **Base de datos**: SQLite con Cloudflare D1
- **Interactividad moderna**: UI dinámica sin recargas de página usando HTMX
- **Testing**: Suite de pruebas con Vitest y Cloudflare Workers pool
- **CI/CD**: Despliegue automático con GitHub Actions

## 🚀 Stack Tecnológico

- **Framework**: Hono (framework web ultrarrápido para Cloudflare Workers)
- **Base de datos**: Cloudflare D1 (SQLite) con integración nativa
- **Frontend**: HTMX para interactividad sin JavaScript pesado
- **Arquitectura**: Server-Side Rendering con actualizaciones parciales
- **Testing**: Vitest con @cloudflare/vitest-pool-workers
- **CI/CD**: GitHub Actions para testing y deployment automático

## 📁 Estructura del Proyecto

```
trackme/
├── .github/
│   └── workflows/
│       ├── deploy.yml     # Workflow de despliegue automático
│       └── test.yml       # Workflow de pruebas automáticas
├── src/
│   └── index.js           # Aplicación Hono principal
├── test/
│   └── index.test.js      # Tests con Vitest
├── public/                # Archivos estáticos (CSS, JS, imágenes)
├── schema.sql             # Schema de la base de datos
├── wrangler.toml          # Configuración de Cloudflare Workers (no en git)
├── wrangler.toml.example  # Plantilla de configuración
├── vitest.config.js       # Configuración de Vitest
├── .dev.vars              # Variables locales (no en git)
├── package.json           # Dependencias
└── README.md             # Este archivo
```

## 🛠️ Configuración Inicial

### 1. Requisitos Previos

- Cuenta de Cloudflare (gratuita)
- Node.js v16 o superior
- npm o yarn

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar wrangler.toml

Copia la plantilla de configuración:

```bash
cp wrangler.toml.example wrangler.toml
```

Si es tu primera vez usando Wrangler, autentícate:

```bash
npx wrangler login
```

### 4. Crear la Base de Datos D1

```bash
npx wrangler d1 create trackme-db
```

Este comando te dará un `database_id`. **Copia este ID y actualízalo en `wrangler.toml`**:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trackme-db"
database_id = "TU-DATABASE-ID-AQUI"  # ← Reemplaza esto
```

### 5. Inicializar la Base de Datos

#### Para Desarrollo Local

```bash
npm run db:init
```

Esto creará las tablas necesarias y agregará 3 síntomas de ejemplo en tu base de datos local.

#### Para Producción

Una vez que hayas desplegado el worker, inicializa la base de datos remota:

```bash
npm run db:init:remote
```

Este comando ejecutará el schema en la base de datos D1 de Cloudflare en producción.

#### Migraciones para Bases de Datos Existentes

**Las migraciones se ejecutan automáticamente en producción** cuando haces push a `main`. El sistema:
- Detecta migraciones pendientes
- Las ejecuta en orden
- Registra cuáles han sido aplicadas

Para desarrollo local, aplica migraciones manualmente:

```bash
# Ver todas las migraciones disponibles
ls migrations/

# Aplicar una migración específica en local
npx wrangler d1 execute trackme-db --local --file=./migrations/XXX_migration_name.sql
```

Ejemplo con la migración actual:
```bash
npx wrangler d1 execute trackme-db --local --file=./migrations/001_add_medication_taken.sql
```

⚠️ **Importante**: 
- Las migraciones en **producción son automáticas** (se ejecutan durante el deployment)
- Para **desarrollo local**, debes ejecutarlas manualmente
- Las migraciones son para bases de datos existentes. Si es una instalación nueva, usa `npm run db:init` (local) o `npm run db:init:remote` (producción)

Consulta `migrations/README.md` para más detalles sobre cómo funcionan las migraciones.

### 6. Configurar Credenciales de Admin

#### Para Desarrollo Local

Crea un archivo `.dev.vars` en la raíz del proyecto:

```bash
TRACKME_USER=tu-usuario
TRACKME_PASSWORD=tu-password-seguro
```

⚠️ **IMPORTANTE**: El archivo `.dev.vars` NO se sube a git.

#### Para Producción

Configura los secretos en Cloudflare usando Wrangler:

```bash
wrangler secret put TRACKME_USER
# Ingresa tu usuario cuando se solicite

wrangler secret put TRACKME_PASSWORD
# Ingresa tu password cuando se solicite
```

## 🏃 Desarrollo Local

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:8787`

## 🚢 Desplegar a Producción

### 1. Desplegar el Worker

```bash
npm run deploy
```

Wrangler te mostrará la URL donde tu aplicación está desplegada (ej: `https://trackme.tu-usuario.workers.dev`)

### 2. Inicializar la Base de Datos en Producción

Después del primer despliegue, inicializa la base de datos remota:

```bash
npm run db:init:remote
```

### 3. Configurar Secretos (si no lo hiciste antes)

```bash
wrangler secret put TRACKME_USER
wrangler secret put TRACKME_PASSWORD
```

¡Listo! Tu aplicación está en producción.

## 📖 Uso de la Aplicación

### Acceso Principal

1. Abre la URL de tu aplicación (redirige a `/login` si no estás autenticado)
2. Ingresa tus credenciales (las que configuraste en `.dev.vars` o secretos)
3. Verás los botones de síntomas disponibles
4. Haz clic en un síntoma para abrir el modal de notas
5. Opcionalmente, agrega notas adicionales
6. El registro se guarda con la fecha y hora actual
7. El historial se actualiza automáticamente sin recargar la página (HTMX)

### Panel de Administración

1. Desde la página principal, haz clic en "Panel Admin"
2. Agrega nuevos tipos de síntomas
3. Elimina síntomas existentes (también elimina sus registros)
4. Vuelve a la página principal

## 🗄️ Estructura de la Base de Datos

### Tabla `symptom_types`
- `id`: INTEGER PRIMARY KEY
- `name`: TEXT (nombre del síntoma)
- `created_at`: DATETIME

### Tabla `symptom_logs`
- `id`: INTEGER PRIMARY KEY
- `type_id`: INTEGER (referencia a symptom_types)
- `notes`: TEXT (opcional)
- `date`: DATE (fecha del registro)
- `timestamp`: DATETIME (hora exacta)

## 🔐 Seguridad

- **Autenticación mejorada**: Autenticación basada en cookies HTTP-only seguras
- **Token seguro**: Tokens con expiración de 7 días
- **HTTPS**: Cloudflare Workers siempre usa HTTPS
- **Variables sensibles**: Nunca incluir credenciales en `wrangler.toml`
- **Archivos no incluidos en git**: `wrangler.toml`, `.dev.vars`
- **Archivos incluidos en git**: `wrangler.toml.example` (plantilla sin secretos)
- **Mejores prácticas**: Usa credenciales fuertes y diferentes para desarrollo y producción
- **Headers de seguridad**: CSP, X-Frame-Options, HSTS, etc.
- **Validación de entrada**: Sanitización y validación de todos los inputs

## 🔧 Comandos Disponibles

### Desarrollo y Despliegue
```bash
npm run dev            # Desarrollo local
npm run build          # Compilar client components
npm run build:client   # Compilar solo client components
npm run deploy         # Desplegar a producción
```

### Testing
```bash
npm test          # Ejecutar tests en modo watch
npm run test:ci   # Ejecutar tests una vez (para CI/CD)
```

### Base de Datos
```bash
# Inicializar schema (solo para bases de datos nuevas)
npm run db:init          # Inicializar DB local (desarrollo)
npm run db:init:remote   # Inicializar DB remota (producción)

# Migraciones (para bases de datos existentes)
# Ver migrations/README.md para más detalles y lista completa
npx wrangler d1 execute trackme-db --local --file=./migrations/XXX_migration_name.sql   # Migración local
npx wrangler d1 execute trackme-db --remote --file=./migrations/XXX_migration_name.sql  # Migración producción

# Ejecutar consultas SQL
npm run db:query "SELECT * FROM symptoms"         # Consulta local
npm run db:query:remote "SELECT * FROM symptoms"  # Consulta en producción
```

### Comandos Wrangler Directos
```bash
wrangler d1 execute trackme-db --local --command="..."    # Consulta local
wrangler d1 execute trackme-db --remote --command="..."   # Consulta remota
wrangler tail                                             # Ver logs en producción
wrangler secret list                                      # Listar secretos
```

## 📊 Endpoints de la API

### Públicos
- `GET /login` - Página de login
- `POST /api/login` - Autenticación (devuelve cookie segura)

### Protegidos (requieren autenticación)
- `GET /` - Página principal
- `GET /admin` - Panel de administración
- `POST /api/logout` - Cerrar sesión
- `GET /api/symptom-buttons` - Obtener botones de síntomas (HTMX partial)
- `GET /api/history-items` - Obtener historial (HTMX partial)
- `POST /api/log-symptom` - Registrar síntoma
- `GET /api/admin/symptom-list` - Lista de síntomas en admin (HTMX partial)
- `POST /api/admin/add-symptom` - Agregar tipo de síntoma
- `DELETE /api/admin/symptom/:id` - Eliminar tipo de síntoma

## 💡 Personalización

### Cambiar el Período del Historial

En `src/index.js`, busca la constante `CONFIG.HISTORY_DAYS` al inicio del archivo y cambia el valor:

```javascript
const CONFIG = {
  TOKEN_EXPIRY_DAYS: 7,
  HISTORY_DAYS: 14,  // Cambia este valor
  MAX_NOTE_LENGTH: 1000,
  MAX_SYMPTOM_NAME_LENGTH: 100,
};
```

### Cambiar Estilos

Los estilos CSS están definidos en la constante `CSS_STYLES` dentro de `src/index.js`. Modifica las variables CSS en `:root` o los estilos según tus preferencias.

### Agregar Más Funcionalidades

La aplicación usa Hono para el routing. Puedes agregar nuevas rutas usando:

```javascript
app.get('/tu-ruta', authMiddleware, async (c) => {
  // Tu código aquí
});
```

## 🐛 Troubleshooting

### Error: "Database not found"
- Verifica que hayas creado la base de datos con `npx wrangler d1 create trackme-db`
- Asegúrate de haber actualizado el `database_id` en `wrangler.toml`

### Error: "Unauthorized"
- **Desarrollo**: Verifica que `.dev.vars` existe y tiene TRACKME_USER y TRACKME_PASSWORD configurados
- **Producción**: Ejecuta `wrangler secret list` para ver los secretos configurados
- Borra las cookies del navegador y vuelve a hacer login

### Error: "wrangler.toml not found"
- Copia la plantilla: `cp wrangler.toml.example wrangler.toml`
- Actualiza el `database_id` con tu valor

### Los cambios no se reflejan en desarrollo
- Detén el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`

## 🧪 Testing y Calidad de Código

### Ejecutar Tests

```bash
# Modo watch (desarrollo)
npm test

# Una vez (CI/CD)
npm run test:ci
```

### Cobertura de Tests

Los tests incluyen:
- ✅ Renderizado de páginas públicas (login)
- ✅ Validación de autenticación
- ✅ Protección contra inyección XSS
- ✅ Manejo de errores

### CI/CD con GitHub Actions

El proyecto incluye dos workflows automáticos:

1. **Test Workflow** (`.github/workflows/test.yml`)
   - Se ejecuta en cada push y pull request
   - Valida que todos los tests pasen antes de merge

2. **Deploy Workflow** (`.github/workflows/deploy.yml`)
   - Se ejecuta automáticamente en push a `main`
   - Despliega a Cloudflare Workers
   - Requiere configurar secrets: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`

### Configurar Secrets en GitHub

Para el despliegue automático, configura estos secrets en tu repositorio:

1. Ve a Settings → Secrets and variables → Actions
2. Agrega los siguientes secrets:
   - `CLOUDFLARE_API_TOKEN`: Tu token de API de Cloudflare
   - `CLOUDFLARE_ACCOUNT_ID`: Tu ID de cuenta de Cloudflare

## 🎨 Mejoras de Developer Experience

Este proyecto sigue las mejores prácticas de Hono y Cloudflare Workers:

### 1. HTML Helper de Hono
- Usa `html` y `raw` template literals para construir HTML
- Componentes funcionales reutilizables (ej: `Layout`)
- Escaping automático de HTML para prevenir XSS

```javascript
import { html, raw } from 'hono/html';

const Layout = ({ title, children }) => html`
<!DOCTYPE html>
<html>
  <head><title>${title}</title></head>
  <body>${raw(children)}</body>
</html>
`;
```

### 2. Bindings y Variables de Entorno
- Acceso tipado a variables de entorno mediante `c.env`
- Uso de bindings para D1, KV, R2, etc.
- Configuración centralizada en `wrangler.toml`

```javascript
// Acceso a variables de entorno
const username = c.env.TRACKME_USER;
const db = c.env.DB;
```

### 3. Static Assets
- Soporte para archivos estáticos desde el directorio `public/`
- Configurado en `wrangler.toml` con el binding `ASSETS`
- Ideal para CSS, JavaScript, imágenes, etc.

### 4. Testing con Vitest
- Suite de tests usando `@cloudflare/vitest-pool-workers`
- Pruebas en un entorno aislado similar a producción
- Integración con GitHub Actions para CI/CD

### 5. Middleware Modular
- Middleware de seguridad para headers HTTP
- Middleware de autenticación reutilizable
- Inicialización automática de base de datos

### 6. Client Components (hono/jsx/dom)
- Componentes del lado del cliente usando sintaxis React-like
- Bundle extremadamente pequeño: **8.69 KB gzipped** (vs 47.8 KB de React)
- Soporte para hooks: `useState`, `useEffect`, `useRef`, etc.
- Modal interactivo y manejo de eventos con client components
- Build automático antes de deployment

```jsx
// src/client/index.jsx
import { useState, useEffect } from 'hono/jsx'
import { render } from 'hono/jsx/dom'

function SymptomModal() {
  const [isOpen, setIsOpen] = useState(false)
  // ... React-like component logic
  return <div className="modal">{/* JSX */}</div>
}

render(<SymptomModal />, document.getElementById('modal-root'))
```

**Características del cliente:**
- ⚡ Ultraligero: solo 26KB sin comprimir, 8.69 KB con gzip
- 🎯 API compatible con React hooks
- 🔥 Rendimiento superior a React para casos de uso simples
- 🛠️ Integración perfecta con HTMX

### Los cambios no se reflejan en desarrollo
- Detén el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`

## 📝 Licencia

MIT

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

---

**Migrado a Hono + D1 + HTMX** para mejor rendimiento y arquitectura moderna 🚀

Hecho con ❤️ usando Cloudflare Workers
