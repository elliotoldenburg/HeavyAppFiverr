/*
  # Create training program database schema

  1. New Tables
    - `program` (Training programs)
    - `pass` (Training sessions)
    - `pass_ovningar` (Exercises in sessions)
    - `ovningar` (Exercise library)
    - `anvandare_program` (User program progress)

  2. Changes to existing tables
    - Update `training_profiles` with new fields

  3. Security
    - Enable RLS on all tables
    - Add appropriate policies for authenticated users
*/

-- Create program table
CREATE TABLE IF NOT EXISTS program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL,
  sessions_per_week integer NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create pass (training sessions) table
CREATE TABLE IF NOT EXISTS pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES program(id) ON DELETE CASCADE,
  day integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create ovningar (exercises) table
CREATE TABLE IF NOT EXISTS ovningar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  equipment text NOT NULL,
  video_url text,
  created_at timestamptz DEFAULT now()
);

-- Create pass_ovningar (exercises in sessions) table
CREATE TABLE IF NOT EXISTS pass_ovningar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid REFERENCES pass(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES ovningar(id) ON DELETE CASCADE,
  sets integer NOT NULL,
  reps text NOT NULL,
  rest_time integer NOT NULL,
  "order" integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create anvandare_program (user program progress) table
CREATE TABLE IF NOT EXISTS anvandare_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES program(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Update training_profiles table with new fields
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS fitness_goal text,
ADD COLUMN IF NOT EXISTS experience_level text;

-- Enable Row Level Security
ALTER TABLE program ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass ENABLE ROW LEVEL SECURITY;
ALTER TABLE ovningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_ovningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE anvandare_program ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to programs"
  ON program
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to training sessions"
  ON pass
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to exercises"
  ON ovningar
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to session exercises"
  ON pass_ovningar
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can read own program progress"
  ON anvandare_program
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own program progress"
  ON anvandare_program
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own program progress"
  ON anvandare_program
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert sample data
INSERT INTO program (name, description, category, difficulty, sessions_per_week, image_url) VALUES
('Muscle Building Pro', 'Optimerat program för maximal muskeltillväxt', 'Bygg Muskelmassa', 'Medel-Avancerad', 4, 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=2940&auto=format&fit=crop'),
('Power & Styrka', 'Fokus på grundövningar och progressiv överbelastning', 'Öka Styrka', 'Alla nivåer', 3, 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2940&auto=format&fit=crop'),
('Lean Transformation', 'Effektiv fettförbränning med bibehållen muskelmassa', 'Viktminskning', 'Nybörjare-Medel', 5, 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=2940&auto=format&fit=crop');

-- Insert sample exercises
INSERT INTO ovningar (name, category, equipment, video_url) VALUES
('Bänkpress', 'Bröst', 'Skivstång', 'https://example.com/bench-press'),
('Marklyft', 'Rygg', 'Skivstång', 'https://example.com/deadlift'),
('Knäböj', 'Ben', 'Skivstång', 'https://example.com/squat');

-- Insert sample training sessions
INSERT INTO pass (program_id, day, name, description)
SELECT 
  p.id,
  1,
  'Överkropp - Pressfokus',
  'Fokus på pressövningar för överkroppen'
FROM program p
WHERE p.name = 'Muscle Building Pro';

-- Insert sample exercises for the training session
INSERT INTO pass_ovningar (pass_id, exercise_id, sets, reps, rest_time, "order")
SELECT 
  p.id,
  e.id,
  4,
  '8-12',
  90,
  1
FROM pass p
JOIN ovningar e ON e.name = 'Bänkpress'
WHERE p.name = 'Överkropp - Pressfokus';