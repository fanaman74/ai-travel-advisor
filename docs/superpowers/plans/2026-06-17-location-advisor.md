# AI Location Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA travel concierge that detects GPS location, scrapes nearby places via Apify in the background, enriches them with DeepSeek AI, and surfaces personalized recommendations and itineraries.

**Architecture:** Next.js 14 App Router + API routes for the web layer; BullMQ worker process (same codebase, separate entrypoint) for async Apify scraping; PostgreSQL + PostGIS for geospatial place storage; Redis for job queues, dedup locks, and query caching. DeepSeek API (OpenAI-compatible) handles all AI tasks via the `openai` SDK.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, `pg` (node-postgres), `ioredis`, `bullmq`, `apify-client`, `openai` SDK (pointed at DeepSeek), `ngeohash`, `next-pwa`, Jest, React Testing Library

---

## File Map

```
location-advisor/
├── docker-compose.yml
├── Dockerfile
├── .env.local               # real keys (gitignored)
├── .env.example             # placeholder keys
├── next.config.ts
├── tailwind.config.ts
├── jest.config.ts
├── jest.setup.ts
├── worker.ts                # worker entrypoint (run by Docker)
│
├── db/
│   └── migrations/
│       └── 001_initial.sql
│
├── scripts/
│   └── migrate.ts           # runs SQL migrations against DATABASE_URL
│
└── src/
    ├── types/index.ts        # Place, Review, ScrapeJob, UserPrefs, etc.
    ├── lib/
    │   ├── db.ts             # pg Pool singleton
    │   ├── redis.ts          # ioredis singleton
    │   ├── queue.ts          # BullMQ queue + job type definitions
    │   ├── ai.ts             # DeepSeek client (openai SDK, custom baseURL)
    │   ├── geo.ts            # geohash, haversine distance
    │   └── apify.ts          # Apify actor runner wrapper
    ├── worker/
    │   ├── processor.ts      # BullMQ job processor (orchestrates scrape)
    │   ├── merge-places.ts   # dedup/merge raw Apify results
    │   └── enrich-places.ts  # DeepSeek batch enrichment
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                        # Dashboard
    │   ├── explore/
    │   │   ├── things-to-do/page.tsx
    │   │   ├── restaurants/page.tsx
    │   │   ├── attractions/page.tsx
    │   │   ├── events/page.tsx
    │   │   ├── hidden-gems/page.tsx
    │   │   ├── scenic-views/page.tsx
    │   │   ├── hotels/page.tsx
    │   │   └── local-essentials/page.tsx
    │   ├── itinerary/page.tsx
    │   ├── saved/page.tsx
    │   ├── chat/page.tsx
    │   └── api/
    │       ├── location/route.ts
    │       ├── nearby/route.ts
    │       ├── job-status/[id]/route.ts
    │       ├── area-briefing/route.ts
    │       ├── recommendations/route.ts
    │       ├── itinerary/route.ts
    │       └── chat/route.ts
    ├── components/
    │   ├── PlaceCard.tsx
    │   ├── QuickActionGrid.tsx
    │   ├── AreaBriefing.tsx
    │   ├── LoadingPulse.tsx
    │   ├── FilterBar.tsx
    │   ├── ItineraryTimeline.tsx
    │   └── RadiusSelector.tsx
    └── hooks/
        ├── useLocation.ts    # GPS + reverse geocode (Nominatim)
        ├── useNearby.ts      # fetch /api/nearby, trigger /api/location
        ├── useJobStatus.ts   # poll /api/job-status/:id
        └── useLocalStorage.ts # preferences + saved places
```

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/fred/Documents/VibeCoding/claudecode/location-advisor
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install pg ioredis bullmq apify-client openai ngeohash next-pwa
npm install @types/pg @types/ngeohash --save-dev
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 4: Write `jest.config.ts`**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterFramework: [],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
}

export default config
```

- [ ] **Step 5: Write `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add scripts to `package.json`**

Open `package.json` and add to the `"scripts"` block:
```json
"worker": "ts-node --project tsconfig.json worker.ts",
"migrate": "ts-node --project tsconfig.json scripts/migrate.ts",
"test": "jest",
"test:watch": "jest --watch"
```

Also install `ts-node`:
```bash
npm install --save-dev ts-node
```

- [ ] **Step 7: Verify Next.js starts**

```bash
npm run dev
```
Expected: server starts on port 3000, no errors.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js project with TypeScript, Tailwind, Jest"
```

---

## Task 2: Docker Compose + Environment

**Files:**
- Create: `docker-compose.yml`, `Dockerfile`, `.env.local`, `.env.example`, `.gitignore`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: location_advisor
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  app:
    build: .
    command: npm run dev
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env.local
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next

  worker:
    build: .
    command: npm run worker
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env.local
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  pgdata:
```

- [ ] **Step 3: Write `.env.example`**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/location_advisor
REDIS_URL=redis://localhost:6379
DEEPSEEK_API_KEY=sk-...
APIFY_API_KEY=apify_api_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Write `.env.local`** (real keys — gitignored)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/location_advisor
REDIS_URL=redis://localhost:6379
DEEPSEEK_API_KEY=sk-REDACTED
APIFY_API_KEY=apify_api_REDACTED
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: Update `.gitignore`** — ensure `.env.local` is listed

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 6: Start Docker services**

```bash
docker compose up postgres redis -d
```
Expected: both containers healthy.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml Dockerfile .env.example .gitignore
git commit -m "feat: add Docker Compose with postgres+postgis and redis"
```

---

## Task 3: Database Schema + Migration

**Files:**
- Create: `db/migrations/001_initial.sql`, `scripts/migrate.ts`

- [ ] **Step 1: Write `db/migrations/001_initial.sql`**

```sql
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
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

```typescript
import { Pool } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const dir = join(process.cwd(), 'db', 'migrations')
    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

    for (const file of files) {
      const version = file.replace('.sql', '')
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )
      if (rows.length > 0) {
        console.log(`Skipping ${file} (already applied)`)
        continue
      }
      console.log(`Applying ${file}...`)
      const sql = readFileSync(join(dir, file), 'utf-8')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      )
      console.log(`Applied ${file}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run migration**

```bash
npm run migrate
```
Expected output:
```
Applying 001_initial.sql...
Applied 001_initial.sql
```

- [ ] **Step 4: Verify tables exist**

```bash
docker compose exec postgres psql -U postgres -d location_advisor -c "\dt"
```
Expected: lists `places`, `reviews`, `itineraries`, `scrape_jobs`, `schema_migrations`.

- [ ] **Step 5: Commit**

```bash
git add db/ scripts/
git commit -m "feat: add database schema with PostGIS and migration runner"
```

---

## Task 4: Core Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write `src/types/index.ts`**

```typescript
export interface Place {
  id: string
  name: string
  type: 'restaurant' | 'attraction' | 'event' | 'hotel' | 'essential'
  category: string | null
  latitude: number
  longitude: number
  rating: number | null
  review_count: number | null
  price_level: number | null
  phone: string | null
  website: string | null
  address: string | null
  opening_hours: Record<string, string> | null
  photos: string[] | null
  source: 'google_maps' | 'tripadvisor' | 'eventbrite'
  external_id: string | null
  summary: string | null
  pros: string[] | null
  cons: string[] | null
  best_for: string[] | null
  visit_duration: string | null
  hidden_gem_score: number | null
  tourist_trap_score: number | null
  ai_processed_at: string | null
  scraped_at: string | null
  created_at: string
  updated_at: string
  distance_m?: number
}

export interface Review {
  id: string
  place_id: string
  review_text: string | null
  rating: number | null
  author: string | null
  source: string
  reviewed_at: string | null
}

export interface ScrapeJob {
  id: string
  lat: number
  lng: number
  radius: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  apify_run_ids: string[] | null
  places_found: number | null
  started_at: string | null
  completed_at: string | null
}

export interface UserLocation {
  latitude: number
  longitude: number
  country: string
  city: string
  district: string
}

export interface UserPreferences {
  foodie: boolean
  history: boolean
  nature: boolean
  nightlife: boolean
  budget: boolean
  luxury: boolean
}

export interface SavedPlaces {
  wishlist: string[]
  visited: string[]
  favorites: string[]
}

export interface ItineraryStop {
  time: string
  place_id: string | null
  name: string
  duration: string
  notes: string
}

export interface Itinerary {
  id: string
  session_id: string
  title: string
  content: { stops: ItineraryStop[] }
  duration_hours: number
  latitude: number | null
  longitude: number | null
  created_at: string
}

export interface RawApifyPlace {
  title?: string
  name?: string
  latitude?: number
  longitude?: number
  totalScore?: number
  rating?: number
  reviewsCount?: number
  price?: string
  address?: string
  phone?: string
  website?: string
  openingHours?: Array<{ day: string; hours: string }>
  imageUrls?: string[]
  placeId?: string
  categoryName?: string
}

export interface ScrapeLocationJobData {
  jobId: string
  lat: number
  lng: number
  radius: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add shared TypeScript type definitions"
```

