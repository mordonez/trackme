/** @jsxImportSource hono/jsx */

import { Hono } from 'hono'
import type { Bindings } from './lib/types'
import { CONFIG } from './lib/types'
import { authMiddleware, securityHeaders, initDatabase } from './lib/middleware'
import { validateSymptomName, validateNotes, validateId, ValidationError } from './lib/validation'
import { Layout, TopNav } from './components/Layout'
import auth from './routes/auth'

const app = new Hono<{ Bindings: Bindings }>()

// Global middleware
app.use('*', securityHeaders)
app.use('*', initDatabase)

// Mount auth routes
app.route('/', auth)

// Main app page
app.get('/', authMiddleware, (c) => {
  return c.html(
    <Layout title="TrackMe" includeModal>
      <div class="container">
        <div class="header-section">
          <h1>🩺 TrackMe</h1>
          <p class="text-muted">Registra tus síntomas</p>
        </div>

        <TopNav>
          <a href="/admin" class="btn outline">⚙️ Admin</a>
          <form hx-post="/api/logout" hx-swap="none" style="display: inline; flex: 1;">
            <button type="submit" class="outline secondary w-full">Salir</button>
          </form>
        </TopNav>

        <div id="message"></div>

        <div>
          <h2>Registrar Síntoma</h2>
          <div id="symptom-buttons" 
               class="symptom-grid" 
               hx-get="/api/symptom-buttons" 
               hx-trigger="load"
               hx-swap="innerHTML">
            <div class="loading">Cargando...</div>
          </div>
        </div>

        <div>
          <h2>Historial (14 días)</h2>
          <div id="history" 
               hx-get="/api/history-items" 
               hx-trigger="load, reload-history from:body"
               hx-swap="innerHTML">
            <div class="loading">Cargando...</div>
          </div>
        </div>
      </div>
    </Layout>
  )
})

// Admin page
app.get('/admin', authMiddleware, (c) => {
  return c.html(
    <Layout title="Admin - TrackMe" includeAdmin>
      <div class="container">
        <div class="header-section">
          <h1>⚙️ Panel Admin</h1>
          <p class="text-muted">Gestiona los síntomas</p>
        </div>

        <TopNav>
          <a href="/" class="btn outline">← Volver</a>
          <form hx-post="/api/logout" hx-swap="none" style="display: inline; flex: 1;">
            <button type="submit" class="outline secondary w-full">Salir</button>
          </form>
        </TopNav>

        <div id="message"></div>

        <div class="card">
          <h2>Agregar Síntoma</h2>
          <form hx-post="/api/admin/add-symptom" hx-target="#message" hx-swap="innerHTML">
            <div class="form-group">
              <input type="text" name="name" placeholder="Ej: Dolor de cabeza" required maxLength={100} />
            </div>
            <button type="submit">Agregar</button>
          </form>
        </div>

        <div>
          <h2>Lista de Síntomas</h2>
          <div id="symptom-list" 
               class="symptom-list"
               hx-get="/api/admin/symptom-list" 
               hx-trigger="load, reload-list from:body"
               hx-swap="innerHTML">
            <div class="loading">Cargando...</div>
          </div>
        </div>
      </div>
    </Layout>
  )
})

// API: Get symptom buttons
app.get('/api/symptom-buttons', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name FROM symptom_types ORDER BY name ASC'
  ).all()

  if (!results?.length) {
    return c.html(<p style="color: #999;">No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>)
  }

  return c.html(
    <>
      {results.map((type: any) => (
        <button class="symptom-btn" 
                data-symptom-id={type.id} 
                data-symptom-name={type.name}
                onclick={`openModal(this.dataset.symptomId, this.dataset.symptomName)`}>
          {type.name}
        </button>
      ))}
    </>
  )
})

