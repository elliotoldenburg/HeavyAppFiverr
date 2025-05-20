/*
  # Fix get_daily_totals function return type mismatch

  1. Changes
    - Cast bigint values to integer in get_daily_totals function
    - Ensure consistent return types for all aggregated values
*/

CREATE OR REPLACE FUNCTION get_daily_totals(p_user_id uuid, p_date date)
RETURNS TABLE (
  total_calories integer,
  total_protein integer,
  total_carbs integer,
  total_fat integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(total_calories)::integer, 0) as total_calories,
    COALESCE(SUM(total_protein)::integer, 0) as total_protein,
    COALESCE(SUM(total_carbs)::integer, 0) as total_carbs,
    COALESCE(SUM(total_fat)::integer, 0) as total_fat
  FROM daily_meal_logs
  WHERE user_id = p_user_id AND log_date = p_date;
END;
$$ LANGUAGE plpgsql;