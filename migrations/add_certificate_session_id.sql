-- Links an auto-created Certificate of Compliance back to the session it was generated from.
-- Nullable: existing freestanding certificates and manually-created ones have no session.
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES test_sessions(id);
