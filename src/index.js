/**
 * TrackMe - Minimalist Symptom Tracker
 * Hono + Cloudflare D1 + HTMX
 */

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { html, raw } from 'hono/html';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  TOKEN_EXPIRY_DAYS: 7,
  HISTORY_DAYS: 14,
  MAX_NOTE_LENGTH: 1000,
  MAX_SYMPTOM_NAME_LENGTH: 100,
};

// ============================================================================
// SECURITY: INPUT VALIDATION
// ============================================================================

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  let sanitized = input.replace(/\0/g, '').trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

function validateCredentials(username, password) {
  if (!username || !password) {
    throw new ValidationError('Username and password are required');
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new ValidationError('Invalid credentials format');
  }
  if (username.length > 100 || password.length > 100) {
    throw new ValidationError('Credentials too long');
  }
  return {
    username: sanitizeString(username, 100),
    password: sanitizeString(password, 100)
  };
}

function validateSymptomName(name) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Symptom name is required');
  }
  const sanitized = sanitizeString(name, CONFIG.MAX_SYMPTOM_NAME_LENGTH);
  if (sanitized.length === 0) {
    throw new ValidationError('Symptom name cannot be empty');
  }
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/i;
  if (sqlPatterns.test(sanitized)) {
    throw new ValidationError('Invalid characters in symptom name');
  }
  return sanitized;
}

function validateNotes(notes) {
  if (!notes) return null;
  if (typeof notes !== 'string') {
    throw new ValidationError('Notes must be a string');
  }
  return sanitizeString(notes, CONFIG.MAX_NOTE_LENGTH);
}

function validateId(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId < 1) {
    throw new ValidationError('Invalid ID');
  }
  return numId;
}

// ============================================================================
// SECURITY: AUTHENTICATION
// ============================================================================

function generateSecureToken(username, password) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const payload = `${username}:${password}:${timestamp}:${random}`;
  return btoa(payload);
}

function validateToken(token, validUser, validPassword) {
  try {
    if (!token || typeof token !== 'string' || token.length > 500) {
      return false;
    }
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length < 3) return false;
    
    const [username, password, timestamp] = parts;
    if (username !== validUser || password !== validPassword) {
      return false;
    }
    
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > maxAge) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// ============================================================================
// HTML HELPER
// ============================================================================

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '\\': '&#92;'
  };
  return String(text).replace(/[&<>"'\\]/g, m => map[m]);
}

// ============================================================================
// STYLES
// ============================================================================

const CSS_STYLES = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-bg: #f5f7fa;
  --color-surface: #ffffff;
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-text: #1e293b;
  --color-text-light: #64748b;
  --color-border: #e2e8f0;
  --color-success: #10b981;
  --color-error: #ef4444;
  --radius: 8px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  font-size: 16px;
}

.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
  color: var(--color-text);
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  margin-bottom: 1rem;
}

button, .btn {
  display: inline-block;
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  text-align: center;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  background: var(--color-primary);
  color: white;
}

button:hover, .btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

button:active, .btn:active {
  transform: translateY(0);
}

button.secondary {
  background: var(--color-text-light);
}

button.secondary:hover {
  background: var(--color-text);
}

button.outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

