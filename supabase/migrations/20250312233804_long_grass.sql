/*
  # Add realistic set data to workout logs

  1. Changes
    - Add individual set data for each exercise log
    - Show proper weight and rep progression
    - Include warm-up sets and working sets
    - Track set completion status
*/

-- Insert set data for each exercise log
WITH exercise_data AS (
  SELECT 
    e.id as exercise_log_id,
    e.exercise_id,
    o.name as exercise_name,
    e.weight as target_weight,
    w.date,
    ROW_NUMBER() OVER (PARTITION BY o.name ORDER BY w.date) as progression
  FROM exercise_logs e
  JOIN workout_logs w ON w.id = e.workout_id
  JOIN ovningar o ON o.id = e.exercise_id
  WHERE w.user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
)
INSERT INTO set_logs (
  exercise_log_id,
  set_number,
  weight,
  reps,
  completed,
  created_at
)
SELECT 
  ed.exercise_log_id,
  set_number,
  CASE 
    -- Compound lifts with warm-up sets
    WHEN ed.exercise_name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN
      CASE set_number
        WHEN 1 THEN ed.target_weight * 0.5  -- 50% warm-up
        WHEN 2 THEN ed.target_weight * 0.7  -- 70% warm-up
        WHEN 3 THEN ed.target_weight * 0.85 -- 85% working set
        WHEN 4 THEN ed.target_weight        -- 100% working set
        WHEN 5 THEN                         -- Last set might be slightly lighter
          CASE 
            WHEN ed.progression % 4 = 0 THEN ed.target_weight * 1.05 -- PR attempt every 4th session
            ELSE ed.target_weight * 0.95
          END
      END
    -- Isolation exercises with straight sets
    ELSE
      CASE set_number
        WHEN 1 THEN ed.target_weight
        WHEN 2 THEN ed.target_weight
        WHEN 3 THEN ed.target_weight * 0.95 -- Slight fatigue
        WHEN 4 THEN ed.target_weight * 0.9  -- More fatigue
      END
  END as weight,
  CASE 
    -- Compound lifts
    WHEN ed.exercise_name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN
      CASE set_number
        WHEN 1 THEN 10 -- Warm-up
        WHEN 2 THEN 8  -- Warm-up
        WHEN 3 THEN    -- Working sets
          CASE 
            WHEN ed.progression % 4 = 0 THEN 3 -- Heavy day
            WHEN ed.progression % 4 = 1 THEN 8 -- Volume day
            ELSE 5                             -- Normal day
          END
        WHEN 4 THEN    -- Working sets
          CASE 
            WHEN ed.progression % 4 = 0 THEN 3
            WHEN ed.progression % 4 = 1 THEN 8
            ELSE 5
          END
        WHEN 5 THEN    -- Last set
          CASE 
            WHEN ed.progression % 4 = 0 THEN 2 -- PR attempt
            WHEN ed.progression % 4 = 1 THEN 6 -- Volume day
            ELSE 5
          END
      END
    -- Isolation exercises
    ELSE
      CASE set_number
        WHEN 1 THEN 12
        WHEN 2 THEN 12
        WHEN 3 THEN 10 -- Slight fatigue
        WHEN 4 THEN 8  -- More fatigue
      END
  END as reps,
  CASE 
    WHEN ed.progression % 8 = 7 AND set_number = 5 THEN false -- Occasional failed PR attempt
    ELSE true
  END as completed,
  ed.date + (set_number * INTERVAL '3 minutes')
FROM exercise_data ed
CROSS JOIN generate_series(1, 
  CASE 
    WHEN ed.exercise_name IN ('Bänkpress', 'Marklyft', 'Knäböj') THEN 5
    ELSE 4
  END
) as set_number;