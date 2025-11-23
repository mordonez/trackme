/** @jsxImportSource hono/jsx */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Bindings } from '../lib/types'
import { credentialsSchema } from '../lib/schemas'
import { setAuthCookie, clearAuthCookie } from '../lib/auth'
import { Layout, FormGroup } from '../components/Layout'
import { guestOnlyMiddleware } from '../lib/middleware'

const auth = new Hono<{ Bindings: Bindings }>()

auth.get('/login', guestOnlyMiddleware, (c) => {
  return c.html(
    <Layout title="Login - TrackMe">
      <div class="container">
        <div class="card" style="max-width: 400px; margin: 3rem auto;">
          <h1>🩺 TrackMe</h1>
          <p class="text-muted subtitle">Seguimiento simple de síntomas</p>
          <div id="login-message"></div>
          <form hx-post="/api/login" hx-target="#login-message" hx-swap="innerHTML">
            <FormGroup>
              <label>Usuario</label>
              <input type="text" name="username" placeholder="Tu usuario" autocomplete="username" maxLength={100} required />
            </FormGroup>
            <FormGroup>
              <label>Contraseña</label>
              <input type="password" name="password" placeholder="Tu contraseña" autocomplete="current-password" maxLength={100} required />
            </FormGroup>
            <button type="submit" class="w-full">Entrar</button>
          </form>
        </div>
      </div>
    </Layout>
  )
})

auth.post('/api/login', zValidator('form', credentialsSchema), async (c) => {
  const { username, password } = c.req.valid('form')

  if (username === c.env.TRACKME_USER && password === c.env.TRACKME_PASSWORD) {
    setAuthCookie(c, username, password)
    c.header('HX-Redirect', '/')
    return c.html(<div class="success">Login exitoso, redirigiendo...</div>)
  }

  await new Promise(resolve => setTimeout(resolve, 100))
  return c.html(<div class="error">Credenciales inválidas</div>, 401)
})

auth.post('/api/logout', (c) => {
  clearAuthCookie(c)
  c.header('HX-Redirect', '/login')
  return c.text('', 200)
})

export default auth
