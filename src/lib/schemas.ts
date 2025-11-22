// Validation schemas using Zod

import { z } from 'zod'
import { CONFIG } from './types'

// Schemas
export const credentialsSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .max(100, 'Username too long')
    .transform(val => val.replace(/\0/g, '').trim()),
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password too long')
    .transform(val => val.replace(/\0/g, '').trim()),
})

export const symptomNameSchema = z.object({
  name: z.string()
    .min(1, 'Symptom name is required')
    .max(CONFIG.MAX_SYMPTOM_NAME_LENGTH, 'Symptom name too long')
    .transform(val => val.replace(/\0/g, '').trim())
    .refine(val => val.length > 0, 'Symptom name cannot be empty')
    .refine(
      val => !/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/i.test(val),
      'Invalid characters in symptom name'
    ),
})

export const logSymptomSchema = z.object({
  type_id: z.coerce.number().int().positive('Invalid ID'),
  notes: z.string()
    .max(CONFIG.MAX_NOTE_LENGTH, 'Notes too long')
    .transform(val => val ? val.replace(/\0/g, '').trim() : null)
    .nullable()
    .optional(),
  medication_taken: z.string()
    .optional()
    .default('')
    .transform(val => val === 'on' ? 1 : 0),
})

export const symptomIdSchema = z.object({
  id: z.coerce.number().int().positive('Invalid ID'),
})
