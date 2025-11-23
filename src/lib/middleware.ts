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
  // Database schema is managed via migrations (see migrations/ directory and scripts/run-migrations.sh)
  // This middleware is kept for backwards compatibility but does nothing in production
  await next()
}
