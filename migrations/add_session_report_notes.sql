-- Additive report-level notes. Existing sessions remain valid with null notes.
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS report_notes TEXT;
