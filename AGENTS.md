# Guía para Agentes LLM - TrackMe

## Arquitectura y Filosofía

Este proyecto usa **HTMX + Hono** con una filosofía minimalista:
- ❌ **NO usar React, useState, useEffect** en el cliente
- ✅ **Usar HTMX** para interactividad
- ✅ **JavaScript vanilla** solo para eventos globales simples
- ✅ **El servidor controla el estado y el HTML**

## Estructura del Proyecto


```
src/
├── index.tsx           # Entry point del servidor Hono
├── client/
│   └── index.jsx       # JavaScript vanilla (NO React)
├── components/
│   ├── Layout.tsx      # Layout base con HTMX
│   └── Pages.tsx       # Páginas renderizadas en servidor
├── routes/
│   ├── api.tsx         # Endpoints API (incluye modals)
│   └── auth.tsx        # Autenticación
└── lib/
    ├── types.ts        # TypeScript types
    ├── schemas.ts      # Zod validation
    └── utils.ts        # Utilidades
```

## Patrones Clave

### 1. Modals con HTMX (NO React)

**❌ MAL (React):**
```jsx
function Modal() {
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => { /* ... */ })
  return <div>...</div>
}
```

**✅ BIEN (HTMX):**
```tsx
// En el servidor (api.tsx)
api.get('/api/symptom-modal/:id', async (c) => {
  return c.html(
    <div class="modal show">
      <form hx-post="/api/log-symptom" hx-target="#message">
        {/* contenido */}
      </form>
    </div>
  )
})

// En el cliente (index.jsx) - solo eventos globales
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelector('.modal')?.remove()
  }
})
```

### 2. Actualización Dinámica

Usa `hx-trigger` para recargar contenido:
```html
<div id="history"
     hx-get="/api/history-items"
     hx-trigger="load, reload-history from:body">
</div>
```

Trigger desde JavaScript:
```js
window.htmx.trigger('#history', 'reload-history')
```

### 3. Formularios

El servidor valida con Zod y devuelve mensajes:
```tsx
api.post('/api/log-symptom', zValidator('form', schema), async (c) => {
  const data = c.req.valid('form')
  // ... guardar en DB ...
  return c.html(<div class="success">✓ Guardado</div>)
})
```

## Stack Técnico

- **Runtime**: Cloudflare Workers (Hono)
- **Base de Datos**: Cloudflare D1 (SQLite)
- **Frontend**: HTMX + CSS vanilla
- **Validación**: Zod
- **Testing**: Vitest
- **Deploy**: Wrangler (Cloudflare)

## Comandos Importantes

```bash
npm run dev          # Servidor local
npm run deploy       # Deploy a Cloudflare
npm run migrations   # Ejecutar migraciones
npm test            # Tests
```

## Reglas de Oro

1. **El servidor renderiza todo el HTML** - No envíes JSON si puedes enviar HTML
2. **HTMX maneja la interactividad** - No uses React para cosas simples
3. **JavaScript vanilla solo para eventos globales** - Escape, clicks en backdrop
4. **Validación en el servidor con Zod** - Nunca confíes en el cliente
5. **Mantén el cliente ligero** - Menos de 100 líneas de JS
6. **Usa el contexto de Hono** - c.env, c.var, c.set() para compartir datos
7. **Middleware primero** - Auth y validación antes de lógica de negocio


## Antipatrones a Evitar

- ❌ Usar `useState`/`useEffect` para modals simples
- ❌ Manejar estado complejo en el cliente
- ❌ Crear SPAs cuando HTMX es suficiente
- ❌ Mezclar JSX del cliente con JSX del servidor
- ❌ Validar solo en el cliente
- ❌ Acceder directamente a process.env (usa c.env)
- ❌ Olvidar bindings en wrangler.toml
- ❌ Queries SQL sin prepared statements

# Buenas Prácticas de Hono

Typing del Contexto
```js
type Env = {
  Bindings: {
    DB: D1Database
    SESSION_SECRET: string
  }
  Variables: {
    user: User | null
  }
}

const app = new Hono<Env>()
```

