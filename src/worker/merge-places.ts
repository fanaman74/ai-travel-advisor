import type { RawApifyPlace } from '@/types'
import { arePlacesClose } from '@/lib/geo'

export interface NormalisedPlace {
  name: string
  type: 'restaurant' | 'attraction' | 'event' | 'hotel' | 'essential'
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

export function classifyPlaceType(category: string | null): NormalisedPlace['type'] {
  const value = category?.toLowerCase() ?? ''

  if (/\b(hotel|bed & breakfast|hostel|lodging|apartment|guest house)\b/.test(value)) {
    return 'hotel'
  }

  if (/\b(restaurant|cafe|coffee|pub|bar|brasserie|bistro|pizza|salad|fast food|bakery|diner|food)\b/.test(value)) {
    return 'restaurant'
  }

  if (/\b(parking|pharmacy|supermarket|grocery|store|hospital|bank|atm|gas station)\b/.test(value)) {
    return 'essential'
  }

  return 'attraction'
}

function normalisePlace(raw: RawApifyPlace): NormalisedPlace | null {
  const latitude = raw.latitude ?? raw.location?.lat
  const longitude = raw.longitude ?? raw.location?.lng

  // Filter out places without lat/lng
  if (latitude == null || longitude == null) {
    return null
  }

  // Convert openingHours array to object
  const opening_hours: Record<string, string> | null = raw.openingHours
    ? Object.fromEntries(raw.openingHours.map(oh => [oh.day, oh.hours]))
    : null

  return {
    name: raw.name ?? raw.title ?? 'Unknown',
    type: classifyPlaceType(raw.categoryName ?? null),
    latitude,
    longitude,
    rating: raw.totalScore ?? raw.rating ?? null,
    review_count: raw.reviewsCount ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    opening_hours,
    photos: raw.imageUrls ?? null,
    external_id: raw.placeId ?? null,
    category: raw.categoryName ?? null,
  }
}

export function mergePlaces(rawPlaces: RawApifyPlace[]): NormalisedPlace[] {
  // Normalise all places and filter out those without lat/lng
  const normalised = rawPlaces
    .map(normalisePlace)
    .filter((place): place is NormalisedPlace => place !== null)

  // Dedup by name + proximity (within 50m)
  const seen: Set<number> = new Set()
  const result: NormalisedPlace[] = []

  for (let i = 0; i < normalised.length; i++) {
    if (seen.has(i)) continue

    const current = normalised[i]
    let selected = current

    // Check if this place is close to any other place with the same name
    for (let j = i + 1; j < normalised.length; j++) {
      if (seen.has(j)) continue

      const other = normalised[j]

      // Check if same name and within 50m
      if (
        current.name === other.name &&
        arePlacesClose(
          current.latitude,
          current.longitude,
          other.latitude,
          other.longitude,
          50
        )
      ) {
        // Keep the one with more reviews
        const currentReviews = selected.review_count ?? 0
        const otherReviews = other.review_count ?? 0

        if (otherReviews > currentReviews) {
          selected = other
        }

        seen.add(j)
      }
    }

    result.push(selected)
  }

  return result
}
