-- Add age, gender, location columns to user_preferences table
-- Created: 2024-09-22
-- Purpose: Add missing profile columns to support user profile setup

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
ADD COLUMN IF NOT EXISTS location VARCHAR(100);

-- Update existing records to set default values if needed
UPDATE user_preferences
SET
    age = NULL,
    gender = NULL,
    location = NULL
WHERE age IS NULL AND gender IS NULL AND location IS NULL;