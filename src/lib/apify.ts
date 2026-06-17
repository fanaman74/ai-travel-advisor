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
  const searchStrings = searchTerms.map(term => `${term} near ${params.lat},${params.lng}`)

  const input = {
    searchStringsArray: searchStrings,
    maxCrawledPlacesPerSearch: 20,
    language: 'en',
  }

  const items = await runActor('compass/google-maps-scraper', input)
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
    maxReviewsPerPlace: 10,
  }

  const items = await runActor('compass/google-maps-reviews-scraper', input)
  return items as Array<{ placeId: string; reviews: Array<{ text: string; rating: number; name: string; publishedAtDate: string }> }>
}

export async function runTripAdvisorScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  const input = {
    latitude: params.lat,
    longitude: params.lng,
  }

  const items = await runActor('maxcopell/tripadvisor-scraper', input)
  return items as RawApifyPlace[]
}

export async function runEventbriteScraper(params: {
  lat: number
  lng: number
}): Promise<RawApifyPlace[]> {
  const today = new Date().toISOString().split('T')[0]

  const input = {
    latitude: params.lat,
    longitude: params.lng,
    startDate: today,
  }

  const items = await runActor('zuzka/eventbrite-scraper', input)
  return items as RawApifyPlace[]
}
