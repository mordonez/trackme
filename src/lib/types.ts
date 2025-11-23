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

// ============================================
// DATABASE MODELS (datos de la BD)
// ============================================
export interface SymptomType {
  id: number
  name: string
  created_at: string
}

export interface SymptomLog {
  id: number
  type_id: number
  notes: string | null
  medication_taken: 0 | 1
  date: string
  timestamp: string
}

export interface SymptomLogWithName extends SymptomLog {
  name: string
}
