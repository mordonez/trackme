/** @jsxImportSource hono/jsx */

import { Layout, TopNav } from '../components/Layout'
import { CONFIG } from '../lib/config'

export const HomePage = () => (
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
        <h2>Historial ({CONFIG.HISTORY_DAYS} días)</h2>
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

export const AdminPage = () => (
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
