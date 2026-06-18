'use client'
import { useState, useEffect } from 'react'
import type { UserLocation } from '@/types'

interface LocationState {
  location: UserLocation | null
  jobId: string | null
  loading: boolean
  error: string | null
  serverError: string | null
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
    location: null, jobId: null, loading: true, error: null, serverError: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: 'Geolocation not supported' }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        const geo: Partial<UserLocation> = await reverseGeocode(latitude, longitude).catch(() => ({}))

        const location: UserLocation = {
          latitude, longitude,
          country: geo.country ?? '',
          city: geo.city ?? '',
          district: geo.district ?? '',
        }

        const res = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        }).catch(() => null)

        const data = res ? await res.json().catch(() => ({})) : {}
        const jobId = res?.ok ? data.jobId : null
        const apiError = res && !res.ok ? data.error ?? `API /api/location returned ${res.status}` : null

        setState({ location, jobId: jobId ?? null, loading: false, error: null, serverError: apiError })

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
