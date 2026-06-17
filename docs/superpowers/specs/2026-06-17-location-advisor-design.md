# AI Location Advisor — Design Spec
Date: 2026-06-17

## Overview

A mobile-first PWA that detects the user's GPS location and acts as an AI-powered travel concierge. It discovers nearby attractions, restaurants, events, and experiences, then uses DeepSeek AI to provide personalized recommendations and itineraries. The goal is not a map — it tells travelers what is worth doing right now around their current location.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI provider | DeepSeek (deepseek-chat + deepseek-reasoner) | User-specified |
| Data source | Apify scrapers | User has API key; covers Google Maps, TripAdvisor, Eventbrite |
| Database | PostgreSQL + PostGIS + Redis (Docker, Supabase-ready) | Geospatial queries, self-hosted |
| Auth | None in v1 — anonymous/localStorage | Simplicity |
| Scraping strategy | Cache-first + background BullMQ queue | Best UX: instant if cached, silent refresh otherwise |
| Background jobs | BullMQ on Redis | Redis already in stack; retries, dedup, progress tracking |

---

## Architecture

```
Browser (Next.js PWA, mobile-first)
  │
  ├─ GPS detected → POST /api/location → enqueue BullMQ scrape job
  ├─ GET /api/nearby?lat&lng&radius → serve from PostgreSQL (cached)
  ├─ GET /api/job-status/:id → poll scrape progress (Redis)
  ├─ POST /api/recommendations → DeepSeek AI (deepseek-chat)
  ├─ POST /api/itinerary → DeepSeek AI (deepseek-reasoner)
  └─ POST /api/chat → DeepSeek streaming (deepseek-reasoner)

BullMQ Worker (separate Node process, same codebase)
  ├─ Dedup check: skip if location scraped < 24h ago (Redis TTL)
  ├─ Apify: 4 actors in parallel
  │   ├─ compass/google-maps-scraper
  │   ├─ compass/google-maps-reviews-scraper
  │   ├─ maxcopell/tripadvisor-scraper
  │   └─ zuzka/eventbrite-scraper
  ├─ Merge + deduplicate by name+coords (~50m radius)
  ├─ DeepSeek batch enrichment (10 places/request)
  └─ Upsert to PostgreSQL

Docker Compose (local dev)
  ├─ next-app     (port 3000)
  ├─ worker       (same codebase, entrypoint: worker.ts)
  ├─ postgres+postgis (port 5432)
  └─ redis        (port 6379)
```

---

## Data Layer

### PostgreSQL Schema

```sql
-- PostGIS extension required
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE places (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,        -- restaurant | attraction | event | hotel | essential
  category         TEXT,                 -- museum | cafe | park | concert etc.
  latitude         DOUBLE PRECISION NOT NULL,
  longitude        DOUBLE PRECISION NOT NULL,
  location         GEOMETRY(Point, 4326),  -- set via trigger on INSERT/UPDATE
  rating           NUMERIC(3,1),
  review_count     INTEGER,
  price_level      INTEGER,              -- 1-4
  phone            TEXT,
  website          TEXT,
  address          TEXT,
  opening_hours    JSONB,
  photos           JSONB,
  source           TEXT,                 -- google_maps | tripadvisor | eventbrite
  external_id      TEXT,
  summary          TEXT,
  pros             JSONB,
  cons             JSONB,
  best_for         JSONB,
  visit_duration   TEXT,
  hidden_gem_score INTEGER,              -- 0-100
  tourist_trap_score INTEGER,            -- 0-100
  ai_processed_at  TIMESTAMPTZ,
  scraped_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep location geometry in sync with lat/lng
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
CREATE UNIQUE INDEX idx_places_external ON places (source, external_id);

CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     UUID REFERENCES places(id) ON DELETE CASCADE,
  review_text  TEXT,
  rating       NUMERIC(3,1),
  author       TEXT,
  source       TEXT,
  reviewed_at  TIMESTAMPTZ
);

CREATE TABLE itineraries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT NOT NULL,
  title          TEXT,
  content        JSONB NOT NULL,
  duration_hours NUMERIC(4,1),
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE scrape_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  radius         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  apify_run_ids  JSONB,
  places_found   INTEGER,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);
```

### Redis Keys

| Key | TTL | Purpose |
|---|---|---|
| `scrape:lock:{geohash}` | 24h | Dedup — skip re-scraping same location cell |
| `job:{id}:status` | 2h | Live progress (0–100) for frontend polling |
| `places:{geohash}:{radius}` | 1h | Cached nearby query result |

Geohash precision 6 (~1.2km cells) used for dedup and cache keys.

---

## Worker Layer

Entrypoint: `src/worker.ts`. Runs as a separate process in Docker Compose.

### Job Flow: `scrape-location`

1. Check `scrape:lock:{geohash}` in Redis — if exists, mark job complete and return
2. Set lock key with 24h TTL
3. Run 4 Apify actors in parallel:
   - `compass/google-maps-scraper` — places, ratings, hours, photos, contact
   - `compass/google-maps-reviews-scraper` — reviews for top 20 places
   - `maxcopell/tripadvisor-scraper` — attractions, hotels, restaurants
   - `zuzka/eventbrite-scraper` — events for today + this week
4. Write progress to `job:{id}:status` at each stage (25% → 50% → 75%)
5. Merge results: deduplicate by name+coords within 50m
6. Batch DeepSeek enrichment (10 places/request, `deepseek-chat`):
   - Summary, pros, cons, best_for, visit_duration
   - hidden_gem_score (0–100)
   - tourist_trap_score (0–100)
7. Upsert all to PostgreSQL
8. Set `job:{id}:status` = 100, mark scrape_job completed