button.outline:hover {
  background: var(--color-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

button.danger {
  background: var(--color-error);
}

button.danger:hover {
  background: #dc2626;
}

button.outline.danger {
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

button.outline.danger:hover {
  background: var(--color-error);
  color: white;
}

input, textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  transition: all 0.15s ease;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.form-group {
  margin-bottom: 1rem;
}

.symptom-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin: 1rem 0;
}

@media (min-width: 480px) {
  .symptom-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.symptom-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: var(--radius);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.symptom-btn:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.symptom-btn:active {
  transform: translateY(0);
}

.top-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.top-nav button, .top-nav .btn {
  flex: 1;
  min-width: 120px;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
}

.history-item {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1rem;
  margin-bottom: 0.75rem;
  box-shadow: var(--shadow-sm);
  border-left: 3px solid var(--color-primary);
}

.history-date {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.history-type {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.history-notes {
  color: var(--color-text-light);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.history-time {
  color: var(--color-text-light);
  font-size: 0.8125rem;
  margin-top: 0.5rem;
}

.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal.show {
  display: flex;
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal h3 {
  margin-bottom: 1rem;
  font-size: 1.125rem;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.symptom-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.symptom-item {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.symptom-name {
  font-weight: 600;
  flex: 1;
}

.symptom-date {
  font-size: 0.8125rem;
  color: var(--color-text-light);
  margin-top: 0.25rem;
}

.symptom-item button {
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
}

.error, .success {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  margin-bottom: 1rem;
  font-size: 0.9375rem;
}

.error {
  background: #fef2f2;
  color: var(--color-error);
  border-left: 3px solid var(--color-error);
}

.success {
  background: #f0fdf4;
  color: var(--color-success);
  border-left: 3px solid var(--color-success);
}

.hidden {
  display: none !important;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-light);
}

.text-muted {
  color: var(--color-text-light);
}

.w-full {
  width: 100%;
}

.header-section {
  margin: 1rem 0 1.5rem;
}

.subtitle {
  margin-bottom: 1.5rem;
}
`;

// ============================================================================
// HTML COMPONENTS USING HONO HTML HELPER
// ============================================================================

// Base layout component
const Layout = ({ title, children, includeModal = false, includeAdmin = false }) => html`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${raw(CSS_STYLES)}</style>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
</head>
<body>
    ${raw(children)}
    ${includeModal ? raw(`
    <!-- Modal root for Hono client component -->
    <div id="modal-root"></div>
    `) : ''}
    ${includeAdmin ? raw(`
    <!-- Admin handler root for Hono client component -->
    <div id="admin-root"></div>
    `) : ''}
    ${(includeModal || includeAdmin) ? raw(`
    <!-- Hono Client Components (React-like but only 8.69 KB gzipped!) -->
    <script type="module" src="/js/client.mjs"></script>
    `) : ''}
</body>
</html>
`;

// ============================================================================
// HONO APP WITH BINDINGS
// ============================================================================

/**
 * Following Hono Best Practices:
 * 
 * 1. ✅ No Rails-like Controllers: Handlers are defined inline after routes
 *    for proper type inference of path parameters and context
 * 
 * 2. ✅ Direct handler definitions: Using (c) => {} pattern allows Hono
 *    to infer types from c.req.param(), c.env, etc.
 * 
 * 3. ✅ HTML Helper: Using html`` and raw() for safe HTML rendering
 *    with automatic escaping
 * 
 * 4. ✅ Bindings: Access environment variables via c.env (DB, TRACKME_USER, etc.)
 * 
 * For larger apps, consider splitting routes using app.route():
 * 
 * Example:
 *   // routes/admin.js
 *   const admin = new Hono()
 *     .get('/', (c) => c.json('admin home'))
 *     .post('/users', (c) => c.json('create user'))
 *   
 *   // index.js
 *   app.route('/admin', admin)
 */
const app = new Hono();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '));
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
});

// Database initialization middleware
// Note: CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS are idempotent
// SQLite handles this efficiently, so the performance impact is minimal
app.use('*', async (c, next) => {
  const db = c.env.DB;
  try {
    // These operations are idempotent and very fast if tables already exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS symptom_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS symptom_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_id INTEGER NOT NULL,
        notes TEXT,
        date DATE NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES symptom_types(id) ON DELETE CASCADE
      )
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_symptom_logs_date
      ON symptom_logs(date DESC)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_symptom_logs_type_id
      ON symptom_logs(type_id)
    `).run();
  } catch (error) {
    console.error('Database initialization error:', error);
  }
  await next();
});

// Auth middleware for protected routes
const authMiddleware = async (c, next) => {
  const token = getCookie(c, 'auth_token');
  if (!token || !validateToken(token, c.env.TRACKME_USER, c.env.TRACKME_PASSWORD)) {
    return c.redirect('/login');
  }
  await next();
};

// ============================================================================
// ROUTES: PUBLIC PAGES
// ============================================================================

// Login page
app.get('/login', (c) => {
  return c.html(
    Layout({
      title: 'Login - TrackMe',
      children: `
        <div class="container">
            <div class="card" style="max-width: 400px; margin: 3rem auto;">
                <h1>🩺 TrackMe</h1>
                <p class="text-muted subtitle">Seguimiento simple de síntomas</p>
                <div id="login-message"></div>
                <form hx-post="/api/login" hx-target="#login-message" hx-swap="innerHTML">
                    <div class="form-group">
                        <label>Usuario</label>
                        <input type="text" name="username" placeholder="Tu usuario" autocomplete="username" maxlength="100" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" name="password" placeholder="Tu contraseña" autocomplete="current-password" maxlength="100" required>
                    </div>
                    <button type="submit" class="w-full">Entrar</button>
                </form>
            </div>
        </div>
      `
    })
  );
});

// Main app page (protected)
app.get('/', authMiddleware, async (c) => {
  return c.html(
    Layout({
      title: 'TrackMe',
      includeModal: true,
      children: `
        <div class="container">
            <div class="header-section">
                <h1>🩺 TrackMe</h1>
                <p class="text-muted">Registra tus síntomas</p>
            </div>

            <div class="top-nav">
                <a href="/admin" class="btn outline">⚙️ Admin</a>
                <form hx-post="/api/logout" hx-swap="none" style="display: inline; flex: 1;">
                    <button type="submit" class="outline secondary w-full">Salir</button>
                </form>
            </div>

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
      `
    })
  );
});

// Admin page (protected)
app.get('/admin', authMiddleware, (c) => {
  return c.html(
    Layout({
      title: 'Admin - TrackMe',
      includeAdmin: true,
      children: `
        <div class="container">
            <div class="header-section">
                <h1>⚙️ Panel Admin</h1>
                <p class="text-muted">Gestiona los síntomas</p>
            </div>

            <div class="top-nav">
                <a href="/" class="btn outline">← Volver</a>
                <form hx-post="/api/logout" hx-swap="none" style="display: inline; flex: 1;">
                    <button type="submit" class="outline secondary w-full">Salir</button>
                </form>
            </div>

            <div id="message"></div>

            <div class="card">
                <h2>Agregar Síntoma</h2>
                <form hx-post="/api/admin/add-symptom" 
                      hx-target="#message" 
                      hx-swap="innerHTML">
                    <div class="form-group">
                        <input type="text" name="name" placeholder="Ej: Dolor de cabeza" required maxlength="100">
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
      `
    })
  );
});

// ============================================================================
// ROUTES: API
// ============================================================================

// Login API
app.post('/api/login', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { username, password } = validateCredentials(body.username, body.password);

    if (username === c.env.TRACKME_USER && password === c.env.TRACKME_PASSWORD) {
      const token = generateSecureToken(username, password);
      setCookie(c, 'auth_token', token, {
        maxAge: CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/'
      });
      
      c.header('HX-Redirect', '/');
      return c.html(html`<div class="success">Login exitoso, redirigiendo...</div>`);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    return c.html(html`<div class="error">Credenciales inválidas</div>`, 401);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(html`<div class="error">${escapeHtml(error.message)}</div>`, 400);
    }
    console.error('Login error:', error);
    return c.html(html`<div class="error">Error en el servidor</div>`, 500);
  }
});

// Logout API
app.post('/api/logout', (c) => {
  deleteCookie(c, 'auth_token');
  c.header('HX-Redirect', '/login');
  return c.text('', 200);
});

// Get symptom buttons (HTMX partial)
app.get('/api/symptom-buttons', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name FROM symptom_types ORDER BY name ASC'
    ).all();

    if (!results || results.length === 0) {
      return c.html(html`<p style="color: #999;">No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>`);
    }

    const buttons = results.map(type => html`
      <button class="symptom-btn" 
              data-symptom-id="${type.id}" 
              data-symptom-name="${escapeHtml(type.name)}"
              onclick="openModal(this.dataset.symptomId, this.dataset.symptomName)">
        ${escapeHtml(type.name)}
      </button>
    `).join('');

    return c.html(raw(buttons));
  } catch (error) {
    console.error('Get symptom buttons error:', error);
    return c.html(html`<p class="error">Error al cargar síntomas</p>`, 500);
  }
});

