BEGIN;

-- Normalize at the database boundary too, including clients using older servers.
CREATE OR REPLACE FUNCTION normalize_test_session_country()
RETURNS trigger AS $$
BEGIN
  IF lower(regexp_replace(NEW.country, '[[:space:]_-]', '', 'g')) = 'newzealand' THEN
    NEW.country := 'newzealand';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_test_session_country ON test_sessions;
CREATE TRIGGER normalize_test_session_country
BEFORE INSERT OR UPDATE OF country ON test_sessions
FOR EACH ROW EXECUTE FUNCTION normalize_test_session_country();

-- Include drafts, finalized reports, and soft-deleted reports.
UPDATE test_sessions
SET country = 'newzealand'
WHERE country <> 'newzealand'
  AND lower(regexp_replace(country, '[[:space:]_-]', '', 'g')) = 'newzealand';

-- Retried mobile creates must not replay the old spelling from cached responses.
-- Preserve request_hash so original requests can still be retried successfully.
UPDATE idempotency_keys
SET response_body = jsonb_set(response_body, '{country}', '"newzealand"'::jsonb)
WHERE resource_type = 'test_session'
  AND response_body->>'country' <> 'newzealand'
  AND lower(regexp_replace(response_body->>'country', '[[:space:]_-]', '', 'g')) = 'newzealand';

COMMIT;
