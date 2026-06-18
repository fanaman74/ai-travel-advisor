import type { Place } from '@/types'

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

function toCategory(amenity: string | undefined): string {
  switch (amenity) {
    case 'cafe':
      return 'Cafe'
    case 'fast_food':
      return 'Fast food restaurant'
    case 'pub':
      return 'Pub'
    case 'bar':
      return 'Bar'
    default:
      return 'Restaurant'
  }
}

function toAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  const city = tags['addr:city']
  const postcode = tags['addr:postcode']
  const line = [street && number ? `${street} ${number}` : street ?? number, postcode, city]
    .filter(Boolean)
    .join(', ')

  return line || null
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6_371_000
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mapElement(element: OverpassElement, lat: number, lng: number): Place | null {
  const tags = element.tags ?? {}
  const name = tags.name
  const placeLat = element.lat ?? element.center?.lat
  const placeLng = element.lon ?? element.center?.lon

  if (!name || placeLat == null || placeLng == null) {
    return null
  }

  return {
    id: `osm:${element.type}:${element.id}`,
    name,
    type: 'restaurant',
    category: toCategory(tags.amenity),
    latitude: placeLat,
    longitude: placeLng,
    rating: null,
    review_count: null,
    price_level: null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    address: toAddress(tags),
    opening_hours: tags.opening_hours ? { raw: tags.opening_hours } : null,
    photos: null,
    source: 'osm',
    external_id: `${element.type}/${element.id}`,
    summary: null,
    pros: null,
    cons: null,
    best_for: null,
    visit_duration: null,
    hidden_gem_score: null,
    tourist_trap_score: null,
    ai_processed_at: null,
    scraped_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    distance_m: distanceMeters(lat, lng, placeLat, placeLng),
  }
}

export async function fetchOsmRestaurants(params: {
  lat: number
  lng: number
  radius: number
  limit?: number
}): Promise<Place[]> {
  const radius = Math.min(Math.max(params.radius, 100), 25_000)
  const limit = params.limit ?? 100
  const body = `[out:json][timeout:10];(
node(around:${radius},${params.lat},${params.lng})[amenity~"^(restaurant|cafe|fast_food|pub|bar)$"];
way(around:${radius},${params.lat},${params.lng})[amenity~"^(restaurant|cafe|fast_food|pub|bar)$"];
relation(around:${radius},${params.lat},${params.lng})[amenity~"^(restaurant|cafe|fast_food|pub|bar)$"];
);out center tags ${limit};`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]

  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'location-advisor/0.1',
        },
        body: new URLSearchParams({ data: body }).toString(),
        signal: AbortSignal.timeout(12_000),
      })

      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status}`)
      }

      const data = await response.json() as OverpassResponse
      return (data.elements ?? [])
        .map(element => mapElement(element, params.lat, params.lng))
        .filter((place): place is Place => place !== null)
        .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))
        .slice(0, limit)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OpenStreetMap lookup failed')
}
