# 📊 TrackMe - Minimalist Symptom Tracker

Una aplicación web minimalista para trackear síntomas o eventos (dolor de cabeza, alergias, etc.) usando **Cloudflare Workers + D1**.

## ✨ Características

- **Ultra-simple**: Interfaz con botones grandes para registrar eventos rápidamente
- **Notas opcionales**: Campo de texto para agregar detalles adicionales
- **Historial**: Visualiza los últimos 14 días de registros
- **Panel Admin**: Gestiona los tipos de síntomas a trackear
- **Autenticación**: Login simple con token en localStorage
- **Serverless**: 100% en Cloudflare Workers (sin servidor tradicional)
- **Base de datos**: SQLite con Cloudflare D1

## 🚀 Stack Tecnológico

- **Backend**: Cloudflare Workers (serverless)
- **Base de datos**: Cloudflare D1 (SQLite)
- **Frontend**: HTML vanilla + CSS inline + JavaScript vanilla
- **Sin frameworks**: Totalmente minimalista

## 📁 Estructura del Proyecto

```
trackme/
├── src/
│   └── index.js          # Worker principal (incluye HTML)
├── schema.sql            # Schema de la base de datos
├── wrangler.toml         # Configuración de Cloudflare Workers (no en git)
├── wrangler.toml.example # Plantilla de configuración
├── .dev.vars             # Variables locales (no en git)
├── package.json          # Dependencias
└── README.md            # Este archivo
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

```bash
npm run db:init
```

Esto creará las tablas necesarias y agregará 3 síntomas de ejemplo.

### 6. Configurar Credenciales de Admin

#### Para Desarrollo Local

Crea un archivo `.dev.vars` en la raíz del proyecto:

```bash
USER=tu-usuario
PASSWORD=tu-password-seguro
```

⚠️ **IMPORTANTE**: El archivo `.dev.vars` NO se sube a git.

#### Para Producción

Configura los secretos en Cloudflare usando Wrangler:

```bash
wrangler secret put USER
# Ingresa tu usuario cuando se solicite

wrangler secret put PASSWORD
# Ingresa tu password cuando se solicite
```

## 🏃 Desarrollo Local

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:8787`

## 🚢 Desplegar a Producción

```bash
npm run deploy
```

Wrangler te mostrará la URL donde tu aplicación está desplegada (ej: `https://trackme.tu-usuario.workers.dev`)

## 📖 Uso de la Aplicación

### Acceso Principal

1. Abre la URL de tu aplicación
2. Ingresa tus credenciales (las que configuraste en `wrangler.toml`)
3. Verás los botones de síntomas disponibles
4. Haz clic en un síntoma para registrarlo
5. Opcionalmente, agrega notas adicionales
6. El registro se guarda con la fecha y hora actual

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

- **Autenticación simple**: Usuario y contraseña mediante Cloudflare Workers secrets
- **Token en localStorage**: Válido por 7 días
- **HTTPS**: Cloudflare Workers siempre usa HTTPS
- **Variables sensibles**: Nunca incluir credenciales en `wrangler.toml`
- **Archivos no incluidos en git**: `wrangler.toml`, `.dev.vars`
- **Archivos incluidos en git**: `wrangler.toml.example` (plantilla sin secretos)
- **Mejores prácticas**: Usa credenciales fuertes y diferentes para desarrollo y producción

## 🔧 Comandos Disponibles

```bash
npm run dev       # Desarrollo local
npm run deploy    # Desplegar a producción
npm run db:init   # Inicializar base de datos
```

## 📊 Endpoints de la API

### Públicos
- `POST /api/login` - Login (devuelve token)

### Protegidos (requieren token)
- `GET /api/symptom-types` - Listar tipos de síntomas
- `POST /api/log-symptom` - Registrar síntoma
- `GET /api/history` - Obtener historial (últimos 14 días)
- `POST /api/admin/add-symptom` - Agregar tipo de síntoma
- `DELETE /api/admin/symptom/:id` - Eliminar tipo de síntoma

## 💡 Personalización

### Cambiar el Período del Historial

En `src/index.js`, busca esta línea y cambia el número:

```javascript
fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14); // Cambia 14 por el número de días deseado
```

### Cambiar Estilos

Los estilos CSS están inline en los archivos HTML dentro de `src/index.js`. Busca las secciones `<style>` y modifica según tus preferencias.

### Agregar Más Funcionalidades

El Worker está estructurado de forma simple. Puedes agregar nuevos endpoints en la función `fetch()` de `src/index.js`.

## 🐛 Troubleshooting

### Error: "Database not found"
- Verifica que hayas creado la base de datos con `npx wrangler d1 create trackme-db`
- Asegúrate de haber actualizado el `database_id` en `wrangler.toml`

### Error: "Unauthorized"
- **Desarrollo**: Verifica que `.dev.vars` existe y tiene USER y PASSWORD configurados
- **Producción**: Ejecuta `wrangler secret list` para ver los secretos configurados
- Borra el localStorage y vuelve a hacer login

### Error: "wrangler.toml not found"
- Copia la plantilla: `cp wrangler.toml.example wrangler.toml`
- Actualiza el `database_id` con tu valor

### Los cambios no se reflejan en desarrollo
- Detén el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`

## 📝 Licencia

MIT

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

---

Hecho con ❤️ usando Cloudflare Workers
