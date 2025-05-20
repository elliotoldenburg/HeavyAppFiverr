/*
  # Fix ambiguous column references in get_daily_totals function

  1. Changes
    - Update get_daily_totals function to explicitly reference columns from daily_meal_logs table
    - Add table alias to improve readability
    - Ensure correct aggregation of daily totals
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
    COALESCE(SUM(dml.total_calories), 0)::integer as total_calories,
    COALESCE(SUM(dml.total_protein), 0)::integer as total_protein,
    COALESCE(SUM(dml.total_carbs), 0)::integer as total_carbs,
    COALESCE(SUM(dml.total_fat), 0)::integer as total_fat
  FROM daily_meal_logs dml
  WHERE dml.user_id = p_user_id 
  AND dml.log_date = p_date;
END;
$$ LANGUAGE plpgsql;