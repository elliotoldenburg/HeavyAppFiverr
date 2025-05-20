/*
  # Complete Food Logging Schema Migration
  
  1. Changes
    - Drop old tables: meals, meal_items, meal_entries, daily_meal_logs
    - Create new tables with Swedish names: makro_mal, daglig_matlogg, maltidsinlagg, livsmedelskache
    - Implement triggers for automatic total updates
    - Create RPC functions for UI data fetching
*/

-- Step 1: Drop old tables
DROP TABLE IF EXISTS meals CASCADE;
DROP TABLE IF EXISTS meal_items CASCADE;
DROP TABLE IF EXISTS meal_entries CASCADE;
DROP TABLE IF EXISTS daily_meal_logs CASCADE;

-- Step 2: Create new tables
-- 1) Makromål per användare
CREATE TABLE makro_mal (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kolhydrater_g  INT         NOT NULL,
  protein_g      INT         NOT NULL,
  fett_g         INT         NOT NULL,
  kalorier_kcal  INT         NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 2) Daglig matlogg med pre-aggregerade totals
CREATE TABLE daglig_matlogg (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loggdatum          DATE        NOT NULL,
  total_kalorier     INT         NOT NULL DEFAULT 0,
  total_kolhydrater  INT         NOT NULL DEFAULT 0,
  total_protein      INT         NOT NULL DEFAULT 0,
  total_fett         INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, loggdatum)
);

-- 3) Måltidsinlägg för varje rad
CREATE TABLE maltidsinlagg (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  daglig_logg_id   UUID        NOT NULL REFERENCES daglig_matlogg(id) ON DELETE CASCADE,
  maltidstyp       TEXT        NOT NULL,
  off_id           TEXT,                    -- Open Food Facts ID
  custom_namn      TEXT,                    -- om fritt inmatat
  antal_gram       INT         NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 4) Cache för OFF-sökningar
CREATE TABLE livsmedelskache (
  off_id                TEXT        PRIMARY KEY,  -- t.ex. "737628064502" från OFF
  produktnamn           TEXT        NOT NULL,
  varumarke             TEXT,
  energi_kcal_100g      NUMERIC     NOT NULL,
  protein_100g          NUMERIC     NOT NULL,
  kolhydrater_100g      NUMERIC     NOT NULL,
  fett_100g             NUMERIC     NOT NULL,
  bild_url              TEXT,
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Create trigger function for recalculation
CREATE OR REPLACE FUNCTION recalc_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE daglig_matlogg d
  SET
    total_kalorier    = sub.sum_kcal,
    total_kolhydrater = sub.sum_carbs,
    total_protein     = sub.sum_protein,
    total_fett        = sub.sum_fat,
    updated_at        = now()
  FROM (
    SELECT
      m.daglig_logg_id,
      SUM(m.antal_gram * c.energi_kcal_100g  / 100)::INT AS sum_kcal,
      SUM(m.antal_gram * c.kolhydrater_100g / 100)::INT AS sum_carbs,
      SUM(m.antal_gram * c.protein_100g     / 100)::INT AS sum_protein,
      SUM(m.antal_gram * c.fett_100g        / 100)::INT AS sum_fat
    FROM maltidsinlagg m
    LEFT JOIN livsmedelskache c ON m.off_id = c.off_id
    WHERE m.daglig_logg_id = COALESCE(NEW.daglig_logg_id, OLD.daglig_logg_id)
    GROUP BY m.daglig_logg_id
  ) AS sub
  WHERE d.id = sub.daglig_logg_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create triggers
DROP TRIGGER IF EXISTS trg_totals_ins ON maltidsinlagg;
CREATE TRIGGER trg_totals_ins
  AFTER INSERT OR DELETE OR UPDATE ON maltidsinlagg
  FOR EACH ROW EXECUTE FUNCTION recalc_totals();

-- Step 5: Create RPC functions for UI
-- Hämta dagens totals för en användare
CREATE OR REPLACE FUNCTION hamta_dagens_totals(
  _user UUID, 
  _datum DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_kalorier    INT,
  total_kolhydrater INT,
  total_protein     INT,
  total_fett        INT
) AS $$
  SELECT 
    COALESCE(total_kalorier, 0) as total_kalorier, 
    COALESCE(total_kolhydrater, 0) as total_kolhydrater, 
    COALESCE(total_protein, 0) as total_protein, 
    COALESCE(total_fett, 0) as total_fett
  FROM daglig_matlogg
  WHERE user_id = _user AND loggdatum = _datum
  UNION ALL
  SELECT 0, 0, 0, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM daglig_matlogg
    WHERE user_id = _user AND loggdatum = _datum
  )
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Hämta måltidsinlägg + beräknade värden
CREATE OR REPLACE FUNCTION hamta_maltidsinlagg(
  _user UUID,
  _datum DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  maltidstyp    TEXT,
  inlagg        JSON
) AS $$
  WITH logg AS (
    SELECT id 
    FROM daglig_matlogg
    WHERE user_id = _user AND loggdatum = _datum
  ),
  inlagg AS (
    SELECT
      m.maltidstyp,
      json_agg(
        json_build_object(
          'id', m.id,
          'namn', COALESCE(c.produktnamn, m.custom_namn),
          'varumarke', c.varumarke,
          'antal_gram', m.antal_gram,
          'kalorier', (m.antal_gram * c.energi_kcal_100g / 100)::INT,
          'kolhydrater', (m.antal_gram * c.kolhydrater_100g / 100)::INT,
          'protein', (m.antal_gram * c.protein_100g / 100)::INT,
          'fett', (m.antal_gram * c.fett_100g / 100)::INT,
          'bild_url', c.bild_url
        )
      ) AS inlagg_data
    FROM maltidsinlagg m
    LEFT JOIN livsmedelskache c ON m.off_id = c.off_id
    WHERE m.daglig_logg_id IN (SELECT id FROM logg)
    GROUP BY m.maltidstyp
  )
  SELECT 
    i.maltidstyp,
    i.inlagg_data AS inlagg
  FROM inlagg i
  ORDER BY 
    CASE 
      WHEN i.maltidstyp = 'frukost' THEN 1
      WHEN i.maltidstyp = 'lunch' THEN 2
      WHEN i.maltidstyp = 'middag' THEN 3
      WHEN i.maltidstyp = 'mellanmål' THEN 4
      ELSE 5
    END;
