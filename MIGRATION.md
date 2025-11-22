# Migración a Hono + D1 + HTMX

Este documento detalla la migración del proyecto TrackMe desde una implementación vanilla de Cloudflare Workers a una arquitectura moderna usando Hono, D1 y HTMX.

## Cambios Principales

### 1. Framework Backend: Hono

**Antes (Vanilla Workers):**
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/') {
      return htmlResponse(generateIndexHTML());
    }
    // Manual routing...
  }
}
```

**Después (Hono):**
```javascript
import { Hono } from 'hono';

const app = new Hono();

app.get('/', authMiddleware, async (c) => {
  return c.html(/* template */);
});

export default app;
```

**Beneficios:**
- Routing declarativo y type-safe
- Middleware reutilizable
- Mejor organización del código
- Context object con helpers (cookies, headers, etc.)

### 2. Autenticación: Cookies HTTP-only

**Antes:**
- Tokens en localStorage del cliente
- Header `Authorization: Bearer token`
- Vulnerable a XSS

**Después:**
- Cookies HTTP-only con flags de seguridad
- Cookies con `Secure`, `SameSite=Strict`, `HttpOnly`
- Protección contra XSS y CSRF

**Configuración de Cookie:**
```javascript
setCookie(c, 'auth_token', token, {
  maxAge: CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/'
});
```

### 3. Frontend: HTMX

**Antes:**
- JavaScript vanilla con fetch()
- Manipulación manual del DOM
- Event listeners para cada acción
- ~500 líneas de JS por página

**Después:**
- HTMX con atributos declarativos
- Actualizaciones parciales del DOM
- Sin necesidad de JavaScript personalizado
- HTML más semántico

**Ejemplo de Actualización Dinámica:**
```html
<!-- Antes: fetch + DOM manipulation -->
<button onclick="loadHistory()">Recargar</button>
<div id="history"></div>
<script>
  async function loadHistory() {
    const response = await fetch('/api/history');
    const data = await response.json();
    document.getElementById('history').innerHTML = renderHistory(data);
  }
</script>

<!-- Después: HTMX -->
<div hx-get="/api/history-items" 
     hx-trigger="load, reload-history from:body"
     hx-swap="innerHTML">
  <div class="loading">Cargando...</div>
</div>
```

### 4. Integración D1 con Hono

**Antes:**
```javascript
async function handleGetHistory(env, securityHeaders) {
  const { results } = await env.DB.prepare(query).all();
  return jsonResponse({ logs: results }, securityHeaders);
}
```

**Después:**
```javascript
app.get('/api/history-items', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(query).all();
  return c.html(/* rendered HTML */);
});
```

**Beneficios:**
- Acceso a DB a través del contexto de Hono
- Middleware para inicialización de DB
- Respuestas directas en HTML (no JSON)

### 5. Middlewares

**Middleware de Seguridad:**
```javascript
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  // más headers...
});
```

**Middleware de Autenticación:**
```javascript
const authMiddleware = async (c, next) => {
  const token = getCookie(c, 'auth_token');
  if (!token || !validateToken(token, c.env.TRACKME_USER, c.env.TRACKME_PASSWORD)) {
    return c.redirect('/login');
  }
  await next();
};
```

## Endpoints API

### Cambios en los Endpoints

| Antes | Después | Método |
|-------|---------|--------|
| `GET /` (retorna todo HTML con JS) | `GET /` (SSR con HTMX) | Página principal |
| `GET /admin` (retorna todo HTML con JS) | `GET /admin` (SSR con HTMX) | Admin panel |
| N/A | `GET /login` | Página de login |
| `POST /api/login` (retorna JSON) | `POST /api/login` (retorna HTML) | Login |
| N/A | `POST /api/logout` | Logout |
| `GET /api/symptom-types` (JSON) | `GET /api/symptom-buttons` (HTML) | Lista de síntomas |
| `GET /api/history` (JSON) | `GET /api/history-items` (HTML) | Historial |
| `POST /api/log-symptom` (JSON) | `POST /api/log-symptom` (HTML) | Registrar síntoma |
| `GET /api/symptom-types` (JSON) | `GET /api/admin/symptom-list` (HTML) | Admin: lista |
| `POST /api/admin/add-symptom` (JSON) | `POST /api/admin/add-symptom` (HTML) | Admin: agregar |
| `DELETE /api/admin/symptom/:id` (JSON) | `DELETE /api/admin/symptom/:id` (HTML) | Admin: eliminar |

**Nota:** Los endpoints ahora retornan fragmentos HTML en lugar de JSON, aprovechando HTMX para actualizaciones parciales.

## Variables de Entorno

**Cambio importante:**
- `USER` → `TRACKME_USER`
- `PASSWORD` → `TRACKME_PASSWORD`

**Archivo .dev.vars:**
```bash
# Antes
USER=admin
PASSWORD=secret

# Después
TRACKME_USER=admin
TRACKME_PASSWORD=secret
```

**Producción:**
```bash
# Antes
wrangler secret put USER
wrangler secret put PASSWORD

# Después
wrangler secret put TRACKME_USER
wrangler secret put TRACKME_PASSWORD
```

## Reducción de Código

| Componente | Antes | Después | Reducción |
|------------|-------|---------|-----------|
| src/index.js | 1410 líneas | 900 líneas | ~36% |
| JavaScript cliente | ~500 líneas/página | ~50 líneas/página | ~90% |
| Código total | ~2400 líneas | ~1000 líneas | ~58% |

## Mejoras de Seguridad

1. **Cookies HTTP-only** - No accesibles desde JavaScript
2. **SameSite=Strict** - Protección contra CSRF
3. **Secure flag** - Solo HTTPS
4. **Headers de seguridad** - CSP, X-Frame-Options, etc.
5. **Server-side validation** - Toda la lógica en el servidor
6. **Reducción de superficie de ataque** - Menos JavaScript en el cliente

## Performance

- **Menor tamaño de página inicial** - Sin grandes archivos JS
- **Actualizaciones más rápidas** - Solo HTML parcial, no JSON + rendering
- **Progressive enhancement** - Funciona sin JavaScript (parcialmente)
- **Mejor caching** - HTML estático más fácil de cachear

## Compatibilidad

- **Navegadores modernos** - HTMX requiere soporte básico de fetch
- **Sin dependencias pesadas** - HTMX es ~14KB minificado
- **Fallback graceful** - Formularios funcionan sin HTMX

## Testing

Todos los endpoints han sido probados:
- ✅ Login con cookies
- ✅ Logout y limpieza de cookies
- ✅ Acceso autenticado a páginas
- ✅ Redirección si no autenticado
- ✅ CRUD de síntomas
- ✅ Registro de síntomas con notas
- ✅ Visualización de historial

## Próximos Pasos Recomendados

1. **Testing automatizado** - Agregar tests E2E con Playwright
2. **Optimización CSS** - Considerar usar Tailwind o similar
3. **Caché inteligente** - Implementar estrategias de caché para D1
4. **Rate limiting** - Añadir límites de peticiones por IP
5. **Métricas** - Implementar logging y analytics

## Referencias

- [Documentación de Hono](https://hono.dev/)
- [Documentación de HTMX](https://htmx.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
