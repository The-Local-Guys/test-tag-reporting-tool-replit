-- Migration: Add trip_times NUMERIC[] array column and migrate data from notes embedding
-- Fixes the issue where trip times were stored in the notes field as [TRIP_TIMES:[...]]
-- instead of a proper array column.

-- Step 1: Add the proper array column
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS trip_times NUMERIC[];

-- Step 2: Migrate existing records that have trip times embedded in notes
-- Pattern: [TRIP_TIMES:[250,260,255]]
UPDATE test_results
SET
  trip_times = (
    SELECT ARRAY_AGG(v::NUMERIC)
    FROM UNNEST(
      string_to_array(
        (regexp_match(notes, '\[TRIP_TIMES:\[([^\]]*)\]\]'))[1],
        ','
      )
    ) AS v
    WHERE v ~ '^\s*[0-9]+\.?[0-9]*\s*$' AND v::NUMERIC > 0
  ),
  notes = NULLIF(
    TRIM(regexp_replace(notes, '\s*\[TRIP_TIMES:\[[^\]]*\]\]', '', 'g')),
    ''
  )
WHERE notes ~ '\[TRIP_TIMES:\[';

-- Step 3: For records that only have a single trip_time value but no trip_times array yet,
-- promote the single value into the array column
UPDATE test_results
SET trip_times = ARRAY[trip_time]
WHERE trip_time IS NOT NULL
  AND trip_time > 0
  AND (trip_times IS NULL OR array_length(trip_times, 1) IS NULL);
