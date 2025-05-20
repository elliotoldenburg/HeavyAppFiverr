/*
  # Add food search edge function
  
  1. Changes
    - Create a migration to document the edge function
    - This is just for documentation purposes as the edge function is deployed separately
*/

-- This migration documents the creation of the food-search edge function
-- The actual function is deployed separately in the supabase/functions/food-search directory

COMMENT ON SCHEMA public IS 'Added food-search edge function for searching food products from Open Food Facts API';