Manejo de Errores

```js
app.onError((err, c) => {
  console.error(err)
  return c.html(<ErrorPage message="Algo salió mal" />, 500)
})
```

Validación con Zod

```js
const schema = z.object({
  symptom: z.string().min(1),
  severity: z.coerce.number().min(1).max(10)
})

app.post('/api/log', zValidator('form', schema), async (c) => {
  const data = c.req.valid('form') // ✅ Type-safe
  // ...
})
```

# Patrones Avanzados de HTMX

Indicadores de Carga

```html
<button hx-post="/api/save" hx-indicator="#spinner">
  Guardar
</button>
<div id="spinner" class="htmx-indicator">Guardando...</div>
```

Confirmaciones
```html
<button hx-delete="/api/symptom/123"
        hx-confirm="¿Seguro que quieres eliminar?">
  Eliminar
</button>
```
Swap Strategies
* _outerHTML_: Reemplaza el elemento completo
* _innerHTML_: Solo el contenido interno
* _beforeend_: Agrega al final (ideal para listas)
* _afterbegin_: Agrega al inicio

```html
<div hx-get="/api/more-items" hx-swap="beforeend">
  <!-- Items se agregan aquí -->
</div>
```

# Ejemplos de Cambios Comunes

Agregar un nuevo campo al formulario:

1. Actualizar schema en lib/schemas.ts
2. Actualizar query en routes/api.tsx
3. El modal se actualiza automáticamente (server-side)

Agregar una nueva página:

1. Crear componente en components/Pages.tsx
2. Agregar ruta en index.tsx
3. Usar Layout con HTMX triggers necesarios

Modificar estilos:

1. Todo está en lib/styles.ts (CSS-in-JS)
2. Usar variables CSS para consistencia
3. Mobile-first con media queries

Agregar middleware:

```js
const authMiddleware = async (c: Context, next: Next) => {
  const session = getCookie(c, 'session')
  if (!session) return c.redirect('/login')
  c.set('user', await getUserFromSession(session))
  await next()
}

app.use('/dashboard/*', authMiddleware)
```
Ejecutar queries D1:

```js
const results = await c.env.DB.prepare(
  'SELECT * FROM symptoms WHERE user_id = ?'
).bind(userId).all()
```

# Testing

Tests de Endpoints

```js
describe('API Routes', () => {
  it('should log symptom', async () => {
    const res = await app.request('/api/log-symptom', {
      method: 'POST',
      body: new URLSearchParams({ symptom: 'headache' })
    })
    expect(res.status).toBe(200)
  })
})
```

Tests de Validación

```js
it('should reject invalid severity', () => {
  expect(() => schema.parse({ severity: 11 })).toThrow()
})
````

# Debugging

Logs del Servidor

```bash
wrangler tail                    # Logs en tiempo real
wrangler tail --format pretty    # Logs formateados
```

HTMX Debug

```js
// En el navegador
htmx.logAll()  // Ver todos los eventos HTMX
```

Eventos útiles:

* _htmx:beforeRequest_ - Antes de enviar request
* _htmx:afterSwap_ - Después de actualizar DOM
* _htmx:responseError_ - Error en response

Base de Datos Local

```bash
# Abrir DB local con sqlite3
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# Ejecutar query
SELECT * FROM symptoms ORDER BY created_at DESC LIMIT 10;
```

# Performance Tips

1. **Lazy Loading**: Usa hx-trigger="revealed" para cargar contenido visible
2. **Debouncing**: hx-trigger="keyup changed delay:500ms" para búsquedas
3. **Caching**: Headers de cache en responses estáticas
4. **Prepared Statements**: Siempre usa .bind() con D1
5. **Índices DB**: Crea índices para queries frecuentes

```sql
CREATE INDEX idx_symptoms_user_date
ON symptoms(user_id, created_at DESC);
```

## Referencias

- [HTMX Docs](https://htmx.org/docs/)
- [Hono Docs](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Zod Docs](https://zod.dev/)
