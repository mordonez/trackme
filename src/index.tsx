/** @jsxImportSource hono/jsx */

import { Hono } from 'hono'
import type { Bindings } from './lib/types'
import { authMiddleware, securityHeaders, initDatabase } from './lib/middleware'
import { HomePage, AdminPage } from './components/Pages'
import auth from './routes/auth'
import api from './routes/api'

const app = new Hono<{ Bindings: Bindings }>()

// Global middleware
app.use('*', securityHeaders)
app.use('*', initDatabase)

// Mount routes
app.route('/', auth)
app.route('/api', api)

// Pages
app.get('/', authMiddleware, (c) => c.html(<HomePage />))
app.get('/admin', authMiddleware, (c) => c.html(<AdminPage />))

export default app
