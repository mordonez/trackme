/**
 * TrackMe - Minimalist Symptom Tracker
 * Cloudflare Workers + D1
 *
 * Architecture:
 * - Modular structure for maintainability
 * - Security-first approach (DevSecOps)
 * - Input validation and sanitization
 * - Rate limiting awareness
 * - Secure headers (CSP, HSTS, etc.)
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  TOKEN_EXPIRY_DAYS: 7,
  HISTORY_DAYS: 14,
  MAX_NOTE_LENGTH: 1000,
  MAX_SYMPTOM_NAME_LENGTH: 100,
};

// ============================================================================
// SECURITY: HTTP HEADERS
// ============================================================================

function getSecurityHeaders() {
  return {
    // CORS
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',

    // Security Headers (DevSecOps best practices)
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'unsafe-inline' 'self'",
      "style-src 'unsafe-inline' 'self' https://cdn.jsdelivr.net",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; '),

    // HSTS (if using HTTPS - Cloudflare does this)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  };
}

// ============================================================================
// SECURITY: INPUT VALIDATION & SANITIZATION
// ============================================================================

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and trim
  let sanitized = input.replace(/\0/g, '').trim();

  // Limit length
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

  // Check for SQL injection patterns (defense in depth)
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/i;
  if (sqlPatterns.test(sanitized)) {
    throw new ValidationError('Invalid characters in symptom name');
  }

  return sanitized;
}

function validateNotes(notes) {
  if (!notes) {
    return null;
  }

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
// SECURITY: AUTHENTICATION & TOKEN MANAGEMENT
// ============================================================================

function generateSecureToken(username, password) {
  // Add entropy with timestamp and random component
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const payload = `${username}:${password}:${timestamp}:${random}`;

  return btoa(payload);
}

function validateToken(token, validUser, validPassword) {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Check token length (prevent excessively long tokens)
    if (token.length > 500) {
      return false;
    }

    const decoded = atob(token);
    const parts = decoded.split(':');

    if (parts.length < 3) {
      return false;
    }

    const [username, password, timestamp] = parts;

    // Check credentials
    if (username !== validUser || password !== validPassword) {
      return false;
    }

    // Check token age
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

function checkAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  return validateToken(token, env.TRACKME_USER, env.TRACKME_PASSWORD);
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function initDatabase(db) {
  try {
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

    // Create indices for better performance
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
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function htmlResponse(html, headers = {}) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...headers
    }
  });
}

// ============================================================================
// CLIENT-SIDE TEMPLATES: CSS
// ============================================================================

const CSS_STYLES = `
/* ============================================================================
   TRACKME - Estilos personalizados sobre Pico CSS
   Diseño único y moderno, aprovechando Pico como base
   ============================================================================ */

:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-focus: rgba(99, 102, 241, 0.125);
  --primary-inverse: #fff;
}

/* Header con gradiente */
.app-header {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 2rem 1rem;
  margin: calc(var(--block-spacing-vertical) * -1) calc(var(--block-spacing-horizontal) * -1) var(--block-spacing-vertical);
  border-radius: 0 0 1.5rem 1.5rem;
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.2);
}

.app-header h1 {
  margin-bottom: 0.25rem;
}

.app-header p {
  opacity: 0.95;
  margin: 0;
}

/* Botones de síntomas con gradiente */
.symptom-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin: var(--block-spacing-vertical) 0;
}

