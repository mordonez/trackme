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
├── wrangler.toml         # Configuración de Cloudflare Workers
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

### 3. Configurar Wrangler

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

### 6. Configurar Credenciales

**⚠️ IMPORTANTE: Las credenciales NO deben estar en el repositorio.**

Para desarrollo local:
```bash
# Copiar plantilla
cp .dev.vars.example .dev.vars

# Editar con tus credenciales
nano .dev.vars
```

Para producción (Cloudflare Secrets):
```bash
npx wrangler secret put USER
npx wrangler secret put PASSWORD
```

**📖 Ver guía completa:** [SECRETS.md](./SECRETS.md)

## 🏃 Desarrollo Local

```bash
# Desarrollo con base de datos local (recomendado)
npm run dev:local

# O con base de datos remota
npm run dev
```

La aplicación estará disponible en: `http://localhost:8787`

**📖 Para un flujo de trabajo completo con Pull Requests, consulta [DEVELOPMENT.md](./DEVELOPMENT.md)**

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

- **Gestión de Credenciales**:
  - ✅ Desarrollo local: `.dev.vars` (nunca se commitea)
  - ✅ Producción: Cloudflare Secrets (encriptados)
  - ❌ NUNCA commitear credenciales en el código
- **Autenticación**: Usuario y contraseña desde secretos
- **Token en localStorage**: Válido por 7 días
- **HTTPS**: Cloudflare Workers siempre usa HTTPS
- **Mejores Prácticas**: Ver guía completa en [SECRETS.md](./SECRETS.md)

## 🔧 Comandos Disponibles

```bash
npm run dev              # Desarrollo con DB remota
npm run dev:local        # Desarrollo con DB local (recomendado)
npm run deploy           # Desplegar a producción
npm run db:init          # Inicializar base de datos
npm run db:create        # Crear nueva base de datos
npm run db:list          # Listar bases de datos
npm run db:query         # Ejecutar consulta SQL
npm run preview:create   # Crear preview manual
npm run preview:delete   # Borrar preview manual
```

**📖 Ver todos los comandos:** [DEVELOPMENT.md](./DEVELOPMENT.md)

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
- Verifica que las credenciales en `wrangler.toml` sean correctas
- Borra el localStorage y vuelve a hacer login

### Los cambios no se reflejan en desarrollo
- Detén el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`

## 📝 Licencia

MIT

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

---

Hecho con ❤️ usando Cloudflare Workers
