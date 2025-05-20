/*
  # Add instruction videos to exercises

  1. Changes
    - Update existing exercises with video URLs
    - Videos are hosted on YouTube for optimal streaming and compatibility
*/

-- Update exercises with instruction video URLs
UPDATE ovningar
SET video_url = CASE name
  WHEN 'Bänkpress' THEN 'https://www.youtube.com/watch?v=rT7DgCr-3pg'
  WHEN 'Marklyft' THEN 'https://www.youtube.com/watch?v=op9kVnSso6Q'
  WHEN 'Knäböj' THEN 'https://www.youtube.com/watch?v=ultWZbUMPL8'
  -- Add more exercises here as needed
END
WHERE name IN ('Bänkpress', 'Marklyft', 'Knäböj');