@media (min-width: 576px) {
  .symptom-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.symptom-btn {
  background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
  border: none;
  min-height: 70px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  transition: all 0.2s ease;
}

.symptom-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.symptom-btn:active {
  transform: scale(0.98);
}

/* Navegación superior compacta */
.top-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.top-nav button {
  flex: 1;
  min-width: fit-content;
}

/* Items del historial con borde de color */
.history-item {
  border-left: 4px solid var(--primary);
  transition: transform 0.2s ease;
}

.history-item:hover {
  transform: translateX(4px);
}

.history-date {
  color: var(--primary);
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-type {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.history-notes {
  color: var(--muted-color);
  font-size: 0.9rem;
  font-style: italic;
  margin-top: 0.5rem;
}

.history-time {
  color: var(--muted-color);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

/* Admin symptom list */
.symptom-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.symptom-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--card-background-color);
  border-radius: var(--border-radius);
  gap: 1rem;
}

.symptom-name {
  font-weight: 600;
  flex: 1;
}

.symptom-date {
  font-size: 0.85rem;
  color: var(--muted-color);
  display: block;
  margin-top: 0.25rem;
}

.symptom-item button {
  flex-shrink: 0;
}

/* Modal con backdrop blur */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.modal.show {
  display: flex;
}

.modal-content {
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Alertas con animación */
[role="alert"] {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Loading indicator */
.loading {
  text-align: center;
  padding: 2rem;
  color: var(--muted-color);
}

/* Utility */
.hidden {
  display: none !important;
}
`;

// ============================================================================
// CLIENT-SIDE TEMPLATES: JAVASCRIPT (Main App)
// ============================================================================

const JS_MAIN_APP = `
const API_BASE = '';
let token = localStorage.getItem('token');
let currentSymptomId = null;

// Security: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check auth on load
window.onload = () => {
  if (token) {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    loadSymptoms();
    loadHistory();
  }
};

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  // Client-side validation
  if (!username || !password) {
    showError('loginError', 'Por favor ingresa usuario y contraseña');
    return;
  }

  if (username.length > 100 || password.length > 100) {
    showError('loginError', 'Credenciales demasiado largas');
    return;
  }

  try {
    const response = await fetch(API_BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      document.getElementById('loginError').classList.add('hidden');
      loadSymptoms();
      loadHistory();
    } else {
      showError('loginError', escapeHtml(data.error || 'Credenciales inválidas'));
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('loginError', 'Error de conexión');
  }
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function goToAdmin() {
  window.location.href = '/admin';
}

async function loadSymptoms() {
  try {
    const response = await fetch(API_BASE + '/api/symptom-types', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();
    const container = document.getElementById('symptomButtons');

    if (!data.types || data.types.length === 0) {
      container.innerHTML = '<p>No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>';
      return;
    }

    container.innerHTML = data.types.map(type =>
      '<button class="symptom-btn" onclick="openModal(' + type.id + ', \\'' + escapeHtml(type.name).replace(/'/g, "\\\\'") + '\\')">' + escapeHtml(type.name) + '</button>'
    ).join('');
  } catch (error) {
    console.error('Load symptoms error:', error);
    document.getElementById('symptomButtons').innerHTML = '<p role="alert">Error al cargar síntomas</p>';
  }
}

async function loadHistory() {
  try {
    const response = await fetch(API_BASE + '/api/history', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();
    const container = document.getElementById('history');

    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = '<p style="color: #999;">No hay registros aún</p>';
      return;
    }

    container.innerHTML = data.logs.map(log =>
      '<div class="history-item">' +
        '<div class="history-date">' + formatDate(log.date) + '</div>' +
        '<div class="history-type">' + escapeHtml(log.symptom_name) + '</div>' +
        (log.notes ? '<div class="history-notes">' + escapeHtml(log.notes) + '</div>' : '') +
        '<div class="history-time">' + formatDateTime(log.timestamp) + '</div>' +
      '</div>'
    ).join('');
  } catch (error) {
    console.error('Load history error:', error);
    document.getElementById('history').innerHTML = '<p class="error">Error al cargar historial</p>';
  }
}

function openModal(symptomId, symptomName) {
  currentSymptomId = symptomId;
  document.getElementById('modalTitle').textContent = symptomName;
  document.getElementById('notesInput').value = '';
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
  currentSymptomId = null;
}

async function saveSymptom() {
  const notes = document.getElementById('notesInput').value.trim();

  // Client-side validation
  if (notes.length > 1000) {
    showMessage('Las notas son demasiado largas (máximo 1000 caracteres)', 'error');
    return;
  }

  try {
    const response = await fetch(API_BASE + '/api/log-symptom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        type_id: currentSymptomId,
        notes: notes || null
      })
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();

    if (response.ok) {
      showMessage('Registrado correctamente ✓', 'success');
      closeModal();
      loadHistory();
    } else {
      showMessage(escapeHtml(data.error || 'Error al guardar'), 'error');
    }
  } catch (error) {
    console.error('Save symptom error:', error);
    showMessage('Error de conexión', 'error');
  }
}

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function showError(elementId, text) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.classList.remove('hidden');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Enter key to login
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !document.getElementById('loginForm').classList.contains('hidden')) {
    login();
  }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('modal').classList.contains('hidden')) {
    closeModal();
  }
});
`;

// ============================================================================
// CLIENT-SIDE TEMPLATES: JAVASCRIPT (Admin Panel)
// ============================================================================

const JS_ADMIN_PANEL = `
const API_BASE = '';
let token = localStorage.getItem('token');

