-- First let's check the data we have
WITH volume_data AS (
  SELECT 
    wl.date,
    o.name as exercise_name,
    ptl.weight,
    ptl.reps,
    (ptl.weight * ptl.reps) as volume
  FROM progress_tracking_logs ptl
  JOIN workout_logs wl ON wl.id = ptl.workout_id
  JOIN ovningar o ON o.id = ptl.exercise_id
  WHERE 
    wl.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
    AND o.name = 'Bänkpress'
    AND wl.date >= CURRENT_DATE - INTERVAL '24 weeks'
  ORDER BY wl.date DESC
)
SELECT * FROM volume_data;

-- Let's also check the raw set data to compare
WITH set_data AS (
  SELECT 
    wl.date,
    o.name as exercise_name,
    s.weight,
    s.reps,
    (s.weight * s.reps) as volume
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN ovningar o ON o.id = el.exercise_id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    wl.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
    AND o.name = 'Bänkpress'
    AND wl.date >= CURRENT_DATE - INTERVAL '24 weeks'
    AND s.completed = true
  ORDER BY wl.date DESC, s.weight * s.reps DESC
)
SELECT * FROM set_data;