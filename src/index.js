/**
 * TrackMe - Minimalist Symptom Tracker
 * Cloudflare Workers + D1
 */

// HTML files as strings (will be served)
const indexHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TrackMe - Seguimiento de Síntomas</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        h2 { color: #666; margin: 30px 0 15px; font-size: 20px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
        .subtitle { color: #888; font-size: 14px; margin-bottom: 30px; }

        /* Login Form */
        #loginForm { max-width: 400px; margin: 100px auto; }
        #loginForm input { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }

        /* Symptom Buttons */
        .symptom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .symptom-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .symptom-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }
        .symptom-btn:active { transform: translateY(0); }

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
        .modal.show { display: flex; }
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }
        .modal h3 { margin-bottom: 15px; color: #333; }
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
        .btn:hover { opacity: 0.9; }
        .btn-primary { background: #667eea; color: white; }
        .btn-secondary { background: #ddd; color: #333; margin-left: 10px; }
        .btn-logout { background: #f44336; color: white; float: right; }
        .btn-admin { background: #ff9800; color: white; margin-left: 10px; }

        /* History */
        .history-item {
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 8px;
            margin-bottom: 10px;
            background: #fafafa;
        }
        .history-date { color: #667eea; font-weight: 600; margin-bottom: 5px; }
        .history-type { font-size: 16px; font-weight: 600; color: #333; }
        .history-notes { color: #666; font-size: 14px; margin-top: 8px; font-style: italic; }
        .history-time { color: #999; font-size: 12px; margin-top: 5px; }

        .loading { text-align: center; padding: 20px; color: #999; }
        .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
        .success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <!-- Login Form -->
    <div id="loginForm" class="container">
        <h1>🔐 Iniciar Sesión</h1>
        <p class="subtitle">Ingresa tus credenciales para continuar</p>
        <div id="loginError" class="error hidden"></div>
        <input type="text" id="username" placeholder="Usuario" autocomplete="username">
        <input type="password" id="password" placeholder="Contraseña" autocomplete="current-password">
        <button class="btn btn-primary" onclick="login()" style="width: 100%; margin-top: 10px;">Entrar</button>
    </div>

    <!-- Main App -->
    <div id="mainApp" class="container hidden">
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

    <!-- Modal for notes -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <h3 id="modalTitle">Agregar Notas</h3>
            <textarea id="notesInput" placeholder="Escribe aquí cualquier detalle adicional (opcional)..."></textarea>
            <button class="btn btn-primary" onclick="saveSymptom()">Guardar</button>
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        </div>
    </div>

    <script>
        const API_BASE = '';
        let token = localStorage.getItem('token');
        let currentSymptomId = null;

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
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

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
                    loadSymptoms();
                    loadHistory();
                } else {
                    showError('loginError', data.error || 'Credenciales inválidas');
                }
            } catch (error) {
                showError('loginError', 'Error de conexión');
            }
        }

        function logout() {
            localStorage.removeItem('token');
            token = null;
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
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

                if (data.types.length === 0) {
                    container.innerHTML = '<p style="color: #999;">No hay síntomas configurados. Ve al Panel Admin para agregar algunos.</p>';
                    return;
                }

                container.innerHTML = data.types.map(type =>
                    \`<button class="symptom-btn" onclick="openModal(\${type.id}, '\${escapeHtml(type.name)}')">\${escapeHtml(type.name)}</button>\`
                ).join('');
            } catch (error) {
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

                if (data.logs.length === 0) {
                    container.innerHTML = '<p style="color: #999;">No hay registros aún</p>';
                    return;
                }

                container.innerHTML = data.logs.map(log => \`
                    <div class="history-item">
                        <div class="history-date">\${formatDate(log.date)}</div>
                        <div class="history-type">\${escapeHtml(log.symptom_name)}</div>
                        \${log.notes ? \`<div class="history-notes">\${escapeHtml(log.notes)}</div>\` : ''}
                        <div class="history-time">\${formatDateTime(log.timestamp)}</div>
                    </div>
                \`).join('');
            } catch (error) {
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
            const notes = document.getElementById('notesInput').value;

            try {
                const response = await fetch(API_BASE + '/api/log-symptom', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        type_id: currentSymptomId,
                        notes: notes
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
                    showMessage(data.error || 'Error al guardar', 'error');
                }
            } catch (error) {
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

            return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        function formatDateTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Enter key to login
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !document.getElementById('loginForm').classList.contains('hidden')) {
                login();
            }
        });
    </script>
</body>
</html>`;

const adminHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - TrackMe</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
        }
        .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        h2 { color: #666; margin: 30px 0 15px; font-size: 20px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
        .subtitle { color: #888; font-size: 14px; margin-bottom: 30px; }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.9; }
        .btn-primary { background: #667eea; color: white; }
        .btn-danger { background: #f44336; color: white; }
        .btn-back { background: #4caf50; color: white; }
        .btn-logout { background: #f44336; color: white; float: right; }

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
        }
        .symptom-date {
            font-size: 12px;
            color: #999;
            margin-top: 4px;
        }

        .loading { text-align: center; padding: 20px; color: #999; }
        .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
        .success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
        .hidden { display: none; }
        .nav-buttons { margin-bottom: 20px; }
    </style>
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
                <input type="text" id="symptomName" placeholder="Ej: Dolor de cabeza" required>
            </div>
            <button type="submit" class="btn btn-primary">Agregar Síntoma</button>
        </form>

        <h2>📋 Síntomas Existentes</h2>
        <div id="symptomList" class="symptom-list">
            <div class="loading">Cargando síntomas...</div>
        </div>
    </div>

    <script>
        const API_BASE = '';
        let token = localStorage.getItem('token');

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

                if (data.types.length === 0) {
                    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay síntomas configurados</p>';
                    return;
                }

                container.innerHTML = data.types.map(type => \`
                    <div class="symptom-item">
                        <div>
                            <div class="symptom-name">\${escapeHtml(type.name)}</div>
                            <div class="symptom-date">Creado: \${formatDate(type.created_at)}</div>
                        </div>
                        <button class="btn btn-danger" onclick="deleteSymptom(\${type.id}, '\${escapeHtml(type.name)}')">
                            🗑️ Eliminar
                        </button>
                    </div>
                \`).join('');
            } catch (error) {
                document.getElementById('symptomList').innerHTML = '<p class="error">Error al cargar síntomas</p>';
            }
        }

        async function addSymptom(event) {
            event.preventDefault();

            const name = document.getElementById('symptomName').value;

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
                    showMessage(data.error || 'Error al agregar síntoma', 'error');
                }
            } catch (error) {
                showMessage('Error de conexión', 'error');
            }
        }

        async function deleteSymptom(id, name) {
            if (!confirm(\`¿Estás seguro de eliminar "\${name}"? Esto también eliminará todos los registros asociados.\`)) {
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
                    showMessage(data.error || 'Error al eliminar síntoma', 'error');
                }
            } catch (error) {
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
            return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Initialize database tables if needed
    await initDatabase(env.DB);

    // Routes
    try {
      // Serve HTML pages
      if (path === '/' || path === '/index.html') {
        return new Response(indexHTML, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      if (path === '/admin' || path === '/admin.html') {
        return new Response(adminHTML, {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }

      // API: Login
      if (path === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();

        if (username === env.USER && password === env.PASSWORD) {
          // Simple token (base64 encoded credentials + timestamp)
          const token = btoa(\`\${username}:\${password}:\${Date.now()}\`);
          return jsonResponse({ success: true, token }, corsHeaders);
        }

        return jsonResponse({ error: 'Credenciales inválidas' }, corsHeaders, 401);
      }

      // Check auth for protected routes
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({ error: 'No autorizado' }, corsHeaders, 401);
      }

      const token = authHeader.substring(7);
      if (!validateToken(token, env.USER, env.PASSWORD)) {
        return jsonResponse({ error: 'Token inválido' }, corsHeaders, 401);
      }

      // API: Get symptom types
      if (path === '/api/symptom-types' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM symptom_types ORDER BY name ASC'
        ).all();

        return jsonResponse({ types: results }, corsHeaders);
      }

      // API: Log symptom
      if (path === '/api/log-symptom' && request.method === 'POST') {
        const { type_id, notes } = await request.json();
        const today = new Date().toISOString().split('T')[0];

        await env.DB.prepare(
          'INSERT INTO symptom_logs (type_id, notes, date) VALUES (?, ?, ?)'
        ).bind(type_id, notes || null, today).run();

        return jsonResponse({ success: true }, corsHeaders);
      }

      // API: Get history (last 14 days)
      if (path === '/api/history' && request.method === 'GET') {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const dateLimit = fourteenDaysAgo.toISOString().split('T')[0];

        const { results } = await env.DB.prepare(\`
          SELECT sl.*, st.name as symptom_name
          FROM symptom_logs sl
          JOIN symptom_types st ON sl.type_id = st.id
          WHERE sl.date >= ?
          ORDER BY sl.timestamp DESC
        \`).bind(dateLimit).all();

        return jsonResponse({ logs: results }, corsHeaders);
      }

      // API: Add symptom type (admin)
      if (path === '/api/admin/add-symptom' && request.method === 'POST') {
        const { name } = await request.json();

        if (!name || name.trim().length === 0) {
          return jsonResponse({ error: 'Nombre requerido' }, corsHeaders, 400);
        }

        await env.DB.prepare(
          'INSERT INTO symptom_types (name) VALUES (?)'
        ).bind(name.trim()).run();

        return jsonResponse({ success: true }, corsHeaders);
      }

      // API: Delete symptom type (admin)
      if (path.startsWith('/api/admin/symptom/') && request.method === 'DELETE') {
        const id = path.split('/').pop();

        await env.DB.prepare(
          'DELETE FROM symptom_types WHERE id = ?'
        ).bind(id).run();

        return jsonResponse({ success: true }, corsHeaders);
      }

      // 404
      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }
  }
};

// Helper: Initialize database
async function initDatabase(db) {
  await db.prepare(\`
    CREATE TABLE IF NOT EXISTS symptom_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  \`).run();

  await db.prepare(\`
    CREATE TABLE IF NOT EXISTS symptom_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id INTEGER NOT NULL,
      notes TEXT,
      date DATE NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES symptom_types(id) ON DELETE CASCADE
    )
  \`).run();
}

// Helper: Validate token
function validateToken(token, validUser, validPassword) {
  try {
    const decoded = atob(token);
    const [username, password, timestamp] = decoded.split(':');

    // Check credentials
    if (username !== validUser || password !== validPassword) {
      return false;
    }

    // Check token age (valid for 7 days)
    const tokenAge = Date.now() - parseInt(timestamp);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    return tokenAge < sevenDays;
  } catch (error) {
    return false;
  }
}

// Helper: JSON response
function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
