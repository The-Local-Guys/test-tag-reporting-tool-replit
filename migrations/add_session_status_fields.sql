-- Migration: Add database-first architecture fields to test_sessions
-- This migration adds fields required for the database-first architecture that fixes:
-- 1. Multi-day jobs disappearing (sessions tracked by status in DB)
-- 2. Custom asset numbers not saving (stored in customStartingNumbers JSON)
-- 3. Data loss from localStorage issues (lastActivityAt for tracking)

-- Add status field (draft/finalized) with default 'draft' for existing sessions
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Add custom_starting_numbers field for storing custom asset number ranges
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS custom_starting_numbers JSONB;

-- Add last_activity_at timestamp for tracking session activity
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- Update existing sessions: mark all sessions that have results as 'finalized'
-- (they were completed before this migration)
UPDATE test_sessions
SET status = 'finalized'
WHERE id IN (
    SELECT DISTINCT session_id
    FROM test_results
    WHERE session_id IS NOT NULL
);

-- Add index for efficient draft session queries
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_status
ON test_sessions(user_id, status)
WHERE deleted_at IS NULL;

-- Add index for last activity ordering
CREATE INDEX IF NOT EXISTS idx_test_sessions_last_activity
ON test_sessions(last_activity_at DESC)
WHERE deleted_at IS NULL;
