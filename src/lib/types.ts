// Type definitions for the application

export type Bindings = {
  DB: D1Database
  TRACKME_USER: string
  TRACKME_PASSWORD: string
  ASSETS: Fetcher
}

export type Variables = {
  user: string | null
}

export const CONFIG = {
  TOKEN_EXPIRY_DAYS: 7,
  HISTORY_DAYS: 14,
  MAX_NOTE_LENGTH: 1000,
  MAX_SYMPTOM_NAME_LENGTH: 100,
} as const
