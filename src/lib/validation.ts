// Validation utilities

import { CONFIG } from './types'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function sanitizeString(input: unknown, maxLength = 1000): string {
  if (typeof input !== 'string') return ''
  let sanitized = input.replace(/\0/g, '').trim()
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  return sanitized
}

export function validateCredentials(username: unknown, password: unknown) {
  if (!username || !password) {
    throw new ValidationError('Username and password are required')
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new ValidationError('Invalid credentials format')
  }
  if (username.length > 100 || password.length > 100) {
    throw new ValidationError('Credentials too long')
  }
  return {
    username: sanitizeString(username, 100),
    password: sanitizeString(password, 100),
  }
}

export function validateSymptomName(name: unknown): string {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Symptom name is required')
  }
  const sanitized = sanitizeString(name, CONFIG.MAX_SYMPTOM_NAME_LENGTH)
  if (sanitized.length === 0) {
    throw new ValidationError('Symptom name cannot be empty')
  }
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/i
  if (sqlPatterns.test(sanitized)) {
    throw new ValidationError('Invalid characters in symptom name')
  }
  return sanitized
}

export function validateNotes(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes !== 'string') {
    throw new ValidationError('Notes must be a string')
  }
  return sanitizeString(notes, CONFIG.MAX_NOTE_LENGTH)
}

export function validateId(id: unknown): number {
  const numId = parseInt(String(id), 10)
  if (isNaN(numId) || numId < 1) {
    throw new ValidationError('Invalid ID')
  }
  return numId
}
