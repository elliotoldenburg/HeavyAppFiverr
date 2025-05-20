/*
  # Add machine exercises functionality
  
  1. New Tables
    - `machine_exercises` for storing gym machine information
    
  2. Security
    - Enable RLS
    - Add policies for public read access
    - Link to existing exercises for logging
*/

-- Create machine_exercises table
CREATE TABLE machine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  video_url text,
  description text,
  exercise_id uuid REFERENCES ovningar(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE machine_exercises ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to machine exercises"
  ON machine_exercises
  FOR SELECT
  TO public
  USING (true);

-- Create index for better performance
CREATE INDEX idx_machine_exercises_exercise_id
ON machine_exercises(exercise_id);

-- Insert sample machine exercises
INSERT INTO machine_exercises (
  name,
  image_url,
  video_url,
  description,
  exercise_id
) VALUES
(
  'Bröstpress maskin',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=xUm0BiZCWlQ',
  'Bröstpress maskinen är utformad för att isolera och stärka bröstmusklerna. Den ger stöd för ryggen och eliminerar behovet av balans, vilket gör den idealisk för nybörjare eller de som återhämtar sig från skador. Sitt med rak rygg, greppa handtagen och pressa framåt tills armarna är nästan helt utsträckta, utan att låsa armbågarna.',
  (SELECT id FROM ovningar WHERE name = 'Bänkpress' LIMIT 1)
),
(
  'Latsdrag',
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=CAwf7n6Luuc',
  'Latsdrag är en övning som främst riktar sig mot de breda ryggmusklerna (latissimus dorsi). Sitt med fötterna platta på golvet och greppa stången med händerna något bredare än axelbredd. Dra stången ner mot övre delen av bröstet medan du håller ryggen rak och armbågarna pekande nedåt.',
  (SELECT id FROM ovningar WHERE name = 'Pull-ups' LIMIT 1)
),
(
  'Benpress',
  'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
  'Benpress är en sammansatt övning som främst riktar sig mot quadriceps, hamstrings och gluteus. Sitt i maskinen med fötterna på plattan, axelbredd isär. Lossa säkerhetsspärrarna och sänk vikten kontrollerat tills knäna är i ungefär 90 graders vinkel, tryck sedan tillbaka till startpositionen utan att låsa knäna.',
  (SELECT id FROM ovningar WHERE name = 'Knäböj' LIMIT 1)
),
(
  'Sittande rodd',
  'https://images.unsplash.com/photo-1598289431512-b97b0917affc?q=80&w=2874&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=GZbfZ033f74',
  'Sittande rodd är en övning som riktar sig mot övre och mellersta delen av ryggen, samt biceps. Sitt med rak rygg och böjda knän, greppa handtagen och dra dem mot magen medan du håller armbågarna nära kroppen och klämmer ihop skulderbladen.',
  (SELECT id FROM ovningar WHERE name = 'Skivstångsrodd' LIMIT 1)
),
(
  'Benspark',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=YyvSfVjQeL0',
  'Benspark isolerar quadriceps och är särskilt effektiv för att bygga styrka i framsidan av låren. Sitt i maskinen med baksidan av knäna mot sätets kant och vristerna bakom dynorna. Lyft vikten genom att sträcka benen helt, pausa kort och sänk sedan kontrollerat tillbaka.',
  (SELECT id FROM ovningar WHERE name = 'Knäböj' LIMIT 1)
),
(
  'Axelpress maskin',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=Wqq43dKW1TU',
  'Axelpress maskinen riktar sig mot deltoiderna (axlarna) och är ett säkert alternativ till fria vikter. Sitt med rak rygg, greppa handtagen vid axelhöjd och pressa uppåt tills armarna är nästan helt utsträckta, utan att låsa armbågarna. Sänk sedan kontrollerat tillbaka till startpositionen.',
  (SELECT id FROM ovningar WHERE name = 'Axelpress' LIMIT 1)
),
(
  'Triceps pushdown',
  'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?q=80&w=2831&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=2-LAMcpzODU',
  'Triceps pushdown är en isoleringsövning för triceps. Stå framför en kabelmaskin med ett rep eller en rak stång fäst vid den övre kabeln. Greppa med händerna axelbredd isär, håll armbågarna nära kroppen och tryck nedåt tills armarna är helt utsträckta. Återgå sedan långsamt till startpositionen.',
  (SELECT id FROM ovningar WHERE name = 'Triceps pushdown' LIMIT 1)
),
(
  'Biceps curl maskin',
  'https://images.unsplash.com/photo-1581009137042-c552e485697a?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=9pB8fLgEYXg',
  'Biceps curl maskinen isolerar biceps och ger stöd för att förhindra fusk. Sitt med rak rygg, underarmarna på dynan och greppa handtagen. Böj armbågarna för att lyfta vikten, fokusera på att använda biceps och håll överarmarna stilla. Sänk sedan kontrollerat tillbaka.',
  (SELECT id FROM ovningar WHERE name = 'Hantelcurl' LIMIT 1)
),
(
  'Bencurl',
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=ELOCsoDSmrg',
  'Bencurl isolerar hamstrings (baksida lår). Ligg på mage i maskinen med hälarna under dynorna och händerna på handtagen. Böj knäna för att lyfta vikten mot sätet, pausa kort i topposition och sänk sedan kontrollerat tillbaka.',
  (SELECT id FROM ovningar WHERE name = 'Raka marklyft' LIMIT 1)
),
(
  'Kabelkorsning',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2940&auto=format&fit=crop',
  'https://www.youtube.com/watch?v=taI4XduLpTk',
  'Kabelkorsning är en isoleringsövning för bröstmusklerna. Stå mellan två kabelmaskiner med handtagen inställda på ungefär axelhöjd. Greppa handtagen, ta ett steg framåt och för armarna framåt i en svepande rörelse tills händerna möts framför bröstet. Återgå sedan kontrollerat till startpositionen.',
  (SELECT id FROM ovningar WHERE name = 'Bänkpress' LIMIT 1)
);

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';