// Security: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check auth
if (!token) {
  window.location.href = '/';
}

window.onload = () => {
  loadSymptoms();
};

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/';
}

function goToHome() {
  window.location.href = '/';
}

async function loadSymptoms() {
  try {
    const response = await fetch(API_BASE + '/api/symptom-types', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();
    const container = document.getElementById('symptomList');

    if (!data.types || data.types.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem;">No hay síntomas configurados</p>';
      return;
    }

    container.innerHTML = data.types.map(type =>
      '<div class="symptom-item">' +
        '<div>' +
          '<div class="symptom-name">' + escapeHtml(type.name) + '</div>' +
          '<div class="symptom-date">Creado: ' + formatDate(type.created_at) + '</div>' +
        '</div>' +
        '<button class="outline contrast" role="button" onclick="deleteSymptom(' + type.id + ', \\'' + escapeHtml(type.name).replace(/'/g, "\\\\'") + '\\')">🗑️ Eliminar</button>' +
      '</div>'
    ).join('');
  } catch (error) {
    console.error('Load symptoms error:', error);
    document.getElementById('symptomList').innerHTML = '<p role="alert">Error al cargar síntomas</p>';
  }
}

async function addSymptom(event) {
  event.preventDefault();

  const name = document.getElementById('symptomName').value.trim();

  // Client-side validation
  if (!name) {
    showMessage('El nombre del síntoma es requerido', 'error');
    return;
  }

  if (name.length > 100) {
    showMessage('El nombre es demasiado largo (máximo 100 caracteres)', 'error');
    return;
  }

  try {
    const response = await fetch(API_BASE + '/api/admin/add-symptom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name })
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();

    if (response.ok) {
      showMessage('Síntoma agregado correctamente ✓', 'success');
      document.getElementById('symptomName').value = '';
      loadSymptoms();
    } else {
      showMessage(escapeHtml(data.error || 'Error al agregar síntoma'), 'error');
    }
  } catch (error) {
    console.error('Add symptom error:', error);
    showMessage('Error de conexión', 'error');
  }
}

async function deleteSymptom(id, name) {
  if (!confirm('¿Estás seguro de eliminar "' + name + '"? Esto también eliminará todos los registros asociados.')) {
    return;
  }

  try {
    const response = await fetch(API_BASE + '/api/admin/symptom/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const data = await response.json();

    if (response.ok) {
      showMessage('Síntoma eliminado correctamente ✓', 'success');
      loadSymptoms();
    } else {
      showMessage(escapeHtml(data.error || 'Error al eliminar síntoma'), 'error');
    }
  } catch (error) {
    console.error('Delete symptom error:', error);
    showMessage('Error de conexión', 'error');
  }
}

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
`;

// ============================================================================
// HTML TEMPLATES
// ============================================================================

function generateIndexHTML() {
  return `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="TrackMe - Aplicación minimalista para seguimiento de síntomas">
    <title>TrackMe - Seguimiento de Síntomas</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
    <style>${CSS_STYLES}</style>
</head>
<body>
    <!-- Login Form -->
    <main id="loginForm" class="container">
        <article>
            <header class="app-header">
                <h1>🔐 TrackMe</h1>
                <p>Inicia sesión para continuar</p>
            </header>
            <div id="loginError" role="alert" class="hidden"></div>
            <form onsubmit="event.preventDefault(); login();">
                <label>
                    Usuario
                    <input type="text" id="username" name="username" placeholder="Tu usuario" autocomplete="username" maxlength="100" required>
                </label>
                <label>
                    Contraseña
                    <input type="password" id="password" name="password" placeholder="Tu contraseña" autocomplete="current-password" maxlength="100" required>
                </label>
                <button type="submit">Entrar</button>
            </form>
        </article>
    </main>

    <!-- Main App -->
    <main id="mainApp" class="container hidden">
        <div class="app-header">
            <h1>📊 TrackMe</h1>
            <p>Registra tus síntomas de forma simple y rápida</p>
        </div>

        <nav class="top-nav">
            <button class="outline secondary" onclick="goToAdmin()" role="button">⚙️ Admin</button>
            <button class="outline contrast" onclick="logout()" role="button">Salir</button>
        </nav>

        <div id="message" role="alert" class="hidden"></div>

        <section>
            <h2>📝 Registrar Evento</h2>
            <div id="symptomButtons" class="symptom-grid">
                <div class="loading" aria-live="polite">Cargando...</div>
            </div>
        </section>

        <section>
            <h2>📅 Historial (14 días)</h2>
            <div id="history">
                <div class="loading" aria-live="polite">Cargando...</div>
            </div>
        </section>
    </main>

    <!-- Modal for notes -->
    <div id="modal" class="modal" role="dialog" aria-labelledby="modalTitle" aria-modal="true" onclick="if(event.target===this) closeModal()">
        <article class="modal-content">
            <header>
                <h3 id="modalTitle">Agregar Notas</h3>
            </header>
            <label>
                Notas (opcional)
                <textarea id="notesInput" name="notes" placeholder="Escribe aquí cualquier detalle adicional..." maxlength="1000" rows="4"></textarea>
            </label>
            <footer>
                <div class="grid">
                    <button onclick="saveSymptom()" role="button">Guardar</button>
                    <button class="secondary" onclick="closeModal()" role="button">Cancelar</button>
                </div>
            </footer>
        </article>
    </div>

    <script>${JS_MAIN_APP}</script>
</body>
</html>`;
}

function generateAdminHTML() {
  return `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Panel de administración - TrackMe">
    <title>Admin Panel - TrackMe</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
    <style>${CSS_STYLES}</style>
</head>
<body>
    <main class="container">
        <div class="app-header">
            <h1>⚙️ Panel Admin</h1>
            <p>Gestiona los síntomas</p>
        </div>

        <nav class="top-nav">
            <button class="outline" onclick="goToHome()" role="button">← Volver</button>
            <button class="outline contrast" onclick="logout()" role="button">Salir</button>
        </nav>

        <div id="message" role="alert" class="hidden"></div>

        <section>
            <h2>➕ Nuevo Síntoma</h2>
            <form id="addForm" onsubmit="addSymptom(event)">
                <input type="text" id="symptomName" name="symptomName" placeholder="Ej: Dolor de cabeza" required maxlength="100">
                <button type="submit" role="button">Agregar</button>
            </form>
        </section>

        <section>
            <h2>📋 Lista de Síntomas</h2>
            <div id="symptomList" class="symptom-list">
                <div class="loading" aria-live="polite">Cargando...</div>
            </div>
        </section>
    </main>

    <script>${JS_ADMIN_PANEL}</script>
</body>
</html>`;
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleLogin(request, env, securityHeaders) {
  try {
    const body = await request.json();
    const { username, password } = validateCredentials(body.username, body.password);

    if (username === env.TRACKME_USER && password === env.TRACKME_PASSWORD) {
      const token = generateSecureToken(username, password);
      return jsonResponse({ success: true, token }, securityHeaders);
    }

    // Add small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100));

    return jsonResponse({ error: 'Credenciales inválidas' }, securityHeaders, 401);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Login error:', error);
    return jsonResponse({ error: 'Error en el servidor' }, securityHeaders, 500);
  }
}

async function handleGetSymptomTypes(env, securityHeaders) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, created_at FROM symptom_types ORDER BY name ASC'
    ).all();

    return jsonResponse({ types: results || [] }, securityHeaders);
  } catch (error) {
    console.error('Get symptom types error:', error);
    return jsonResponse({ error: 'Error al obtener síntomas' }, securityHeaders, 500);
  }
}

async function handleLogSymptom(request, env, securityHeaders) {
  try {
    const body = await request.json();

    // Validate input
    const type_id = validateId(body.type_id);
    const notes = validateNotes(body.notes);
    const today = new Date().toISOString().split('T')[0];

    // Insert log
    await env.DB.prepare(
      'INSERT INTO symptom_logs (type_id, notes, date) VALUES (?, ?, ?)'
    ).bind(type_id, notes, today).run();

    return jsonResponse({ success: true }, securityHeaders);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Log symptom error:', error);
    return jsonResponse({ error: 'Error al guardar el registro' }, securityHeaders, 500);
  }
}

async function handleGetHistory(env, securityHeaders) {
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - CONFIG.HISTORY_DAYS);
    const dateLimit = daysAgo.toISOString().split('T')[0];

    const { results } = await env.DB.prepare(`
      SELECT
        sl.id,
        sl.type_id,
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

    return jsonResponse({ logs: results || [] }, securityHeaders);
  } catch (error) {
    console.error('Get history error:', error);
    return jsonResponse({ error: 'Error al obtener historial' }, securityHeaders, 500);
  }
}