**Retry policy:** 3 attempts, exponential backoff (2s, 4s, 8s). Failed Apify runs logged, partial results still saved.

### Apify Actor Config (Google Maps)
```json
{
  "searchStringsArray": ["restaurants", "attractions", "museums", "parks", "events"],
  "lat": 0.0,
  "lng": 0.0,
  "maxCrawledPlacesPerSearch": 20,
  "radius": 5000,
  "language": "en"
}
```

---

## AI Layer

All calls via `src/lib/ai.ts` using DeepSeek's OpenAI-compatible endpoint: `https://api.deepseek.com/v1`.

### Models

| Model | Use |
|---|---|
| `deepseek-chat` | Summaries, scoring, ranking, recommendations |
| `deepseek-reasoner` | Itinerary generation, multi-day planning, streaming chat |

### Worker AI Tasks (batched, 10 places/request)

```ts
// Place enrichment prompt → structured JSON
{
  summary: string,
  pros: string[],
  cons: string[],
  best_for: string[],
  visit_duration: string,
  hidden_gem_score: number,   // 0-100
  tourist_trap_score: number  // 0-100
}
```

### On-Demand API AI Tasks

**GET /api/area-briefing**
- Model: `deepseek-chat`
- Input: `?lat&lng` — called by dashboard on location detect
- Output: `{ briefing: string }` — e.g. "You are in central Bruges. 14 attractions, 6 top-rated restaurants, 2 events today."

**POST /api/recommendations**
- Model: `deepseek-chat`
- Input: `{ lat, lng, time_of_day, preferences, nearby_places[] }`
- Output: ranked list with context-aware reasoning (evening → restaurants/bars; morning → parks/cafes)
- Note: weather context omitted in v1; can be added via Open-Meteo (free, no key) in a later iteration

**POST /api/itinerary**
- Model: `deepseek-reasoner`
- Input: `{ lat, lng, duration_hours, preferences, nearby_places[] }`
- Output: `{ title, stops: [{ time, place_id, name, duration, notes }] }`

**POST /api/chat**
- Model: `deepseek-reasoner`, streaming
- Input: `{ message, location_context, conversation_history[] }`
- Output: streamed text response

### Cost Controls

- AI summaries cached in `places.ai_processed_at` — skip re-processing if < 7 days old
- `/api/itinerary` and `/api/chat` rate-limited: 10 requests/hour per session (Redis counter)

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/location` | Store location, enqueue scrape job, return job ID |
| GET | `/api/nearby` | `?lat&lng&radius&type?` — return cached places from PostgreSQL |
| GET | `/api/job-status/:id` | Poll scrape job progress (0–100) |
| GET | `/api/area-briefing` | AI one-paragraph summary of current area |
| POST | `/api/recommendations` | AI smart picks for current context |
| POST | `/api/itinerary` | Generate time-blocked itinerary |
| POST | `/api/chat` | Streaming travel assistant |

---

## Frontend

### Pages

```
/                          Dashboard: area briefing + quick action grid + top picks
/explore/things-to-do      Card list with filters (Family/Couples/Budget/Luxury/Indoor/Outdoor)
/explore/restaurants        Cuisine + price + open-now filters
/explore/attractions        Museums, castles, historic sites, monuments
/explore/events             Today / Tomorrow / This Week tabs
/explore/hidden-gems        Sorted by hidden_gem_score desc
/explore/scenic-views       Sunset/sunrise spots, photography, walks
/explore/hotels             Accommodation cards
/explore/local-essentials   Pharmacy, ATM, hospital, police, toilet, supermarket
/itinerary                  Duration picker → AI-generated timeline
/saved                      Wishlist / Visited / Favorites (localStorage)
/chat                       Streaming DeepSeek travel assistant
```

### Key Components

| Component | Purpose |
|---|---|
| `PlaceCard` | Name, distance, rating, open status, AI summary, save button |
| `QuickActionGrid` | 8 icon buttons on dashboard |
| `AreaBriefing` | AI-generated paragraph about current location |
| `LoadingPulse` | Progress bar while scrape job runs (0–100%) |
| `FilterBar` | Horizontal scrollable chip row |
| `ItineraryTimeline` | Time-blocked schedule cards |
| `RadiusSelector` | 500m / 1km / 5km / 10km / 25km toggle |

### localStorage Schema

```ts
preferences: {
  foodie: boolean, history: boolean, nature: boolean,
  nightlife: boolean, budget: boolean, luxury: boolean
}
saved: {
  wishlist: string[],   // place IDs
  visited: string[],
  favorites: string[]
}
lastLocation: {
  lat: number, lng: number,
  city: string, district: string,
  scrapedAt: string
}
```

### PWA

- `next-pwa` service worker
- Caches: app shell, saved places data, last itinerary
- Manifest: standalone display, mobile icons, theme color

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/location_advisor

# Redis
REDIS_URL=redis://localhost:6379

# DeepSeek
DEEPSEEK_API_KEY=sk-...

# Apify
APIFY_API_KEY=apify_api_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Docker Compose (local dev)

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: location_advisor
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  app:
    build: .
    command: npm run dev
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    env_file: .env.local

  worker:
    build: .
    command: npm run worker
    depends_on: [postgres, redis]
    env_file: .env.local

volumes:
  pgdata:
```

---

## Supabase Migration Path

When ready to migrate from self-hosted to Supabase:
1. `DATABASE_URL` → Supabase connection string (PostGIS already enabled)
2. `REDIS_URL` → Upstash Redis URL
3. No code changes — all DB access is via standard SQL through Prisma/pg

---

## Out of Scope (v1)

- User authentication / accounts
- Camera landmark recognition
- AR mode
- Voice assistant
- Multi-language support
- Monetization / premium tiers
- Push notifications
