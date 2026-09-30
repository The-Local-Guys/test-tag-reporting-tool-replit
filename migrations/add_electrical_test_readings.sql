-- Additive electrical test & tag readings. Existing results remain valid with null readings.
ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS earth_continuity TEXT,
ADD COLUMN IF NOT EXISTS insulation_operator TEXT,
ADD COLUMN IF NOT EXISTS insulation_resistance TEXT,
ADD COLUMN IF NOT EXISTS polarity TEXT,
ADD COLUMN IF NOT EXISTS leakage_current TEXT;
