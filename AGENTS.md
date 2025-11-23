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

## Antipatrones a Evitar

- ❌ Usar `useState`/`useEffect` para modals simples
- ❌ Manejar estado complejo en el cliente
- ❌ Crear SPAs cuando HTMX es suficiente
- ❌ Mezclar JSX del cliente con JSX del servidor
- ❌ Validar solo en el cliente

## Ejemplos de Cambios Comunes

### Agregar un nuevo campo al formulario:
1. Actualizar schema en `lib/schemas.ts`
2. Actualizar query en `routes/api.tsx`
3. El modal se actualiza automáticamente (server-side)

### Agregar una nueva página:
1. Crear componente en `components/Pages.tsx`
2. Agregar ruta en `index.tsx`
3. Usar `Layout` con HTMX triggers necesarios

### Modificar estilos:
- Todo está en `lib/styles.ts` (CSS-in-JS)
- Usar variables CSS para consistencia
- Mobile-first con media queries

## Debugging

- Ver logs: `wrangler tail`
- Console del navegador: eventos HTMX (`htmx:*`)
- DB local: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`

## Referencias

- [HTMX Docs](https://htmx.org/docs/)
- [Hono Docs](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
