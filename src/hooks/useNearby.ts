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
