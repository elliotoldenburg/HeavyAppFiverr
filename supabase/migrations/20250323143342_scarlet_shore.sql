-- First clean up existing data
DELETE FROM progress_tracking_logs
WHERE user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da';

-- Reinsert progress data with correct volume tracking
INSERT INTO progress_tracking_logs (
  user_id,
  workout_id,
  exercise_id,
  weight,
  reps,
  workout_date
)
SELECT DISTINCT ON (wl.id, el.exercise_id)
  wl.user_id,
  wl.id as workout_id,
  el.exercise_id,
  s.weight,
  s.reps,
  wl.date
FROM workout_logs wl
JOIN exercise_logs el ON el.workout_id = wl.id
JOIN set_logs s ON s.exercise_log_id = el.id
WHERE 
  wl.user_id = 'e5acf328-fe80-465d-8e37-e7caaabeb8da'
  AND s.completed = true
ORDER BY 
  wl.id,
  el.exercise_id,
  s.weight * s.reps DESC; -- Order by volume to get the highest volume set