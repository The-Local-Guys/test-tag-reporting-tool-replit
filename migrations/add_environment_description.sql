-- Additive environment metadata. Existing environments remain valid with a null description.
ALTER TABLE environments
ADD COLUMN IF NOT EXISTS description TEXT;