// Get history items (HTMX partial)
app.get('/api/history-items', authMiddleware, async (c) => {
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - CONFIG.HISTORY_DAYS);
    const dateLimit = daysAgo.toISOString().split('T')[0];

    const { results } = await c.env.DB.prepare(`
      SELECT
        sl.id,
        sl.notes,
        sl.date,
        sl.timestamp,
        st.name as symptom_name
      FROM symptom_logs sl
      JOIN symptom_types st ON sl.type_id = st.id
      WHERE sl.date >= ?
      ORDER BY sl.timestamp DESC
      LIMIT 100
    `).bind(dateLimit).all();

    if (!results || results.length === 0) {
      return c.html(html`<p style="color: #999;">No hay registros aún</p>`);
    }

    const items = results.map(log => {
      const date = new Date(log.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateStr;
      if (date.toDateString() === today.toDateString()) {
        dateStr = 'Hoy';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateStr = 'Ayer';
      } else {
        dateStr = date.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      const time = new Date(log.timestamp).toLocaleString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="history-item">
          <div class="history-date">${dateStr}</div>
          <div class="history-type">${escapeHtml(log.symptom_name)}</div>
          ${log.notes ? `<div class="history-notes">${escapeHtml(log.notes)}</div>` : ''}
          <div class="history-time">${time}</div>
        </div>
      `;
    }).join('');

    return c.html(raw(items));
  } catch (error) {
    console.error('Get history items error:', error);
    return c.html(html`<p class="error">Error al cargar historial</p>`, 500);
  }
});

// Log symptom
app.post('/api/log-symptom', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const type_id = validateId(body.type_id);
    const notes = validateNotes(body.notes);
    const today = new Date().toISOString().split('T')[0];

    await c.env.DB.prepare(
      'INSERT INTO symptom_logs (type_id, notes, date) VALUES (?, ?, ?)'
    ).bind(type_id, notes, today).run();

    return c.html(html`<div class="success">Registrado correctamente ✓</div>`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(html`<div class="error">${escapeHtml(error.message)}</div>`, 400);
    }
    console.error('Log symptom error:', error);
    return c.html(html`<div class="error">Error al guardar el registro</div>`, 500);
  }
});

// Admin: Get symptom list (HTMX partial)
app.get('/api/admin/symptom-list', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, created_at FROM symptom_types ORDER BY name ASC'
    ).all();

    if (!results || results.length === 0) {
      return c.html(html`<p style="color: #999; text-align: center; padding: 20px;">No hay síntomas configurados</p>`);
    }

    const items = results.map(type => {
      const date = new Date(type.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `
        <div class="symptom-item">
          <div>
            <div class="symptom-name">${escapeHtml(type.name)}</div>
            <div class="symptom-date">Creado: ${date}</div>
          </div>
          <button class="outline danger" 
                  hx-delete="/api/admin/symptom/${type.id}"
                  hx-confirm="¿Estás seguro de eliminar '${escapeHtml(type.name)}'? Esto también eliminará todos los registros asociados."
                  hx-target="#message"
                  hx-swap="innerHTML">
            🗑️ Eliminar
          </button>
        </div>
      `;
    }).join('');

    return c.html(raw(items));
  } catch (error) {
    console.error('Get symptom list error:', error);
    return c.html(html`<p class="error">Error al cargar síntomas</p>`, 500);
  }
});

// Admin: Add symptom
app.post('/api/admin/add-symptom', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const name = validateSymptomName(body.name);

    const existing = await c.env.DB.prepare(
      'SELECT id FROM symptom_types WHERE LOWER(name) = LOWER(?)'
    ).bind(name).first();

    if (existing) {
      return c.html(html`<div class="error">Este síntoma ya existe</div>`, 400);
    }

    await c.env.DB.prepare(
      'INSERT INTO symptom_types (name) VALUES (?)'
    ).bind(name).run();

    return c.html(html`<div class="success">Síntoma agregado correctamente ✓</div>`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(html`<div class="error">${escapeHtml(error.message)}</div>`, 400);
    }
    console.error('Add symptom error:', error);
    return c.html(html`<div class="error">Error al agregar síntoma</div>`, 500);
  }
});

// Admin: Delete symptom
app.delete('/api/admin/symptom/:id', authMiddleware, async (c) => {
  try {
    const id = validateId(c.req.param('id'));

    const symptom = await c.env.DB.prepare(
      'SELECT id FROM symptom_types WHERE id = ?'
    ).bind(id).first();

    if (!symptom) {
      return c.html(html`<div class="error">Síntoma no encontrado</div>`, 404);
    }

    await c.env.DB.prepare(
      'DELETE FROM symptom_types WHERE id = ?'
    ).bind(id).run();

    return c.html(html`<div class="success">Síntoma eliminado correctamente ✓</div>`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(html`<div class="error">${escapeHtml(error.message)}</div>`, 400);
    }
    console.error('Delete symptom error:', error);
    return c.html(html`<div class="error">Error al eliminar síntoma</div>`, 500);
  }
});

export default app;
