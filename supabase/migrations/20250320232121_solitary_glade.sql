-- Först kolla vilka övningar som finns
SELECT id, name, category FROM ovningar WHERE name = 'Axelpress';

-- Sedan kolla träningshistoriken för axelpress
WITH exercise_history AS (
  SELECT 
    wl.date,
    el.exercise_id,
    o.name as exercise_name,
    s.reps,
    s.weight,
    (s.weight * s.reps) as volume,
    ROW_NUMBER() OVER (
      PARTITION BY wl.id, el.exercise_id 
      ORDER BY (s.weight * s.reps) DESC
    ) as set_rank
  FROM workout_logs wl
  JOIN exercise_logs el ON el.workout_id = wl.id
  JOIN ovningar o ON o.id = el.exercise_id
  JOIN set_logs s ON s.exercise_log_id = el.id
  WHERE 
    wl.user_id = '16a68fe7-f215-49cb-9a40-fd928966feb6'
    AND o.name = 'Axelpress'
    AND s.completed = true
    AND s.weight > 0
)
SELECT 
  date,
  exercise_name,
  reps,
  weight,
  volume
FROM exercise_history
WHERE set_rank = 1  -- Bara det bästa setet från varje pass
ORDER BY date DESC;