$$ LANGUAGE SQL STABLE;

-- Step 6: Create RLS policies
ALTER TABLE makro_mal ENABLE ROW LEVEL SECURITY;
ALTER TABLE daglig_matlogg ENABLE ROW LEVEL SECURITY;
ALTER TABLE maltidsinlagg ENABLE ROW LEVEL SECURITY;
ALTER TABLE livsmedelskache ENABLE ROW LEVEL SECURITY;

-- Policies for makro_mal
CREATE POLICY "Users can read own macro goals"
  ON makro_mal
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own macro goals"
  ON makro_mal
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own macro goals"
  ON makro_mal
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for daglig_matlogg
CREATE POLICY "Users can read own daily logs"
  ON daglig_matlogg
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily logs"
  ON daglig_matlogg
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily logs"
  ON daglig_matlogg
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily logs"
  ON daglig_matlogg
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for maltidsinlagg
CREATE POLICY "Users can read own meal entries"
  ON maltidsinlagg
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daglig_matlogg 
      WHERE id = daglig_logg_id
    )
  );

CREATE POLICY "Users can insert own meal entries"
  ON maltidsinlagg
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM daglig_matlogg 
      WHERE id = daglig_logg_id
    )
  );

CREATE POLICY "Users can update own meal entries"
  ON maltidsinlagg
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daglig_matlogg 
      WHERE id = daglig_logg_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id 
      FROM daglig_matlogg 
      WHERE id = daglig_logg_id
    )
  );

CREATE POLICY "Users can delete own meal entries"
  ON maltidsinlagg
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id 
      FROM daglig_matlogg 
      WHERE id = daglig_logg_id
    )
  );

-- Policies for livsmedelskache
CREATE POLICY "Anyone can read food cache"
  ON livsmedelskache
  FOR SELECT
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daglig_matlogg_user_date 
ON daglig_matlogg(user_id, loggdatum);

CREATE INDEX IF NOT EXISTS idx_maltidsinlagg_logg 
ON maltidsinlagg(daglig_logg_id);

CREATE INDEX IF NOT EXISTS idx_livsmedelskache_produktnamn 
ON livsmedelskache(produktnamn);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION hamta_dagens_totals(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION hamta_maltidsinlagg(UUID, DATE) TO authenticated;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';