---

## Task 5: DB and Redis Clients

**Files:**
- Create: `src/lib/db.ts`, `src/lib/redis.ts`

- [ ] **Step 1: Write `src/lib/db.ts`**

```typescript
import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    })
  }
  return pool
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params)
  return result.rows as T[]
}
```

- [ ] **Step 2: Write `src/lib/redis.ts`**

```typescript
import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return redis
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/redis.ts
git commit -m "feat: add pg and ioredis client singletons"
```

---

## Task 6: Geo Utilities (TDD)

**Files:**
- Create: `src/lib/geo.ts`, `src/__tests__/lib/geo.test.ts`

- [ ] **Step 1: Write failing tests `src/__tests__/lib/geo.test.ts`**

```typescript
import { toGeohash, haversineMeters, arePlacesClose } from '@/lib/geo'

describe('toGeohash', () => {
  it('returns a 6-character geohash for known coordinates', () => {
    const hash = toGeohash(51.2093, 3.2247)
    expect(hash).toHaveLength(6)
    expect(typeof hash).toBe('string')
  })

  it('returns the same hash for coordinates within ~1.2km', () => {
    const h1 = toGeohash(51.2093, 3.2247)
    const h2 = toGeohash(51.2100, 3.2250)
    expect(h1).toBe(h2)
  })
})

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(51.2093, 3.2247, 51.2093, 3.2247)).toBe(0)
  })

  it('returns ~111km for 1 degree latitude difference', () => {
    const dist = haversineMeters(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(110_000)
    expect(dist).toBeLessThan(112_000)
  })
})

describe('arePlacesClose', () => {
  it('returns true for places within 50m', () => {
    expect(arePlacesClose(51.2093, 3.2247, 51.2094, 3.2248)).toBe(true)
  })

  it('returns false for places more than 50m apart', () => {
    expect(arePlacesClose(51.2093, 3.2247, 51.2200, 3.2400)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test src/__tests__/lib/geo.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/geo'`

- [ ] **Step 3: Write `src/lib/geo.ts`**

```typescript
import ngeohash from 'ngeohash'

export function toGeohash(lat: number, lng: number, precision = 6): string {
  return ngeohash.encode(lat, lng, precision)
}

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function arePlacesClose(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  thresholdMeters = 50
): boolean {
  return haversineMeters(lat1, lng1, lat2, lng2) <= thresholdMeters
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test src/__tests__/lib/geo.test.ts
```
Expected: PASS (3 test suites, all green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/__tests__/
git commit -m "feat: add geo utilities (geohash, haversine, proximity check)"
```

---

## Task 7: DeepSeek AI Client

**Files:**
- Create: `src/lib/ai.ts`, `src/__tests__/lib/ai.test.ts`

- [ ] **Step 1: Write failing test `src/__tests__/lib/ai.test.ts`**

```typescript
import { enrichPlaces, generateAreaBriefing } from '@/lib/ai'

const mockCreate = jest.fn()
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

describe('enrichPlaces', () => {
  it('returns enrichment for each place', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([{
            summary: 'Great museum',
            pros: ['free entry'],
            cons: ['crowded'],
            best_for: ['history lovers'],
            visit_duration: '2 hours',
            hidden_gem_score: 45,
            tourist_trap_score: 20,
          }]),
        },
      }],
    })

    const result = await enrichPlaces([
      { name: 'City Museum', type: 'attraction', rating: 4.5, reviews: [] }
    ])

    expect(result).toHaveLength(1)
    expect(result[0].summary).toBe('Great museum')
    expect(result[0].hidden_gem_score).toBe(45)
  })
})

describe('generateAreaBriefing', () => {
  it('returns a briefing string', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'You are in central Bruges.' } }],
    })

    const briefing = await generateAreaBriefing({
      city: 'Bruges',
      district: 'Centre',
      attractionCount: 14,
      restaurantCount: 6,
      eventCount: 2,
    })

    expect(typeof briefing).toBe('string')
    expect(briefing.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test src/__tests__/lib/ai.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/ai'`

- [ ] **Step 3: Write `src/lib/ai.ts`**

```typescript
import OpenAI from 'openai'

export interface PlaceInput {
  name: string
  type: string
  rating: number | null
  reviews: string[]
}

export interface PlaceEnrichment {
  summary: string
  pros: string[]
  cons: string[]
  best_for: string[]
  visit_duration: string
  hidden_gem_score: number
  tourist_trap_score: number
}

export interface AreaBriefingInput {
  city: string
  district: string
  attractionCount: number
  restaurantCount: number
  eventCount: number
}

function getClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  })
}

export async function enrichPlaces(places: PlaceInput[]): Promise<PlaceEnrichment[]> {
  const client = getClient()

  const prompt = `You are a travel advisor. For each place, return a JSON array of enrichment objects.
Each object must have: summary (string), pros (string[]), cons (string[]), best_for (string[]),
visit_duration (string), hidden_gem_score (0-100 integer), tourist_trap_score (0-100 integer).

Places:
${JSON.stringify(places, null, 2)}

Return ONLY the JSON array, no markdown.`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content ?? '[]'
  try {
    return JSON.parse(content) as PlaceEnrichment[]
  } catch {
    return places.map(() => ({
      summary: '',
      pros: [],
      cons: [],
      best_for: [],
      visit_duration: '',
      hidden_gem_score: 50,
      tourist_trap_score: 50,
    }))
  }
}

export async function generateAreaBriefing(input: AreaBriefingInput): Promise<string> {
  const client = getClient()

  const prompt = `Write a 2-sentence travel briefing for a traveler currently in ${input.district}, ${input.city}.
Mention that there are ${input.attractionCount} attractions, ${input.restaurantCount} restaurants, and ${input.eventCount} events nearby.
Be concise and helpful. Return only the briefing text, no quotes.`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function generateRecommendations(input: {
  city: string
  timeOfDay: string
  preferences: Record<string, boolean>
  places: Array<{ name: string; type: string; summary: string | null }>
}): Promise<Array<{ place_name: string; reason: string }>> {
  const client = getClient()

  const activePrefs = Object.entries(input.preferences)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const prompt = `You are a travel concierge in ${input.city}. It is ${input.timeOfDay}.
The traveler's interests: ${activePrefs || 'general sightseeing'}.

From these nearby places, pick the top 5 most relevant right now:
${JSON.stringify(input.places, null, 2)}

Return a JSON array of { place_name: string, reason: string } objects. Return ONLY the JSON array.`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  })

  try {
    return JSON.parse(response.choices[0]?.message?.content ?? '[]')
  } catch {
    return []
  }
}

export async function generateItinerary(input: {
  city: string
  durationHours: number
  preferences: Record<string, boolean>
  places: Array<{ name: string; type: string; visit_duration: string | null; address: string | null }>
}): Promise<{ title: string; stops: Array<{ time: string; place_id: null; name: string; duration: string; notes: string }> }> {
  const client = getClient()

  const activePrefs = Object.entries(input.preferences)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const prompt = `Create a ${input.durationHours}-hour itinerary in ${input.city} for a traveler interested in: ${activePrefs || 'general sightseeing'}.

Available places:
${JSON.stringify(input.places, null, 2)}

Return a JSON object:
{
  "title": "Your [X]-hour [City] Adventure",
  "stops": [
    { "time": "09:00", "place_id": null, "name": "Place Name", "duration": "1 hour", "notes": "Brief tip" }
  ]
}
Start at a reasonable morning time. Return ONLY the JSON object.`

  const response = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const content = response.choices[0]?.message?.content ?? '{}'
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { title: `${input.durationHours}-hour itinerary`, stops: [] }
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test src/__tests__/lib/ai.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/__tests__/lib/ai.test.ts
git commit -m "feat: add DeepSeek AI client with enrichment, briefing, recommendations, itinerary"
```

---

## Task 8: Apify Client Wrapper

**Files:**
- Create: `src/lib/apify.ts`, `src/__tests__/lib/apify.test.ts`

- [ ] **Step 1: Write failing test `src/__tests__/lib/apify.test.ts`**

```typescript
import { runGoogleMapsScraper } from '@/lib/apify'
import { ApifyClient } from 'apify-client'

jest.mock('apify-client')

const mockDatasetListItems = jest.fn()
const mockActorCall = jest.fn()

;(ApifyClient as jest.Mock).mockImplementation(() => ({
  actor: () => ({ call: mockActorCall }),
  dataset: () => ({ listItems: mockDatasetListItems }),
}))

describe('runGoogleMapsScraper', () => {
  it('returns array of raw places', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({
      items: [
        { title: 'Cafe Bruges', latitude: 51.2093, longitude: 3.2247, totalScore: 4.5 },
      ],
    })

    const results = await runGoogleMapsScraper({ lat: 51.2093, lng: 3.2247, radius: 1000 })

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Cafe Bruges')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test src/__tests__/lib/apify.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `src/lib/apify.ts`**

```typescript
import { ApifyClient } from 'apify-client'
import type { RawApifyPlace } from '@/types'

function getClient() {
  return new ApifyClient({ token: process.env.APIFY_API_KEY })
}

async function runActor(actorId: string, input: Record<string, unknown>): Promise<unknown[]> {
  const client = getClient()
  const run = await client.actor(actorId).call(input, { waitSecs: 120 })
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items
}

export async function runGoogleMapsScraper(params: {
  lat: number
  lng: number
  radius: number
}): Promise<RawApifyPlace[]> {
  const searchTerms = ['restaurants', 'cafes', 'museums', 'attractions', 'parks', 'hotels']
  const items = await runActor('compass/google-maps-scraper', {
    searchStringsArray: searchTerms.map(t => `${t} near ${params.lat},${params.lng}`),
    maxCrawledPlacesPerSearch: 20,
    language: 'en',
    deeperCityScrape: false,
  })
  return items as RawApifyPlace[]
}

export async function runGoogleMapsReviewsScraper(placeIds: string[]): Promise<Array<{
  placeId: string
  reviews: Array<{ text: string; rating: number; name: string; publishedAtDate: string }>
}>> {
  if (placeIds.length === 0) return []
  const items = await runActor('compass/google-maps-reviews-scraper', {
    placeIds,
    maxReviewsPerPlace: 10,
    language: 'en',
  })
  return items as Array<{ placeId: string; reviews: Array<{ text: string; rating: number; name: string; publishedAtDate: string }> }>
}

export async function runTripAdvisorScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  const items = await runActor('maxcopell/tripadvisor-scraper', {
    locationFullName: `${params.lat},${params.lng}`,
    includeAttractions: true,
    includeHotels: true,
    includeRestaurants: true,
    maxItemsPerQuery: 20,
  })
  return items as RawApifyPlace[]
}

