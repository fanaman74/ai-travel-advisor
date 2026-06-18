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
  source: 'google_maps' | 'tripadvisor' | 'eventbrite' | 'osm'
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
  location?: {
    lat?: number
    lng?: number
  }
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
