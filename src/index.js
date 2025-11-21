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
      "style-src 'unsafe-inline' 'self'",
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
// SECURITY: PASSWORD HASHING
// ============================================================================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

// ============================================================================
// SECURITY: AUTHENTICATION & TOKEN MANAGEMENT
// ============================================================================

function generateSecureToken(userId, username) {
  // Add entropy with timestamp and random component
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const payload = `${userId}:${username}:${timestamp}:${random}`;

  return btoa(payload);
}

function validateToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Check token length (prevent excessively long tokens)
    if (token.length > 500) {
      return null;
    }

    const decoded = atob(token);
    const parts = decoded.split(':');

    if (parts.length < 3) {
      return null;
    }

    const [userId, username, timestamp] = parts;

    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > maxAge) {
      return null;
    }

    return { userId: parseInt(userId, 10), username };
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

async function checkAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const tokenData = validateToken(token);

  if (!tokenData) {
    return null;
  }

  // Verify user still exists in database
  const user = await env.DB.prepare(
    'SELECT id, username FROM users WHERE id = ?'
  ).bind(tokenData.userId).first();

  if (!user) {
    return null;
  }

  return tokenData;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function initDatabase(db) {
  try {
    // Create users table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `).run();

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
        user_id INTEGER NOT NULL,
        type_id INTEGER NOT NULL,
        notes TEXT,
        date DATE NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES symptom_types(id) ON DELETE CASCADE
      )
    `).run();

    // Create indices for better performance
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users(username)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_symptom_logs_user
      ON symptom_logs(user_id)
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  line-height: 1.6;
  padding: 0;
  margin: 0;
}

.container {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 28px;
}

h2 {
  color: #666;
  margin: 30px 0 15px;
  font-size: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 8px;
}

.subtitle {
  color: #888;
  font-size: 14px;
  margin-bottom: 30px;
}

/* Auth Screen - Mobile Optimized */
#authScreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
}

.auth-container {
  background: white;
  border-radius: 24px;
  padding: 32px 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo {
  font-size: 48px;
  margin-bottom: 16px;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.auth-subtitle {
  font-size: 15px;
  color: #666;
  font-weight: 400;
}

.auth-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 4px;
}

.auth-tab {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.auth-tab.active {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  position: relative;
}

.form-field input {
  width: 100%;
  padding: 16px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s;
  background: #fafafa;
}

.form-field input:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.form-field.error input {
  border-color: #ff4444;
}

.field-error {
  color: #ff4444;
  font-size: 13px;
  margin-top: 6px;
  display: none;
  animation: shake 0.3s;
}

.form-field.error .field-error {
  display: block;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.auth-button {
  width: 100%;
  padding: 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  margin-top: 8px;
}

.auth-button:active {
  transform: scale(0.98);
}

.auth-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-message {
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  margin-bottom: 16px;
  display: none;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.auth-message.error {
  background: #ffebee;
  color: #c62828;
  display: block;
}

.auth-message.success {
  background: #e8f5e9;
  color: #2e7d32;
  display: block;
}

/* Main App Container */
#mainApp {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
}

#mainApp .container {
  background: white;
  margin-bottom: 20px;
}

/* Symptom Buttons - Mobile Optimized */
.symptom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 30px;
}

@media (max-width: 480px) {
  .symptom-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.symptom-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 20px 16px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.symptom-btn:active {
  transform: scale(0.95);
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal.show {
  display: flex;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h3 {
  margin-bottom: 15px;
  color: #333;
}

.modal textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 15px;
}

/* Buttons */
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-secondary {
  background: #ddd;
  color: #333;
  margin-left: 10px;
}

.btn-logout {
  background: #f44336;
  color: white;
  float: right;
}

.btn-admin {
  background: #ff9800;
  color: white;
  margin-left: 10px;
}

.btn-back {
  background: #4caf50;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

/* History */
.history-item {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #fafafa;
}

.history-date {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 5px;
}

.history-type {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.history-notes {
  color: #666;
  font-size: 14px;
  margin-top: 8px;
  font-style: italic;
  word-wrap: break-word;
}

.history-time {
  color: #999;
  font-size: 12px;
  margin-top: 5px;
}

/* Admin Panel */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 600;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

.symptom-list {
  display: grid;
  gap: 15px;
  margin-top: 20px;
}

.symptom-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 8px;
}

.symptom-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  word-wrap: break-word;
  max-width: 70%;
}

.symptom-date {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.nav-buttons {
  margin-bottom: 20px;
}

/* Utility Classes */
.loading {
  text-align: center;
  padding: 20px;
  color: #999;
}

.error {
  background: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
  word-wrap: break-word;
}

.success {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.hidden {
  display: none;
}
`;

// ============================================================================
// CLIENT-SIDE TEMPLATES: JAVASCRIPT (Main App)
// ============================================================================

const JS_MAIN_APP = `
const API_BASE = '';
let token = localStorage.getItem('token');
let currentSymptomId = null;
let currentMode = 'login';

// Security: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check auth on load
window.onload = () => {
  if (token) {
    showMainApp();
  }
};

function showMainApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  loadSymptoms();
  loadHistory();
}

function switchAuthMode(mode) {
  currentMode = mode;
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authButton = document.getElementById('authButton');

  if (mode === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    authTitle.textContent = 'Bienvenido';
    authSubtitle.textContent = 'Inicia sesión para continuar';
    authButton.textContent = 'Iniciar Sesión';
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    authTitle.textContent = 'Crear Cuenta';
    authSubtitle.textContent = 'Regístrate en segundos';
    authButton.textContent = 'Registrarse';
  }

  clearAuthErrors();
}

function clearAuthErrors() {
  document.getElementById('authMessage').className = 'auth-message';
  document.querySelectorAll('.form-field').forEach(field => {
    field.classList.remove('error');
  });
}

function validateField(fieldId, value) {
  const field = document.getElementById(fieldId).parentElement;
  const errorEl = field.querySelector('.field-error');

  if (!value || value.trim() === '') {
    field.classList.add('error');
    errorEl.textContent = 'Este campo es requerido';
    return false;
  }

  if (fieldId === 'authUsername' && value.length < 3) {
    field.classList.add('error');
    errorEl.textContent = 'Mínimo 3 caracteres';
    return false;
  }

  if (fieldId === 'authPassword' && value.length < 4) {
    field.classList.add('error');
    errorEl.textContent = 'Mínimo 4 caracteres';
    return false;
  }

  if (value.length > 100) {
    field.classList.add('error');
    errorEl.textContent = 'Máximo 100 caracteres';
    return false;
  }

  field.classList.remove('error');
  return true;
}

async function handleAuth(event) {
  event.preventDefault();

  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;

  // Validate
  const usernameValid = validateField('authUsername', username);
  const passwordValid = validateField('authPassword', password);

  if (!usernameValid || !passwordValid) {
    return;
  }

  const button = document.getElementById('authButton');
  button.disabled = true;
  button.textContent = currentMode === 'login' ? 'Iniciando...' : 'Registrando...';

  try {
    const endpoint = currentMode === 'login' ? '/api/login' : '/api/register';
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      showAuthMessage('¡Éxito! Accediendo...', 'success');
      setTimeout(() => showMainApp(), 500);
    } else {
      showAuthMessage(escapeHtml(data.error || 'Error'), 'error');
      button.disabled = false;
      button.textContent = currentMode === 'login' ? 'Iniciar Sesión' : 'Registrarse';
    }
  } catch (error) {
    console.error('Auth error:', error);
    showAuthMessage('Error de conexión', 'error');
    button.disabled = false;
    button.textContent = currentMode === 'login' ? 'Iniciar Sesión' : 'Registrarse';
  }
}

function showAuthMessage(text, type) {
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.className = 'auth-message ' + type;
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('authUsername').value = '';
  document.getElementById('authPassword').value = '';
  switchAuthMode('login');
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
      container.innerHTML = '<p style="color: #999;">No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>';
      return;
    }

    container.innerHTML = data.types.map(type =>
      '<button class="symptom-btn" onclick="openModal(' + type.id + ', \\'' + escapeHtml(type.name).replace(/'/g, "\\\\'") + '\\')">' + escapeHtml(type.name) + '</button>'
    ).join('');
  } catch (error) {
    console.error('Load symptoms error:', error);
    document.getElementById('symptomButtons').innerHTML = '<p class="error">Error al cargar síntomas</p>';
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
      container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay síntomas configurados</p>';
      return;
    }

    container.innerHTML = data.types.map(type =>
      '<div class="symptom-item">' +
        '<div>' +
          '<div class="symptom-name">' + escapeHtml(type.name) + '</div>' +
          '<div class="symptom-date">Creado: ' + formatDate(type.created_at) + '</div>' +
        '</div>' +
        '<button class="btn btn-danger" onclick="deleteSymptom(' + type.id + ', \\'' + escapeHtml(type.name).replace(/'/g, "\\\\'") + '\\')">🗑️ Eliminar</button>' +
      '</div>'
    ).join('');
  } catch (error) {
    console.error('Load symptoms error:', error);
    document.getElementById('symptomList').innerHTML = '<p class="error">Error al cargar síntomas</p>';
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
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="description" content="TrackMe - Registro rápido de síntomas en móvil">
    <meta name="theme-color" content="#667eea">
    <title>TrackMe - Registro Rápido</title>
    <style>${CSS_STYLES}</style>
</head>
<body>
    <!-- Auth Screen -->
    <div id="authScreen">
        <div class="auth-container">
            <div class="auth-header">
                <div class="auth-logo">📊</div>
                <h1 class="auth-title" id="authTitle">Bienvenido</h1>
                <p class="auth-subtitle" id="authSubtitle">Inicia sesión para continuar</p>
            </div>

            <div class="auth-tabs">
                <button class="auth-tab active" id="loginTab" onclick="switchAuthMode('login')">Entrar</button>
                <button class="auth-tab" id="registerTab" onclick="switchAuthMode('register')">Registrarse</button>
            </div>

            <div id="authMessage" class="auth-message"></div>

            <form class="auth-form" onsubmit="handleAuth(event)">
                <div class="form-field">
                    <input
                        type="text"
                        id="authUsername"
                        placeholder="Usuario"
                        autocomplete="username"
                        maxlength="100"
                        oninput="validateField('authUsername', this.value)"
                        required
                    >
                    <div class="field-error"></div>
                </div>

                <div class="form-field">
                    <input
                        type="password"
                        id="authPassword"
                        placeholder="Contraseña"
                        autocomplete="current-password"
                        maxlength="100"
                        oninput="validateField('authPassword', this.value)"
                        required
                    >
                    <div class="field-error"></div>
                </div>

                <button type="submit" class="auth-button" id="authButton">Iniciar Sesión</button>
            </form>
        </div>
    </div>

    <!-- Main App -->
    <div id="mainApp" class="hidden">
        <div class="container">
            <h1>📊 TrackMe</h1>
            <p class="subtitle">Registra tus síntomas de forma simple y rápida</p>
            <button class="btn btn-logout" onclick="logout()">Cerrar Sesión</button>
            <button class="btn btn-admin" onclick="goToAdmin()">Panel Admin</button>
            <div style="clear: both; margin-bottom: 20px;"></div>

            <div id="message" class="hidden"></div>

            <h2>📝 Registrar Evento</h2>
            <div id="symptomButtons" class="symptom-grid">
                <div class="loading">Cargando síntomas...</div>
            </div>

            <h2>📅 Historial (Últimos 14 días)</h2>
            <div id="history">
                <div class="loading">Cargando historial...</div>
            </div>
        </div>
    </div>

    <!-- Modal for notes -->
    <div id="modal" class="modal" onclick="if(event.target===this) closeModal()">
        <div class="modal-content">
            <h3 id="modalTitle">Agregar Notas</h3>
            <textarea id="notesInput" placeholder="Escribe aquí cualquier detalle adicional (opcional)..." maxlength="1000"></textarea>
            <button class="btn btn-primary" onclick="saveSymptom()">Guardar</button>
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        </div>
    </div>

    <script>${JS_MAIN_APP}</script>
</body>
</html>`;
}

function generateAdminHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Panel de administración - TrackMe">
    <title>Admin Panel - TrackMe</title>
    <style>${CSS_STYLES}</style>
</head>
<body>
    <div class="container">
        <h1>⚙️ Panel de Administración</h1>
        <p class="subtitle">Gestiona los tipos de síntomas a trackear</p>
        <button class="btn btn-logout" onclick="logout()">Cerrar Sesión</button>
        <div style="clear: both;"></div>

        <div class="nav-buttons">
            <button class="btn btn-back" onclick="goToHome()">← Volver al Inicio</button>
        </div>

        <div id="message" class="hidden"></div>

        <h2>➕ Agregar Nuevo Síntoma</h2>
        <form id="addForm" onsubmit="addSymptom(event)">
            <div class="form-group">
                <label for="symptomName">Nombre del síntoma</label>
                <input type="text" id="symptomName" placeholder="Ej: Dolor de cabeza" required maxlength="100">
            </div>
            <button type="submit" class="btn btn-primary">Agregar Síntoma</button>
        </form>

        <h2>📋 Síntomas Existentes</h2>
        <div id="symptomList" class="symptom-list">
            <div class="loading">Cargando síntomas...</div>
        </div>
    </div>

    <script>${JS_ADMIN_PANEL}</script>
