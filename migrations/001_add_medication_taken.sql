-- Migration: Add medication_taken column to symptom_logs table
-- Date: 2025-11-22
-- Description: Adds medication tracking capability to symptom logs

-- IMPORTANT: This migration will fail if run more than once on the same database
-- SQLite does not support "IF NOT EXISTS" for ALTER TABLE ADD COLUMN
-- Before running, verify the column doesn't exist using:
-- PRAGMA table_info(symptom_logs);

-- This adds the medication_taken column with default value 0
-- Existing records will automatically have medication_taken = 0 (no medication)

ALTER TABLE symptom_logs ADD COLUMN medication_taken INTEGER DEFAULT 0;
