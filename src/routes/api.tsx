/** @jsxImportSource hono/jsx */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Bindings,SymptomLogWithName,SymptomType } from '../lib/types'
import { CONFIG } from '../lib/config'
import { authMiddleware } from '../lib/middleware'
import { symptomNameSchema, logSymptomSchema, symptomIdSchema } from '../lib/schemas'
import { formatRelativeDate, formatTime } from '../lib/utils'

const api = new Hono<{ Bindings: Bindings }>()

// Health check endpoint (no auth required)
api.get('/health', async (c) => {
  try {
    // Verificar conexión a la base de datos
    await c.env.DB.prepare('SELECT 1').first()

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'trackme',
      database: 'connected'
    })
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'trackme',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503)
  }
})

// Get symptom buttons
api.get('/symptom-buttons', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name FROM symptom_types ORDER BY name ASC'
  ).all<SymptomType>()

  if (!results?.length) {
    return c.html(<p style="color: #999;">No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>)
  }

  return c.html(
    <>
      {results.map((type) => (
        <button class="symptom-btn"
                hx-get={`/api/symptom-modal/${type.id}?name=${encodeURIComponent(type.name)}`}
                hx-target="body"
                hx-swap="beforeend">
          {type.name}
        </button>
      ))}
    </>
  )
})

// Get symptom modal
api.get('/symptom-modal/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const name = c.req.query('name') || ''

  return c.html(
    <div class="modal show" id="symptom-modal">
      <div class="modal-content">
        <h3>{name}</h3>
        <form
          hx-post="/api/log-symptom"
          hx-target="#message"
          hx-swap="innerHTML"
        >
          <input type="hidden" name="type_id" value={id} />
          <div class="form-group">
            <textarea
              name="notes"
              placeholder="Detalles opcionales..."
              maxlength={1000}
              rows={4}
            />
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" name="medication_taken" value="true" />
              <span>¿Tomé medicación?</span>
            </label>
          </div>
          <div class="modal-actions">
            <button type="submit">Guardar</button>
            <button
              type="button"
              class="secondary"
              onclick="this.closest('.modal').remove()"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})

// Get history items
api.get('/history-items', authMiddleware, async (c) => {
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - CONFIG.HISTORY_DAYS)
  const dateLimit = daysAgo.toISOString().split('T')[0]

  const { results } = await c.env.DB.prepare(`
    SELECT sl.id, sl.notes, sl.medication_taken, sl.date, sl.timestamp, st.name
    FROM symptom_logs sl
    JOIN symptom_types st ON sl.type_id = st.id
    WHERE sl.date >= ?
    ORDER BY sl.timestamp DESC
    LIMIT 100
  `).bind(dateLimit).all<SymptomLogWithName>()

  if (!results?.length) {
    return c.html(<p style="color: #999;">No hay registros aún</p>)
  }

  return c.html(
    <>
      {results.map((log) => (
        <div class="history-item">
          <div class="history-date">{formatRelativeDate(log.date)}</div>
          <div class="history-type">
            {log.name}
            {log.medication_taken === 1 && <span class="medication-badge" title="Medicación tomada">💊</span>}
          </div>
          {log.notes && <div class="history-notes">{log.notes}</div>}
          <div class="history-time">{formatTime(log.timestamp)}</div>
        </div>
      ))}
    </>
  )
})

// Log symptom
api.post('/log-symptom', authMiddleware, zValidator('form', logSymptomSchema), async (c) => {
  const { type_id, notes, medication_taken } = c.req.valid('form')
  const today = new Date().toISOString().split('T')[0]

  await c.env.DB.prepare(
    'INSERT INTO symptom_logs (type_id, notes, medication_taken, date) VALUES (?, ?, ?, ?)'
  ).bind(type_id, notes, medication_taken, today).run()

  return c.html(<div class="success">Registrado correctamente ✓</div>)
})

// Get symptom list (admin)
api.get('/admin/symptom-list', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM symptom_types ORDER BY name ASC'
  ).all<SymptomType>()

  if (!results?.length) {
    return c.html(<p style="color: #999; text-align: center; padding: 20px;">No hay síntomas configurados</p>)
  }

  return c.html(
    <>
      {results.map((type) => {
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

// Add symptom (admin)
api.post('/admin/add-symptom', authMiddleware, zValidator('form', symptomNameSchema), async (c) => {
  const { name } = c.req.valid('form')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM symptom_types WHERE LOWER(name) = LOWER(?)'
  ).bind(name).first()

  if (existing) {
    return c.html(<div class="error">Este síntoma ya existe</div>, 400)
  }

  await c.env.DB.prepare('INSERT INTO symptom_types (name) VALUES (?)').bind(name).run()

  return c.html(<div class="success">Síntoma agregado correctamente ✓</div>)
})

// Delete symptom (admin)
api.delete('/admin/symptom/:id', authMiddleware, zValidator('param', symptomIdSchema), async (c) => {
  const { id } = c.req.valid('param')

  const symptom = await c.env.DB.prepare('SELECT id FROM symptom_types WHERE id = ?').bind(id).first()

  if (!symptom) {
    return c.html(<div class="error">Síntoma no encontrado</div>, 404)
  }

  await c.env.DB.prepare('DELETE FROM symptom_types WHERE id = ?').bind(id).run()

  return c.html(<div class="success">Síntoma eliminado correctamente ✓</div>)
})

export default api
