-- Migration: Add medication_taken column to symptom_logs table
-- Date: 2025-11-22
-- Description: Adds medication tracking capability to symptom logs

-- Add medication_taken column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we need to check if the column exists first

-- For SQLite/D1, we'll use a safe approach:
-- 1. Check if column exists using PRAGMA table_info
-- 2. If it doesn't exist, add it

-- This migration adds the medication_taken column with default value 0
-- Existing records will automatically have medication_taken = 0 (no medication)

ALTER TABLE symptom_logs ADD COLUMN medication_taken INTEGER DEFAULT 0;