async function handleAddSymptom(request, env, securityHeaders) {
  try {
    const body = await request.json();
    const name = validateSymptomName(body.name);

    // Check for duplicates
    const existing = await env.DB.prepare(
      'SELECT id FROM symptom_types WHERE LOWER(name) = LOWER(?)'
    ).bind(name).first();

    if (existing) {
      return jsonResponse({ error: 'Este síntoma ya existe' }, securityHeaders, 400);
    }

    await env.DB.prepare(
      'INSERT INTO symptom_types (name) VALUES (?)'
    ).bind(name).run();

    return jsonResponse({ success: true }, securityHeaders);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Add symptom error:', error);
    return jsonResponse({ error: 'Error al agregar síntoma' }, securityHeaders, 500);
  }
}

async function handleDeleteSymptom(request, env, securityHeaders, symptomId) {
  try {
    const id = validateId(symptomId);

    // Check if symptom exists
    const symptom = await env.DB.prepare(
      'SELECT id FROM symptom_types WHERE id = ?'
    ).bind(id).first();

    if (!symptom) {
      return jsonResponse({ error: 'Síntoma no encontrado' }, securityHeaders, 404);
    }

    // Delete symptom (logs will be cascade deleted)
    await env.DB.prepare(
      'DELETE FROM symptom_types WHERE id = ?'
    ).bind(id).run();

    return jsonResponse({ success: true }, securityHeaders);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Delete symptom error:', error);
    return jsonResponse({ error: 'Error al eliminar síntoma' }, securityHeaders, 500);
  }
}

