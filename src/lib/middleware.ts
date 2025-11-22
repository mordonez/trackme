import type { Context, Next } from 'hono'
import type { Bindings } from '../lib/types'
import { isAuthenticated } from '../lib/auth'

export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  if (!isAuthenticated(c)) {
    return c.redirect('/login')
  }
  await next()
}

export async function securityHeaders(c: Context, next: Next) {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
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
  ].join('; '))
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
}

export async function initDatabase(c: Context<{ Bindings: Bindings }>, next: Next) {
  const db = c.env.DB
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS symptom_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS symptom_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_id INTEGER NOT NULL,
        notes TEXT,
        date DATE NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES symptom_types(id) ON DELETE CASCADE
      )
    `).run()

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_symptom_logs_date
      ON symptom_logs(date DESC)
    `).run()

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_symptom_logs_type_id
      ON symptom_logs(type_id)
    `).run()
  } catch (error) {
    console.error('Database initialization error:', error)
  }
  await next()
}
