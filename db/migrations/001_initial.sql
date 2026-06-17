CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE places (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,
  category           TEXT,
  latitude           DOUBLE PRECISION NOT NULL,
  longitude          DOUBLE PRECISION NOT NULL,
  location           GEOMETRY(Point, 4326),
  rating             NUMERIC(3,1),
  review_count       INTEGER,
  price_level        INTEGER,
  phone              TEXT,
  website            TEXT,
  address            TEXT,
  opening_hours      JSONB,
  photos             JSONB,
  source             TEXT NOT NULL,
  external_id        TEXT,
  summary            TEXT,
  pros               JSONB,
  cons               JSONB,
  best_for           JSONB,
  visit_duration     TEXT,
  hidden_gem_score   INTEGER,
  tourist_trap_score INTEGER,
  ai_processed_at    TIMESTAMPTZ,
  scraped_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION sync_place_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_place_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON places
FOR EACH ROW EXECUTE FUNCTION sync_place_location();

CREATE INDEX idx_places_location ON places USING GIST (location);
CREATE UNIQUE INDEX idx_places_external ON places (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  review_text  TEXT,
  rating       NUMERIC(3,1),
  author       TEXT,
  source       TEXT NOT NULL,
  reviewed_at  TIMESTAMPTZ
);

CREATE INDEX idx_reviews_place_id ON reviews (place_id);

CREATE TABLE itineraries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT NOT NULL,
  title          TEXT,
  content        JSONB NOT NULL,
  duration_hours NUMERIC(4,1),
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_itineraries_session ON itineraries (session_id);

CREATE TABLE scrape_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  radius         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  apify_run_ids  JSONB,
  places_found   INTEGER,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