// ============================================================================
// MAIN WORKER HANDLER
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const securityHeaders = getSecurityHeaders();

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: securityHeaders });
    }

    try {
      // Initialize database
      await initDatabase(env.DB);

      // ===== SERVE HTML PAGES =====
      if (path === '/' || path === '/index.html') {
        return htmlResponse(generateIndexHTML(), securityHeaders);
      }

      if (path === '/admin' || path === '/admin.html') {
        return htmlResponse(generateAdminHTML(), securityHeaders);
      }

      // ===== PUBLIC API ROUTES =====
      if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env, securityHeaders);
      }

      // ===== PROTECTED API ROUTES =====
      // All routes below require authentication
      if (!checkAuth(request, env)) {
        return jsonResponse({ error: 'No autorizado' }, securityHeaders, 401);
      }

      // Get symptom types
      if (path === '/api/symptom-types' && request.method === 'GET') {
        return handleGetSymptomTypes(env, securityHeaders);
      }

      // Log symptom
      if (path === '/api/log-symptom' && request.method === 'POST') {
        return handleLogSymptom(request, env, securityHeaders);
      }

      // Get history
      if (path === '/api/history' && request.method === 'GET') {
        return handleGetHistory(env, securityHeaders);
      }

      // Add symptom (admin)
      if (path === '/api/admin/add-symptom' && request.method === 'POST') {
        return handleAddSymptom(request, env, securityHeaders);
      }

      // Delete symptom (admin)
      if (path.startsWith('/api/admin/symptom/') && request.method === 'DELETE') {
        const symptomId = path.split('/').pop();
        return handleDeleteSymptom(request, env, securityHeaders, symptomId);
      }

      // 404 - Route not found
      return jsonResponse({ error: 'Ruta no encontrada' }, securityHeaders, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        { error: 'Error interno del servidor' },
        securityHeaders,
        500
      );
    }
  }
};
