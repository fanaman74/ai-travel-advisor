import { ApifyClient } from 'apify-client'
import type { RawApifyPlace } from '@/types'

const ACTORS = {
  googleMaps: process.env.APIFY_GOOGLE_MAPS_ACTOR_ID ?? 'compass/crawler-google-places',
  googleMapsReviews: process.env.APIFY_GOOGLE_MAPS_REVIEWS_ACTOR_ID ?? 'compass/Google-Maps-Reviews-Scraper',
  tripAdvisor: process.env.APIFY_TRIPADVISOR_ACTOR_ID ?? 'maxcopell/tripadvisor',
  eventbrite: process.env.APIFY_EVENTBRITE_ACTOR_ID ?? 'aitorsm/eventbrite',
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getClient() {
  if (!process.env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY is not configured')
  }

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

  const input = {
    searchStringsArray: searchTerms,
    customGeolocation: {
      type: 'Point',
      coordinates: [params.lng, params.lat],
    },
    maxCrawledPlacesPerSearch: getPositiveIntEnv('APIFY_GOOGLE_MAPS_MAX_PLACES_PER_SEARCH', 5),
    maxCrawledPlaces: getPositiveIntEnv('APIFY_GOOGLE_MAPS_MAX_TOTAL_PLACES', 30),
    language: 'en',
  }

  const items = await runActor(ACTORS.googleMaps, input)
  return items as RawApifyPlace[]
}

export async function runGoogleMapsReviewsScraper(
  placeIds: string[]
): Promise<Array<{ placeId: string; reviews: Array<{ text: string; rating: number; name: string; publishedAtDate: string }> }>> {
  if (placeIds.length === 0) {
    return []
  }

  const input = {
    placeIds,
    maxReviewsPerPlace: getPositiveIntEnv('APIFY_GOOGLE_MAPS_MAX_REVIEWS_PER_PLACE', 3),
  }

  const items = await runActor(ACTORS.googleMapsReviews, input)
  return items as Array<{ placeId: string; reviews: Array<{ text: string; rating: number; name: string; publishedAtDate: string }> }>
}

export async function runTripAdvisorScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  void params

  if (!process.env.APIFY_TRIPADVISOR_LOCATION) {
    return []
  }

  const input = {
    query: process.env.APIFY_TRIPADVISOR_LOCATION,
    maxItemsPerQuery: 20,
    includeAttractions: true,
    includeRestaurants: true,
    includeHotels: true,
    language: 'en',
  }

  const items = await runActor(ACTORS.tripAdvisor, input)
  return items as RawApifyPlace[]
}

export async function runEventbriteScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  void params

  if (!process.env.APIFY_EVENTBRITE_COUNTRY || !process.env.APIFY_EVENTBRITE_CITY) {
    return []
  }

  const today = new Date().toISOString().split('T')[0]

  const input = {
    country: process.env.APIFY_EVENTBRITE_COUNTRY,
    city: process.env.APIFY_EVENTBRITE_CITY,
    category: '',
    startDate: today,
    maxResults: 20,
  }

  const items = await runActor(ACTORS.eventbrite, input)
  return items as RawApifyPlace[]
}