export async function runEventbriteScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  const items = await runActor('zuzka/eventbrite-scraper', {
    lat: params.lat,
    lng: params.lng,
    radius: '10km',
    startDate: new Date().toISOString().split('T')[0],
  })
  return items as RawApifyPlace[]
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test src/__tests__/lib/apify.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/apify.ts src/__tests__/lib/apify.test.ts
git commit -m "feat: add Apify client wrapper for Google Maps, TripAdvisor, Eventbrite scrapers"
```

---

## Task 9: BullMQ Queue Definition

**Files:**
- Create: `src/lib/queue.ts`

- [ ] **Step 1: Write `src/lib/queue.ts`**

```typescript
import { Queue } from 'bullmq'
import { getRedis } from './redis'
import type { ScrapeLocationJobData } from '@/types'

export const SCRAPE_QUEUE = 'scrape-location'

let scrapeQueue: Queue<ScrapeLocationJobData> | null = null

export function getScrapeQueue(): Queue<ScrapeLocationJobData> {
  if (!scrapeQueue) {
    scrapeQueue = new Queue<ScrapeLocationJobData>(SCRAPE_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  }
  return scrapeQueue
}

export async function enqueueScrapeJob(data: ScrapeLocationJobData): Promise<string> {
  const queue = getScrapeQueue()
  const job = await queue.add('scrape', data, {
    jobId: data.jobId,
    deduplication: { id: data.jobId },
  })
  return job.id ?? data.jobId
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queue.ts
git commit -m "feat: add BullMQ queue definition for scrape-location jobs"
```

---

## Task 10: Place Merge / Dedup Logic (TDD)

**Files:**
- Create: `src/worker/merge-places.ts`, `src/__tests__/worker/merge-places.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { mergePlaces } from '@/worker/merge-places'
import type { RawApifyPlace } from '@/types'

const base: RawApifyPlace = {
  title: 'Grand Cafe',
  latitude: 51.2093,
  longitude: 3.2247,
  totalScore: 4.5,
  reviewsCount: 200,
  address: 'Market Square 1',
  placeId: 'gm_001',
}

describe('mergePlaces', () => {
  it('keeps a single place as-is', () => {
    const result = mergePlaces([base])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Grand Cafe')
  })

  it('deduplicates places within 50m with same name', () => {
    const nearby: RawApifyPlace = {
      ...base,
      latitude: 51.20931,  // ~1m away
      longitude: 3.22471,
      placeId: 'ta_001',
    }
    const result = mergePlaces([base, nearby])
    expect(result).toHaveLength(1)
  })

  it('keeps distinct places more than 50m apart', () => {
    const farAway: RawApifyPlace = {
      ...base,
      title: 'Another Cafe',
      latitude: 51.2200,
      longitude: 3.2400,
      placeId: 'gm_002',
    }
    const result = mergePlaces([base, farAway])
    expect(result).toHaveLength(2)
  })

  it('normalises missing name from title field', () => {
    const result = mergePlaces([{ ...base, title: 'Title Place', name: undefined }])
    expect(result[0].name).toBe('Title Place')
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test src/__tests__/worker/merge-places.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `src/worker/merge-places.ts`**

```typescript
import { arePlacesClose } from '@/lib/geo'
import type { RawApifyPlace } from '@/types'

export interface NormalisedPlace {
  name: string
  latitude: number
  longitude: number
  rating: number | null
  review_count: number | null
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: Record<string, string> | null
  photos: string[] | null
  external_id: string | null
  category: string | null
}

function normalise(raw: RawApifyPlace): NormalisedPlace {
  return {
    name: raw.name ?? raw.title ?? 'Unknown',
    latitude: raw.latitude ?? 0,
    longitude: raw.longitude ?? 0,
    rating: raw.totalScore ?? raw.rating ?? null,
    review_count: raw.reviewsCount ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    opening_hours: raw.openingHours
      ? Object.fromEntries(raw.openingHours.map(h => [h.day, h.hours]))
      : null,
    photos: raw.imageUrls ?? null,
    external_id: raw.placeId ?? null,
    category: raw.categoryName ?? null,
  }
}

function isDuplicate(a: NormalisedPlace, b: NormalisedPlace): boolean {
  const sameName = a.name.toLowerCase().trim() === b.name.toLowerCase().trim()
  const closeEnough = arePlacesClose(a.latitude, a.longitude, b.latitude, b.longitude)
  return sameName && closeEnough
}

export function mergePlaces(rawPlaces: RawApifyPlace[]): NormalisedPlace[] {
  const normalised = rawPlaces
    .filter(p => p.latitude && p.longitude)
    .map(normalise)

  const merged: NormalisedPlace[] = []

  for (const place of normalised) {
    const existingIndex = merged.findIndex(m => isDuplicate(m, place))
    if (existingIndex === -1) {
      merged.push(place)
    } else {
      // Keep whichever has more reviews (richer data)
      const existing = merged[existingIndex]
      if ((place.review_count ?? 0) > (existing.review_count ?? 0)) {
        merged[existingIndex] = place
      }
    }
  }

  return merged
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test src/__tests__/worker/merge-places.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/merge-places.ts src/__tests__/worker/merge-places.test.ts
git commit -m "feat: add place merge/dedup logic with 50m proximity threshold"
```

---

## Task 11: DeepSeek Batch Enrichment Worker Function (TDD)

**Files:**
- Create: `src/worker/enrich-places.ts`, `src/__tests__/worker/enrich-places.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { enrichInBatches } from '@/worker/enrich-places'
import * as ai from '@/lib/ai'

jest.mock('@/lib/ai')

describe('enrichInBatches', () => {
  it('calls enrichPlaces in batches of 10', async () => {
    const mockEnrich = ai.enrichPlaces as jest.Mock
    mockEnrich.mockResolvedValue(
      Array(10).fill({
        summary: 'Nice place',
        pros: [],
        cons: [],
        best_for: [],
        visit_duration: '1 hour',
        hidden_gem_score: 50,
        tourist_trap_score: 30,
      })
    )

    const places = Array(15).fill({
      name: 'Test Place',
      type: 'attraction',
      rating: 4.0,
      reviews: [],
    })

    const result = await enrichInBatches(places)

    expect(mockEnrich).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(15)
  })

  it('returns empty array for empty input', async () => {
    const result = await enrichInBatches([])
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test src/__tests__/worker/enrich-places.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `src/worker/enrich-places.ts`**

```typescript
import { enrichPlaces, PlaceEnrichment, PlaceInput } from '@/lib/ai'

const BATCH_SIZE = 10

export async function enrichInBatches(places: PlaceInput[]): Promise<PlaceEnrichment[]> {
  if (places.length === 0) return []

  const results: PlaceEnrichment[] = []

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE)
    const enriched = await enrichPlaces(batch)
    results.push(...enriched)
  }

  return results
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test src/__tests__/worker/enrich-places.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/enrich-places.ts src/__tests__/worker/enrich-places.test.ts
git commit -m "feat: add batched DeepSeek enrichment for places (10 per request)"
```

---

## Task 12: Scrape Location Job Processor

**Files:**
- Create: `src/worker/processor.ts`

- [ ] **Step 1: Write `src/worker/processor.ts`**

```typescript
import { Job } from 'bullmq'
import { getRedis } from '@/lib/redis'
import { query } from '@/lib/db'
import { toGeohash } from '@/lib/geo'
import {
  runGoogleMapsScraper,
  runGoogleMapsReviewsScraper,
  runTripAdvisorScraper,
  runEventbriteScraper,
} from '@/lib/apify'
import { mergePlaces } from './merge-places'
import { enrichInBatches } from './enrich-places'
import type { ScrapeLocationJobData } from '@/types'

const DEDUP_TTL = 86_400       // 24 hours in seconds
const JOB_STATUS_TTL = 7_200   // 2 hours

async function setProgress(redis: ReturnType<typeof getRedis>, jobId: string, pct: number) {
  await redis.setex(`job:${jobId}:status`, JOB_STATUS_TTL, pct.toString())
}

export async function processScrapeLocation(job: Job<ScrapeLocationJobData>) {
  const { jobId, lat, lng, radius } = job.data
  const redis = getRedis()
  const geohash = toGeohash(lat, lng)
  const lockKey = `scrape:lock:${geohash}`

  // Mark job as started in DB
  await query(
    `UPDATE scrape_jobs SET status = 'running', started_at = now() WHERE id = $1`,
    [jobId]
  )
  await setProgress(redis, jobId, 5)

  // Dedup check
  const existing = await redis.get(lockKey)
  if (existing) {
    await query(
      `UPDATE scrape_jobs SET status = 'completed', completed_at = now(), places_found = 0 WHERE id = $1`,
      [jobId]
    )
    await setProgress(redis, jobId, 100)
    return
  }

  // Run all Apify scrapers in parallel
  const [googlePlaces, tripAdvisorPlaces, eventbritePlaces] = await Promise.all([
    runGoogleMapsScraper({ lat, lng, radius }).catch(() => []),
    runTripAdvisorScraper({ lat, lng }).catch(() => []),
    runEventbriteScraper({ lat, lng }).catch(() => []),
  ])
  await setProgress(redis, jobId, 40)

  // Fetch reviews for top Google Maps places
  const topPlaceIds = googlePlaces
    .filter(p => p.placeId)
    .slice(0, 20)
    .map(p => p.placeId!)

  const reviewData = await runGoogleMapsReviewsScraper(topPlaceIds).catch(() => [])
  await setProgress(redis, jobId, 55)

  // Merge all places
  const allRaw = [...googlePlaces, ...tripAdvisorPlaces]
  const merged = mergePlaces(allRaw)
  await setProgress(redis, jobId, 65)

  // Build review map
  const reviewMap = new Map<string, string[]>()
  for (const rd of reviewData) {
    reviewMap.set(rd.placeId, rd.reviews.slice(0, 5).map(r => r.text).filter(Boolean))
  }

  // Enrich with DeepSeek
  const placesForAI = merged.map(p => ({
    name: p.name,
    type: 'attraction' as const,
    rating: p.rating,
    reviews: reviewMap.get(p.external_id ?? '') ?? [],
  }))
  const enrichments = await enrichInBatches(placesForAI)
  await setProgress(redis, jobId, 85)

  // Upsert places to DB
  for (let i = 0; i < merged.length; i++) {
    const p = merged[i]
    const e = enrichments[i]
    await query(
      `INSERT INTO places
        (name, type, category, latitude, longitude, rating, review_count,
         address, phone, website, opening_hours, photos, source, external_id,
         summary, pros, cons, best_for, visit_duration,
         hidden_gem_score, tourist_trap_score, ai_processed_at, scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET
         rating = EXCLUDED.rating,
         summary = EXCLUDED.summary,
         pros = EXCLUDED.pros,
         cons = EXCLUDED.cons,
         best_for = EXCLUDED.best_for,
         hidden_gem_score = EXCLUDED.hidden_gem_score,
         tourist_trap_score = EXCLUDED.tourist_trap_score,
         ai_processed_at = now(),
         scraped_at = now(),
         updated_at = now()`,
      [
        p.name, 'attraction', p.category,
        p.latitude, p.longitude, p.rating, p.review_count,
        p.address, p.phone, p.website,
        JSON.stringify(p.opening_hours), JSON.stringify(p.photos),
        'google_maps', p.external_id,
        e?.summary ?? null, JSON.stringify(e?.pros ?? []),
        JSON.stringify(e?.cons ?? []), JSON.stringify(e?.best_for ?? []),
        e?.visit_duration ?? null, e?.hidden_gem_score ?? null, e?.tourist_trap_score ?? null,
      ]
    )
  }

  // Handle events separately
  for (const ev of eventbritePlaces) {
    if (!ev.title && !ev.name) continue
    await query(
      `INSERT INTO places (name, type, category, latitude, longitude, source, external_id, address, scraped_at)
       VALUES ($1,'event','event',$2,$3,'eventbrite',$4,$5,now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING`,
      [ev.name ?? ev.title, ev.latitude ?? lat, ev.longitude ?? lng, ev.placeId ?? null, ev.address ?? null]
    )
  }

  // Set dedup lock and finish
  await redis.setex(lockKey, DEDUP_TTL, '1')
  await query(
    `UPDATE scrape_jobs SET status = 'completed', completed_at = now(), places_found = $1 WHERE id = $2`,
    [merged.length, jobId]
  )
  await setProgress(redis, jobId, 100)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/worker/processor.ts
git commit -m "feat: add scrape-location BullMQ job processor"
```

---

## Task 13: Worker Entrypoint

**Files:**
- Create: `worker.ts` (project root)

- [ ] **Step 1: Write `worker.ts`**

```typescript
import 'dotenv/config'
import { Worker } from 'bullmq'
import { getRedis } from './src/lib/redis'
import { processScrapeLocation } from './src/worker/processor'
import { SCRAPE_QUEUE } from './src/lib/queue'

console.log('Worker starting...')

const worker = new Worker(
  SCRAPE_QUEUE,
  async job => {
    console.log(`Processing job ${job.id} (${job.name})`)
    await processScrapeLocation(job)
    console.log(`Completed job ${job.id}`)
  },
  {
    connection: getRedis(),
    concurrency: 2,
  }
)

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})

worker.on('error', err => {
  console.error('Worker error:', err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
```

- [ ] **Step 2: Install dotenv**

```bash
npm install dotenv
```

- [ ] **Step 3: Test worker starts (requires Docker services running)**

```bash
npm run worker
```
Expected: `Worker starting...` — no crash.  
Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add worker.ts
git commit -m "feat: add BullMQ worker entrypoint"
```

---

## Task 14: API — POST /api/location

**Files:**
- Create: `src/app/api/location/route.ts`

- [ ] **Step 1: Write `src/app/api/location/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { enqueueScrapeJob } from '@/lib/queue'
import { toGeohash } from '@/lib/geo'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, radius = 5000 } = await req.json()

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 })
    }

    const jobId = randomUUID()
    const geohash = toGeohash(lat, lng)

    // Create DB record for tracking
    await query(
      `INSERT INTO scrape_jobs (id, lat, lng, radius) VALUES ($1, $2, $3, $4)`,
      [jobId, lat, lng, radius]
    )

    // Enqueue background scrape
    await enqueueScrapeJob({ jobId, lat, lng, radius })

    return NextResponse.json({ jobId, geohash })
  } catch (err) {
    console.error('/api/location error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test with curl (requires Docker running)**

```bash
curl -X POST http://localhost:3000/api/location \
  -H "Content-Type: application/json" \
  -d '{"lat": 51.2093, "lng": 3.2247}'
```
Expected: `{"jobId":"<uuid>","geohash":"u14dpu"}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/location/
git commit -m "feat: add POST /api/location — enqueues scrape job"
```

---

## Task 15: API — GET /api/nearby

**Files:**
- Create: `src/app/api/nearby/route.ts`

- [ ] **Step 1: Write `src/app/api/nearby/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { toGeohash } from '@/lib/geo'
import type { Place } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseInt(searchParams.get('radius') ?? '5000', 10)
  const type = searchParams.get('type') ?? null

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const redis = getRedis()
  const cacheKey = `places:${toGeohash(lat, lng)}:${radius}:${type ?? 'all'}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    return NextResponse.json({ places: JSON.parse(cached), cached: true })
  }

  const params: unknown[] = [lng, lat, radius]
  let typeFilter = ''
  if (type) {
    params.push(type)
    typeFilter = `AND type = $${params.length}`
  }

  const places = await query<Place>(
    `SELECT *,
       ST_Distance(location::geography, ST_MakePoint($1, $2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1, $2)::geography, $3)
       ${typeFilter}
     ORDER BY distance_m ASC
     LIMIT 100`,
    params
  )

  await redis.setex(cacheKey, 3_600, JSON.stringify(places))

  return NextResponse.json({ places, cached: false })
}
```

- [ ] **Step 2: Test with curl**

```bash
curl "http://localhost:3000/api/nearby?lat=51.2093&lng=3.2247&radius=5000"
```
Expected: `{"places":[],"cached":false}` (empty initially, places appear after worker runs)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/nearby/
git commit -m "feat: add GET /api/nearby with PostGIS radius search and Redis cache"
```

---

## Task 16: API — GET /api/job-status/[id]

**Files:**
- Create: `src/app/api/job-status/[id]/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { query } from '@/lib/db'
import type { ScrapeJob } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const redis = getRedis()

  const progress = await redis.get(`job:${id}:status`)
  const [job] = await query<ScrapeJob>(
    `SELECT * FROM scrape_jobs WHERE id = $1`,
    [id]
  )

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    jobId: id,
    status: job.status,
    progress: progress ? parseInt(progress, 10) : 0,
    placesFound: job.places_found,
    completedAt: job.completed_at,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/job-status/
git commit -m "feat: add GET /api/job-status/[id] for polling scrape progress"
```

---

## Task 17: API — GET /api/area-briefing

**Files:**
- Create: `src/app/api/area-briefing/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateAreaBriefing } from '@/lib/ai'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const city = searchParams.get('city') ?? 'your area'
  const district = searchParams.get('district') ?? ''

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const [counts] = await query<{ attractions: string; restaurants: string; events: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE type = 'attraction') AS attractions,
       COUNT(*) FILTER (WHERE type = 'restaurant') AS restaurants,
       COUNT(*) FILTER (WHERE type = 'event') AS events
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1, $2)::geography, 5000)`,
    [lng, lat]
  )

  const briefing = await generateAreaBriefing({
    city,
    district,
    attractionCount: parseInt(counts?.attractions ?? '0', 10),
    restaurantCount: parseInt(counts?.restaurants ?? '0', 10),
    eventCount: parseInt(counts?.events ?? '0', 10),
  })

  return NextResponse.json({ briefing })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/area-briefing/
git commit -m "feat: add GET /api/area-briefing — AI-generated location summary"
```

---

## Task 18: API — POST /api/recommendations, /api/itinerary, /api/chat

**Files:**
- Create: `src/app/api/recommendations/route.ts`, `src/app/api/itinerary/route.ts`, `src/app/api/chat/route.ts`

- [ ] **Step 1: Write `src/app/api/recommendations/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateRecommendations } from '@/lib/ai'
import type { Place } from '@/types'

export async function POST(req: NextRequest) {
  const { lat, lng, timeOfDay, preferences } = await req.json()

  const places = await query<Place>(
    `SELECT name, type, summary,
       ST_Distance(location::geography, ST_MakePoint($1,$2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1,$2)::geography, 5000)
     ORDER BY distance_m LIMIT 30`,
    [lng, lat]
  )

  const recommendations = await generateRecommendations({
    city: 'the area',
    timeOfDay: timeOfDay ?? new Date().toLocaleTimeString(),
    preferences: preferences ?? {},
    places: places.map(p => ({ name: p.name, type: p.type, summary: p.summary })),
  })

  return NextResponse.json({ recommendations })
}
```

- [ ] **Step 2: Write `src/app/api/itinerary/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateItinerary } from '@/lib/ai'
import { getRedis } from '@/lib/redis'
import type { Place } from '@/types'

const RATE_LIMIT = 10
const WINDOW = 3_600

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('session_id')?.value ?? 'anon'
  const redis = getRedis()
  const rateLimitKey = `rate:itinerary:${sessionId}`
  const count = await redis.incr(rateLimitKey)
  if (count === 1) await redis.expire(rateLimitKey, WINDOW)
  if (count > RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { lat, lng, durationHours, preferences, city } = await req.json()

  const places = await query<Place>(
    `SELECT name, type, visit_duration, address,
       ST_Distance(location::geography, ST_MakePoint($1,$2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1,$2)::geography, 5000)
     ORDER BY (hidden_gem_score + (5 - tourist_trap_score/20)) DESC NULLS LAST
     LIMIT 20`,
    [lng, lat]
  )

  const itinerary = await generateItinerary({
    city: city ?? 'the area',
    durationHours: durationHours ?? 4,
    preferences: preferences ?? {},
    places: places.map(p => ({
      name: p.name, type: p.type,
      visit_duration: p.visit_duration, address: p.address,
    })),
  })

  await query(
    `INSERT INTO itineraries (session_id, title, content, duration_hours, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, itinerary.title, JSON.stringify(itinerary), durationHours, lat, lng]
  )

  return NextResponse.json(itinerary)
}
```

- [ ] **Step 3: Write `src/app/api/chat/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

export async function POST(req: NextRequest) {
  const { message, locationContext, history } = await req.json()

  const systemPrompt = `You are a knowledgeable travel assistant. The user is currently in ${locationContext?.city ?? 'an unknown location'}, ${locationContext?.country ?? ''}.
Help them discover great experiences, answer travel questions, and suggest what to do.
Be concise, friendly, and specific to their location.`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []),
    { role: 'user', content: message },
  ]

  const stream = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages,
    stream: true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/recommendations/ src/app/api/itinerary/ src/app/api/chat/
git commit -m "feat: add AI API routes — recommendations, itinerary generation, streaming chat"
```

---

## Task 19: Frontend Hooks

**Files:**
- Create: `src/hooks/useLocation.ts`, `src/hooks/useLocalStorage.ts`, `src/hooks/useNearby.ts`, `src/hooks/useJobStatus.ts`

- [ ] **Step 1: Write `src/hooks/useLocalStorage.ts`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import type { UserPreferences, SavedPlaces } from '@/types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  foodie: false, history: false, nature: false,
  nightlife: false, budget: false, luxury: false,
}

export const DEFAULT_SAVED: SavedPlaces = {
  wishlist: [], visited: [], favorites: [],
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) setValue(JSON.parse(stored))
    } catch {}
  }, [key])

  function set(newValue: T) {
    setValue(newValue)
    try { localStorage.setItem(key, JSON.stringify(newValue)) } catch {}
  }

  return [value, set] as const
}

export function usePreferences() {
  return useLocalStorage<UserPreferences>('preferences', DEFAULT_PREFERENCES)
}

export function useSavedPlaces() {
  return useLocalStorage<SavedPlaces>('saved', DEFAULT_SAVED)
}
```

- [ ] **Step 2: Write `src/hooks/useLocation.ts`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import type { UserLocation } from '@/types'

interface LocationState {
  location: UserLocation | null
  jobId: string | null
  loading: boolean
  error: string | null
}

async function reverseGeocode(lat: number, lng: number): Promise<Partial<UserLocation>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  const addr = data.address ?? {}
  return {
    country: addr.country ?? '',
    city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? '',
    district: addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? '',
  }
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null, jobId: null, loading: true, error: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: 'Geolocation not supported' }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        const geo = await reverseGeocode(latitude, longitude).catch(() => ({}))

        const location: UserLocation = {
          latitude, longitude,
          country: geo.country ?? '',
          city: geo.city ?? '',
          district: geo.district ?? '',
        }

        // Trigger background scrape
        const res = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        }).catch(() => null)

        const { jobId } = res ? await res.json() : {}

        setState({ location, jobId: jobId ?? null, loading: false, error: null })

        // Cache last location
        try { localStorage.setItem('lastLocation', JSON.stringify({ ...location, scrapedAt: new Date().toISOString() })) } catch {}
      },
      err => {
        setState(s => ({ ...s, loading: false, error: err.message }))
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  return state
}
```

- [ ] **Step 3: Write `src/hooks/useJobStatus.ts`**

```typescript
'use client'
import { useState, useEffect, useRef } from 'react'

interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | null
  progress: number
  placesFound: number | null
}

export function useJobStatus(jobId: string | null) {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    status: null, progress: 0, placesFound: null,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/job-status/${jobId}`)
        const data = await res.json()
        setJobStatus({
          status: data.status,
          progress: data.progress ?? 0,
          placesFound: data.placesFound,
        })
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 3_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobId])

  return jobStatus
}
```

- [ ] **Step 4: Write `src/hooks/useNearby.ts`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import type { Place } from '@/types'

export function useNearby(
  lat: number | null,
  lng: number | null,
  radius = 5000,
  type?: string,
  refreshTrigger = 0
) {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat == null || lng == null) return
    setLoading(true)

    const url = new URL('/api/nearby', window.location.origin)
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lng', lng.toString())
    url.searchParams.set('radius', radius.toString())
    if (type) url.searchParams.set('type', type)

    fetch(url.toString())
      .then(r => r.json())
      .then(data => setPlaces(data.places ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lng, radius, type, refreshTrigger])

  return { places, loading }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add hooks for GPS location, job status polling, nearby places, localStorage"
```

---

## Task 20: Shared UI Components

**Files:**
- Create: `src/components/PlaceCard.tsx`, `src/components/FilterBar.tsx`, `src/components/RadiusSelector.tsx`, `src/components/LoadingPulse.tsx`, `src/components/AreaBriefing.tsx`, `src/components/QuickActionGrid.tsx`, `src/components/ItineraryTimeline.tsx`

- [ ] **Step 1: Write `src/components/PlaceCard.tsx`**

```tsx
'use client'
import type { Place } from '@/types'
import { useSavedPlaces } from '@/hooks/useLocalStorage'

interface Props {
  place: Place
  showDistance?: boolean
}

export function PlaceCard({ place, showDistance = true }: Props) {
  const [saved, setSaved] = useSavedPlaces()

  function toggleSave() {
    const id = place.id
    const inFav = saved.favorites.includes(id)
    setSaved({
      ...saved,
      favorites: inFav
        ? saved.favorites.filter(x => x !== id)
        : [...saved.favorites, id],
    })
  }

  const isSaved = saved.favorites.includes(place.id)
  const distText = place.distance_m != null
    ? place.distance_m < 1000
      ? `${Math.round(place.distance_m)}m`
      : `${(place.distance_m / 1000).toFixed(1)}km`
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      {place.photos?.[0] && (
        <img
          src={place.photos[0]}
          alt={place.name}
          className="w-full h-40 object-cover rounded-xl"
        />
      )}
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-gray-900 text-base leading-tight flex-1 pr-2">
          {place.name}
        </h3>
        <button onClick={toggleSave} className="text-xl">
          {isSaved ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-500">
        {place.rating && (
          <span className="flex items-center gap-1">
            ⭐ {place.rating.toFixed(1)}
            {place.review_count && <span>({place.review_count})</span>}
          </span>
        )}
        {showDistance && distText && <span>📍 {distText}</span>}
        {place.visit_duration && <span>⏱ {place.visit_duration}</span>}
      </div>

      {place.summary && (
        <p className="text-sm text-gray-600 line-clamp-2">{place.summary}</p>
      )}

      <div className="flex gap-2 flex-wrap mt-1">
        {place.hidden_gem_score != null && place.hidden_gem_score > 60 && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            💎 Hidden Gem
          </span>
        )}
        {place.tourist_trap_score != null && place.tourist_trap_score > 65 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
            ⚠️ Tourist Trap
          </span>
        )}
        {place.price_level != null && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {'$'.repeat(place.price_level)}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/FilterBar.tsx`**

```tsx
'use client'

interface Props {
  options: string[]
  active: string[]
  onChange: (active: string[]) => void
}

export function FilterBar({ options, active, onChange }: Props) {
  function toggle(opt: string) {
    onChange(
      active.includes(opt) ? active.filter(x => x !== opt) : [...active, opt]
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => toggle(opt)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active.includes(opt)
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/RadiusSelector.tsx`**

```tsx
'use client'

const OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '5km', value: 5000 },
  { label: '10km', value: 10000 },
  { label: '25km', value: 25000 },
]

interface Props {
  value: number
  onChange: (value: number) => void
}

export function RadiusSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/LoadingPulse.tsx`**

```tsx
interface Props {
  progress: number
  message?: string
}

export function LoadingPulse({ progress, message }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 animate-pulse">
        {message ?? 'Discovering nearby places…'}
      </p>
      <p className="text-xs text-gray-400">{progress}%</p>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/AreaBriefing.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Props {
  lat: number
  lng: number
  city: string
  district: string
}

export function AreaBriefing({ lat, lng, city, district }: Props) {
  const [briefing, setBriefing] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL('/api/area-briefing', window.location.origin)
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lng', lng.toString())
    url.searchParams.set('city', city)
    url.searchParams.set('district', district)

    fetch(url.toString())
      .then(r => r.json())
      .then(d => setBriefing(d.briefing))
      .catch(() => {})
  }, [lat, lng, city, district])

  if (!briefing) {
    return <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <p className="text-sm text-indigo-800 leading-relaxed">{briefing}</p>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/QuickActionGrid.tsx`**

```tsx
import Link from 'next/link'

const ACTIONS = [
  { label: 'Things To Do', icon: '🎯', href: '/explore/things-to-do' },
  { label: 'Restaurants', icon: '🍽️', href: '/explore/restaurants' },
  { label: 'Attractions', icon: '🏛️', href: '/explore/attractions' },
  { label: 'Events Today', icon: '🎉', href: '/explore/events' },
  { label: 'Hidden Gems', icon: '💎', href: '/explore/hidden-gems' },
  { label: 'Scenic Views', icon: '🌅', href: '/explore/scenic-views' },
  { label: 'Walking Tours', icon: '🚶', href: '/itinerary' },
  { label: 'Hotels Nearby', icon: '🏨', href: '/explore/hotels' },
]

export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {ACTIONS.map(action => (
        <Link
          key={action.href}
          href={action.href}
          className="flex flex-col items-center gap-1 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors"
        >
          <span className="text-2xl">{action.icon}</span>
          <span className="text-xs text-gray-600 text-center leading-tight font-medium">
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Write `src/components/ItineraryTimeline.tsx`**

```tsx
import type { ItineraryStop } from '@/types'

interface Props {
  stops: ItineraryStop[]
}

export function ItineraryTimeline({ stops }: Props) {
  return (
    <div className="flex flex-col gap-0">
      {stops.map((stop, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
            {idx < stops.length - 1 && (
              <div className="w-0.5 bg-indigo-200 flex-1 my-1" />
            )}
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-indigo-600 font-semibold">{stop.time}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{stop.duration}</span>
            </div>
            <p className="font-medium text-gray-900 text-sm">{stop.name}</p>
            {stop.notes && <p className="text-xs text-gray-500 mt-0.5">{stop.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/
git commit -m "feat: add shared UI components — PlaceCard, FilterBar, RadiusSelector, etc."
```

---

## Task 21: App Layout + Dashboard Page

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Location Advisor',
  description: 'AI-powered travel concierge',
  manifest: '/manifest.json',
  themeColor: '#4f46e5',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen max-w-md mx-auto`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Write `src/app/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { useJobStatus } from '@/hooks/useJobStatus'
import { useNearby } from '@/hooks/useNearby'
import { usePreferences } from '@/hooks/useLocalStorage'
import { AreaBriefing } from '@/components/AreaBriefing'
import { QuickActionGrid } from '@/components/QuickActionGrid'
import { PlaceCard } from '@/components/PlaceCard'
import { LoadingPulse } from '@/components/LoadingPulse'
import { RadiusSelector } from '@/components/RadiusSelector'

export default function DashboardPage() {
  const { location, jobId, loading: locLoading, error } = useLocation()
  const jobStatus = useJobStatus(jobId)
  const [radius, setRadius] = useState(5000)
  const [preferences] = usePreferences()

  const jobDone = jobStatus.status === 'completed' || jobStatus.status === 'failed'
  const { places, loading: placesLoading } = useNearby(
    location?.latitude ?? null,
    location?.longitude ?? null,
    radius,
    undefined,
    jobDone ? 1 : 0
  )

  if (locLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-3xl animate-pulse">
          📍
        </div>
        <p className="text-gray-500 text-sm">Detecting your location…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6">
        <p className="text-2xl">⚠️</p>
        <p className="text-gray-700 text-center text-sm">{error}</p>
        <p className="text-gray-400 text-xs text-center">
          Enable location access and reload the page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {location?.city ?? 'Nearby'}
          </h1>
          <p className="text-xs text-gray-400">{location?.district}</p>
        </div>
        <span className="text-2xl">🗺️</span>
      </div>

      {/* Area Briefing */}
      {location && (
        <AreaBriefing
          lat={location.latitude}
          lng={location.longitude}
          city={location.city}
          district={location.district}
        />
      )}

      {/* Scrape progress */}
      {jobId && !jobDone && (
        <LoadingPulse
          progress={jobStatus.progress}
          message="Finding the best spots nearby…"
        />
      )}

      {/* Quick actions */}
      <QuickActionGrid />

      {/* Radius selector */}
      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Search radius</p>
        <RadiusSelector value={radius} onChange={setRadius} />
      </div>

      {/* Top picks */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Top Picks</h2>
        {placesLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {jobDone ? 'No places found nearby. Try a larger radius.' : 'Places loading in background…'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {places.slice(0, 6).map(place => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/page.tsx
git commit -m "feat: add app layout and dashboard page"
```

---

## Task 22: Explore Pages

**Files:**
- Create: `src/app/explore/things-to-do/page.tsx`, `src/app/explore/restaurants/page.tsx`, `src/app/explore/attractions/page.tsx`, `src/app/explore/events/page.tsx`, `src/app/explore/hidden-gems/page.tsx`, `src/app/explore/scenic-views/page.tsx`, `src/app/explore/hotels/page.tsx`, `src/app/explore/local-essentials/page.tsx`

- [ ] **Step 1: Create shared explore layout helper `src/app/explore/ExplorePage.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { useNearby } from '@/hooks/useNearby'
import { PlaceCard } from '@/components/PlaceCard'
import { FilterBar } from '@/components/FilterBar'
import { RadiusSelector } from '@/components/RadiusSelector'
import Link from 'next/link'
import type { Place } from '@/types'

interface Props {
  title: string
  icon: string
  type?: string
  filterOptions?: string[]
  filterFn?: (place: Place, active: string[]) => boolean
  emptyMessage?: string
}

export function ExplorePage({ title, icon, type, filterOptions = [], filterFn, emptyMessage }: Props) {
  const { location } = useLocation()
  const [radius, setRadius] = useState(5000)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const { places, loading } = useNearby(
    location?.latitude ?? null, location?.longitude ?? null, radius, type
  )

  const filtered = filterFn && activeFilters.length > 0
    ? places.filter(p => filterFn(p, activeFilters))
    : places

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-bold text-gray-900">{icon} {title}</h1>
      </div>

      <RadiusSelector value={radius} onChange={setRadius} />

      {filterOptions.length > 0 && (
        <FilterBar options={filterOptions} active={activeFilters} onChange={setActiveFilters} />
      )}

      {loading ? (
        <div className="flex flex-col gap-3 mt-2">
          {[1, 2, 3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {emptyMessage ?? `No ${title.toLowerCase()} found nearby.`}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(p => <PlaceCard key={p.id} place={p} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/explore/things-to-do/page.tsx`**

```tsx
import { ExplorePage } from '../ExplorePage'
import type { Place } from '@/types'

const FILTERS = ['Family Friendly', 'Couples', 'Solo Travelers', 'Budget', 'Luxury', 'Indoor', 'Outdoor']

function filterFn(place: Place, active: string[]): boolean {
  return active.some(f => place.best_for?.some(b => b.toLowerCase().includes(f.toLowerCase())))
}

export default function ThingsToDoPage() {
  return (
    <ExplorePage
      title="Things To Do"
      icon="🎯"
      filterOptions={FILTERS}
      filterFn={filterFn}
    />
  )
}
```

- [ ] **Step 3: Write `src/app/explore/restaurants/page.tsx`**

```tsx
import { ExplorePage } from '../ExplorePage'

export default function RestaurantsPage() {
  return (
    <ExplorePage
      title="Restaurants"
      icon="🍽️"
      type="restaurant"
      filterOptions={['Open Now', 'Budget', 'Fine Dining', 'Local Cuisine', 'Fast Food']}
      emptyMessage="No restaurants found nearby. Try a larger radius."
    />
  )
}
```

- [ ] **Step 4: Write remaining explore pages** — create these files, each following the same pattern:

`src/app/explore/attractions/page.tsx`:
```tsx
import { ExplorePage } from '../ExplorePage'
export default function AttractionsPage() {
  return <ExplorePage title="Attractions" icon="🏛️" type="attraction" />
}
```

`src/app/explore/events/page.tsx`:
```tsx
import { ExplorePage } from '../ExplorePage'
export default function EventsPage() {
  return (
    <ExplorePage
      title="Events"
      icon="🎉"
      type="event"
      filterOptions={['Today', 'This Week', 'Free', 'Concerts', 'Festivals']}
      emptyMessage="No events found nearby."
    />
  )
}
```

`src/app/explore/hidden-gems/page.tsx`:
```tsx
'use client'
import { useLocation } from '@/hooks/useLocation'
import { useNearby } from '@/hooks/useNearby'
import { PlaceCard } from '@/components/PlaceCard'
import Link from 'next/link'

export default function HiddenGemsPage() {
  const { location } = useLocation()
  const { places, loading } = useNearby(location?.latitude ?? null, location?.longitude ?? null, 10000)
  const gems = places.filter(p => (p.hidden_gem_score ?? 0) > 60).sort((a, b) => (b.hidden_gem_score ?? 0) - (a.hidden_gem_score ?? 0))

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">💎 Hidden Gems</h1>
      </div>
      <p className="text-sm text-gray-500">Places the locals love, tourists haven't found yet.</p>
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i=><div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse"/>)}</div>
      ) : gems.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hidden gems found yet. Check back after the background scan completes.</div>
      ) : (
        <div className="flex flex-col gap-3">{gems.map(p=><PlaceCard key={p.id} place={p}/>)}</div>
      )}
    </div>
  )
}
```

`src/app/explore/scenic-views/page.tsx`:
```tsx
import { ExplorePage } from '../ExplorePage'
export default function ScenicViewsPage() {
  return (
    <ExplorePage
      title="Scenic Views"
      icon="🌅"
      filterOptions={['Sunset', 'Sunrise', 'Photography', 'Walking']}
      emptyMessage="No scenic viewpoints found nearby."
    />
  )
}
```

`src/app/explore/hotels/page.tsx`:
```tsx
import { ExplorePage } from '../ExplorePage'
export default function HotelsPage() {
  return <ExplorePage title="Hotels Nearby" icon="🏨" type="hotel" filterOptions={['Budget', 'Mid-range', 'Luxury']} />
}
```

`src/app/explore/local-essentials/page.tsx`:
```tsx
import { ExplorePage } from '../ExplorePage'
export default function LocalEssentialsPage() {
  return (
    <ExplorePage
      title="Local Essentials"
      icon="🏪"
      type="essential"
      emptyMessage="No essentials found nearby."
    />
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/explore/
git commit -m "feat: add all explore pages (things-to-do, restaurants, attractions, events, hidden-gems, scenic-views, hotels, essentials)"
```

---

## Task 23: Itinerary, Saved, and Chat Pages

**Files:**
- Create: `src/app/itinerary/page.tsx`, `src/app/saved/page.tsx`, `src/app/chat/page.tsx`

- [ ] **Step 1: Write `src/app/itinerary/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { usePreferences } from '@/hooks/useLocalStorage'
import { ItineraryTimeline } from '@/components/ItineraryTimeline'
import Link from 'next/link'
import type { Itinerary } from '@/types'

const DURATIONS = [
  { label: '1 Hour', value: 1 },
  { label: '2 Hours', value: 2 },
  { label: 'Half Day', value: 4 },
  { label: 'Full Day', value: 8 },
]

export default function ItineraryPage() {
  const { location } = useLocation()
  const [preferences] = usePreferences()
  const [duration, setDuration] = useState(4)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!location) return
    setLoading(true)
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.latitude,
          lng: location.longitude,
          durationHours: duration,
          preferences,
          city: location.city,
        }),
      })
      const data = await res.json()
      setItinerary(data)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">🗓️ Plan My Day</h1>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-3">How long do you have?</p>
        <div className="grid grid-cols-2 gap-2">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                duration === d.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading || !location}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Generating…' : 'Generate Itinerary ✨'}
      </button>

      {itinerary && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">{itinerary.title}</h2>
          <ItineraryTimeline stops={itinerary.content?.stops ?? []} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/saved/page.tsx`**

```tsx
'use client'
import { useSavedPlaces } from '@/hooks/useLocalStorage'
import Link from 'next/link'

export default function SavedPage() {
  const [saved, setSaved] = useSavedPlaces()

  const tabs = [
    { key: 'favorites' as const, label: 'Favorites', icon: '❤️' },
    { key: 'wishlist' as const, label: 'Wishlist', icon: '🔖' },
    { key: 'visited' as const, label: 'Visited', icon: '✅' },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">🗂️ Saved Places</h1>
      </div>

      {tabs.map(tab => (
        <div key={tab.key}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {tab.icon} {tab.label} ({saved[tab.key].length})
          </h2>
          {saved[tab.key].length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Nothing saved yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {saved[tab.key].map(id => (
                <div key={id} className="bg-white rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-mono text-xs">{id.slice(0, 8)}…</span>
                  <button
                    onClick={() => setSaved({ ...saved, [tab.key]: saved[tab.key].filter(x => x !== id) })}
                    className="text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/chat/page.tsx`**

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from '@/hooks/useLocation'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const { location } = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMsg,
        locationContext: location,
        history: messages.slice(-6),
      }),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      fullText += decoder.decode(value)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: fullText }
        return updated
      })
    }

    setStreaming(false)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-base font-bold text-gray-900">🤖 Travel Assistant</h1>
        {location && <span className="text-xs text-gray-400 ml-auto">{location.city}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🗺️</p>
            <p className="text-gray-500 text-sm">Ask me anything about your surroundings.</p>
            <p className="text-gray-400 text-xs mt-1">"What should I do for the next 2 hours?"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content || (streaming && msg.role === 'assistant' ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-100 bg-white flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask your travel assistant…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/itinerary/ src/app/saved/ src/app/chat/
git commit -m "feat: add itinerary, saved places, and streaming chat pages"
```

---

## Task 24: PWA Setup

**Files:**
- Modify: `next.config.ts`
- Create: `public/manifest.json`

- [ ] **Step 1: Write `public/manifest.json`**

```json
{
  "name": "Location Advisor",
  "short_name": "Advisor",
  "description": "AI-powered travel concierge",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f9fafb",
  "theme_color": "#4f46e5",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

```bash
# Simple colored squares as placeholder icons
# Replace with real icons before shipping
npx sharp-cli --input <(convert -size 192x192 xc:#4f46e5 png:-) --output public/icon-192.png 2>/dev/null || \
  curl -o public/icon-192.png "https://via.placeholder.com/192/4f46e5/ffffff?text=LA" 2>/dev/null || \
  echo "Add icon-192.png and icon-512.png to public/ manually"
```

- [ ] **Step 3: Update `next.config.ts` with next-pwa**

```typescript
import type { NextConfig } from 'next'
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
```

- [ ] **Step 4: Verify build completes**

```bash
npm run build
```
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add public/ next.config.ts
git commit -m "feat: add PWA manifest and next-pwa service worker"
```

---

## Task 25: End-to-End Smoke Test

- [ ] **Step 1: Start all Docker services**

```bash
docker compose up -d
```
Expected: all 4 services healthy.

- [ ] **Step 2: Run migration**

```bash
npm run migrate
```
Expected: `Applied 001_initial.sql`

- [ ] **Step 3: Start app in dev mode**

```bash
npm run dev
```
Expected: app starts on http://localhost:3000

- [ ] **Step 4: Open browser and verify flow**

1. Open http://localhost:3000 on mobile or Chrome DevTools mobile view
2. Allow location permission when prompted
3. Verify: location detected, area briefing appears
4. Verify: `LoadingPulse` appears while scrape runs
5. Navigate to `/explore/things-to-do` — verify page loads
6. Navigate to `/itinerary` — tap "Generate Itinerary" — verify AI responds
7. Navigate to `/chat` — type "What should I do nearby?" — verify streaming response

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete AI Location Advisor MVP — GPS detection, Apify scraping, DeepSeek AI, mobile-first PWA"
```

---

## Self-Review Checklist

| Spec Requirement | Task(s) |
|---|---|
| GPS location detection + reverse geocode | Task 19 (useLocation) |
| Store location {lat,lng,country,city,district} | Task 19 (useLocation + localStorage) |
| Discover nearby content via Apify | Tasks 8, 11, 12 (worker + processor) |
| Background scrape with dedup | Task 12 (processor — Redis lock) |
| Google Maps Scraper + Reviews Scraper | Task 8 (apify.ts) |
| TripAdvisor Scraper | Task 8 (apify.ts) |
| Eventbrite Scraper | Task 8 (apify.ts) |
| DeepSeek AI — summaries, scoring | Tasks 7, 11 (ai.ts + enrich-places) |
| Hidden gem score (0–100) | Tasks 7, 11 |
| Tourist trap score (0–100) | Tasks 7, 11 |
| Attraction ranking | Task 18 (/api/recommendations) |
| Main dashboard + area briefing | Tasks 17, 21 |
| Quick action grid (8 buttons) | Task 20 (QuickActionGrid) |
| Things To Do page with filters | Task 22 |
| Restaurant Discovery | Task 22 |
| Scenic View Finder | Task 22 |
| Events Discovery | Task 22 |
| AI Itinerary Generator | Tasks 7, 18, 23 |
| Smart recommendations | Tasks 7, 18 |
| Local Essentials page | Task 22 |
| User preferences (localStorage) | Task 19 (useLocalStorage) |
| Saved Places (wishlist/visited/favorites) | Tasks 20 (PlaceCard save), 23 (SavedPage) |
| PWA offline support | Task 24 |
| Streaming chat assistant | Tasks 18, 23 |
| PostgreSQL + PostGIS schema | Task 3 |
| Redis caching + job queue | Tasks 5, 9, 15 |
| Docker Compose | Task 2 |
| Supabase migration path | Design doc — env vars only, no code changes needed |
