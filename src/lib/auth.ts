// Authentication utilities

import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings } from './types'
import { CONFIG } from './config'

export function generateToken(username: string, password: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const payload = `${username}:${password}:${timestamp}:${random}`
  return btoa(payload)
}

export function validateToken(token: string, validUser: string, validPassword: string): boolean {
  try {
    if (!token || token.length > 500) return false

    const decoded = atob(token)
    const parts = decoded.split(':')
    if (parts.length < 3) return false

    const [username, password, timestamp] = parts
    if (username !== validUser || password !== validPassword) return false

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    const maxAge = CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > maxAge) return false

    return true
  } catch {
    return false
  }
}

export function setAuthCookie(c: Context, username: string, password: string) {
  const token = generateToken(username, password)
  setCookie(c, 'auth_token', token, {
    maxAge: CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
  })
}

export function clearAuthCookie(c: Context) {
  deleteCookie(c, 'auth_token')
}

export function isAuthenticated(c: Context<{ Bindings: Bindings }>): boolean {
  const token = getCookie(c, 'auth_token')
  if (!token) return false
  return validateToken(token, c.env.TRACKME_USER, c.env.TRACKME_PASSWORD)
}