</body>
</html>`;
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleRegister(request, env, securityHeaders) {
  try {
    const body = await request.json();
    const { username, password } = validateCredentials(body.username, body.password);

    // Check if username already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)'
    ).bind(username).first();

    if (existing) {
      return jsonResponse({ error: 'El nombre de usuario ya existe' }, securityHeaders, 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await env.DB.prepare(
      'INSERT INTO users (username, password_hash, last_login) VALUES (?, ?, ?)'
    ).bind(username, passwordHash, new Date().toISOString()).run();

    const userId = result.meta.last_row_id;

    // Generate token
    const token = generateSecureToken(userId, username);

    return jsonResponse({ success: true, token }, securityHeaders);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Register error:', error);
    return jsonResponse({ error: 'Error en el servidor' }, securityHeaders, 500);
  }
}

async function handleLogin(request, env, securityHeaders) {
  try {
    const body = await request.json();
    const { username, password } = validateCredentials(body.username, body.password);

    // Find user
    const user = await env.DB.prepare(
      'SELECT id, username, password_hash FROM users WHERE username = ?'
    ).bind(username).first();

    if (!user) {
      // Add small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return jsonResponse({ error: 'Credenciales inválidas' }, securityHeaders, 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      // Add small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return jsonResponse({ error: 'Credenciales inválidas' }, securityHeaders, 401);
    }

    // Update last login
    await env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    // Generate token
    const token = generateSecureToken(user.id, user.username);

    return jsonResponse({ success: true, token }, securityHeaders);
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

async function handleLogSymptom(request, env, securityHeaders, userData) {
  try {
    const body = await request.json();

    // Validate input
    const type_id = validateId(body.type_id);
    const notes = validateNotes(body.notes);
    const today = new Date().toISOString().split('T')[0];

    // Insert log
    await env.DB.prepare(
      'INSERT INTO symptom_logs (user_id, type_id, notes, date) VALUES (?, ?, ?, ?)'
    ).bind(userData.userId, type_id, notes, today).run();

    return jsonResponse({ success: true }, securityHeaders);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.message }, securityHeaders, 400);
    }
    console.error('Log symptom error:', error);
    return jsonResponse({ error: 'Error al guardar el registro' }, securityHeaders, 500);
  }
}

async function handleGetHistory(env, securityHeaders, userData) {
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
      WHERE sl.user_id = ? AND sl.date >= ?
      ORDER BY sl.timestamp DESC
      LIMIT 100
    `).bind(userData.userId, dateLimit).all();

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
      if (path === '/api/register' && request.method === 'POST') {
        return handleRegister(request, env, securityHeaders);
      }

      if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env, securityHeaders);
      }

      // ===== PROTECTED API ROUTES =====
      // All routes below require authentication
      const userData = await checkAuth(request, env);
      if (!userData) {
        return jsonResponse({ error: 'No autorizado' }, securityHeaders, 401);
      }

      // Get symptom types
      if (path === '/api/symptom-types' && request.method === 'GET') {
        return handleGetSymptomTypes(env, securityHeaders);
      }

      // Log symptom
      if (path === '/api/log-symptom' && request.method === 'POST') {
        return handleLogSymptom(request, env, securityHeaders, userData);
      }

      // Get history
      if (path === '/api/history' && request.method === 'GET') {
        return handleGetHistory(env, securityHeaders, userData);
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