// API: Get history items
app.get('/api/history-items', authMiddleware, async (c) => {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - CONFIG.HISTORY_DAYS)
  const dateLimit = daysAgo.toISOString().split('T')[0]

  const { results } = await c.env.DB.prepare(`
    SELECT sl.id, sl.notes, sl.date, sl.timestamp, st.name as symptom_name
    FROM symptom_logs sl
    JOIN symptom_types st ON sl.type_id = st.id
    WHERE sl.date >= ?
    ORDER BY sl.timestamp DESC
    LIMIT 100
  `).bind(dateLimit).all()

  if (!results?.length) {
    return c.html(<p style="color: #999;">No hay registros aún</p>)
  }

  return c.html(
    <>
      {results.map((log: any) => {
        const date = new Date(log.date)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        let dateStr
        if (date.toDateString() === today.toDateString()) {
          dateStr = 'Hoy'
        } else if (date.toDateString() === yesterday.toDateString()) {
          dateStr = 'Ayer'
        } else {
          dateStr = date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }

        const time = new Date(log.timestamp).toLocaleString('es-ES', {
          hour: '2-digit',
          minute: '2-digit'
        })

        return (
          <div class="history-item">
            <div class="history-date">{dateStr}</div>
            <div class="history-type">{log.symptom_name}</div>
            {log.notes && <div class="history-notes">{log.notes}</div>}
            <div class="history-time">{time}</div>
          </div>
        )
      })}
    </>
  )
})

// API: Log symptom
app.post('/api/log-symptom', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const type_id = validateId(body.type_id)
    const notes = validateNotes(body.notes)
    const today = new Date().toISOString().split('T')[0]

    await c.env.DB.prepare(
      'INSERT INTO symptom_logs (type_id, notes, date) VALUES (?, ?, ?)'
    ).bind(type_id, notes, today).run()

    return c.html(<div class="success">Registrado correctamente ✓</div>)
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(<div class="error">{error.message}</div>, 400)
    }
    console.error('Log symptom error:', error)
    return c.html(<div class="error">Error al guardar el registro</div>, 500)
  }
})

// API: Get symptom list (admin)
app.get('/api/admin/symptom-list', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM symptom_types ORDER BY name ASC'
  ).all()

  if (!results?.length) {
    return c.html(<p style="color: #999; text-align: center; padding: 20px;">No hay síntomas configurados</p>)
  }

  return c.html(
    <>
      {results.map((type: any) => {
        const date = new Date(type.created_at).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

        return (
          <div class="symptom-item">
            <div>
              <div class="symptom-name">{type.name}</div>
              <div class="symptom-date">Creado: {date}</div>
            </div>
            <button class="outline danger" 
                    hx-delete={`/api/admin/symptom/${type.id}`}
                    hx-confirm={`¿Estás seguro de eliminar '${type.name}'? Esto también eliminará todos los registros asociados.`}
                    hx-target="#message"
                    hx-swap="innerHTML">
              🗑️ Eliminar
            </button>
          </div>
        )
      })}
    </>
  )
})

// API: Add symptom (admin)
app.post('/api/admin/add-symptom', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const name = validateSymptomName(body.name)

    const existing = await c.env.DB.prepare(
      'SELECT id FROM symptom_types WHERE LOWER(name) = LOWER(?)'
    ).bind(name).first()

    if (existing) {
      return c.html(<div class="error">Este síntoma ya existe</div>, 400)
    }

    await c.env.DB.prepare('INSERT INTO symptom_types (name) VALUES (?)').bind(name).run()

    return c.html(<div class="success">Síntoma agregado correctamente ✓</div>)
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(<div class="error">{error.message}</div>, 400)
    }
    console.error('Add symptom error:', error)
    return c.html(<div class="error">Error al agregar síntoma</div>, 500)
  }
})

// API: Delete symptom (admin)
app.delete('/api/admin/symptom/:id', authMiddleware, async (c) => {
  try {
    const id = validateId(c.req.param('id'))

    const symptom = await c.env.DB.prepare('SELECT id FROM symptom_types WHERE id = ?').bind(id).first()

    if (!symptom) {
      return c.html(<div class="error">Síntoma no encontrado</div>, 404)
    }

    await c.env.DB.prepare('DELETE FROM symptom_types WHERE id = ?').bind(id).run()

    return c.html(<div class="success">Síntoma eliminado correctamente ✓</div>)
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(<div class="error">{error.message}</div>, 400)
    }
    console.error('Delete symptom error:', error)
    return c.html(<div class="error">Error al eliminar síntoma</div>, 500)
  }
})

export default app
