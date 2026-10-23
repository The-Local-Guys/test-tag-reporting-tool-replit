ALTER TABLE test_results ADD COLUMN IF NOT EXISTS smoke_alarm_type TEXT;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS decibel_test BOOLEAN;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS battery_test_replacement BOOLEAN;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS smoke_test BOOLEAN;
