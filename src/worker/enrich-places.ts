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
