-- Links a test session (report) to the Certificate of Compliance it's attached to.
-- A report has at most one certificate; a certificate may be attached to many reports.
-- ON DELETE SET NULL so deleting a certificate that's still attached to reports just
-- unlinks them instead of failing.
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS certificate_id INTEGER REFERENCES certificates(id) ON DELETE SET NULL;
