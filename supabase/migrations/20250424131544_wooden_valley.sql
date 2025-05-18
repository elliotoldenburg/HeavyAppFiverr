/*
  # Create food cache table for Livsmedelsverket API data
  
  1. New Tables
    - `food_cache` for storing and caching food data from Livsmedelsverket API
    
  2. Security
    - Enable RLS
    - Add policy for public read access
    - Ensure proper data access control
*/

-- Create extension for text search first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create food_cache table
CREATE TABLE IF NOT EXISTS public.food_cache (
  id bigint PRIMARY KEY,          -- Livsmedelsverket Nummer
  name text NOT NULL,
  raw_json jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "anon read" ON public.food_cache
  FOR SELECT USING (true);

-- Create index for faster name searches
CREATE INDEX IF NOT EXISTS idx_food_cache_name_search 
ON public.food_cache USING gin (name gin_trgm_ops);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';