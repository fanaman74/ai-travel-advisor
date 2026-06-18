'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { useJobStatus } from '@/hooks/useJobStatus'
import { useNearby } from '@/hooks/useNearby'
import { AreaBriefing } from '@/components/AreaBriefing'
import { QuickActionGrid } from '@/components/QuickActionGrid'
import { PlaceCard } from '@/components/PlaceCard'
import { LoadingPulse } from '@/components/LoadingPulse'
import { RadiusSelector } from '@/components/RadiusSelector'

export default function DashboardPage() {
  const { location, jobId, loading: locLoading, error } = useLocation()
  const jobStatus = useJobStatus(jobId)
  const [radius, setRadius] = useState(5000)
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
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-3xl animate-pulse">📍</div>
        <p className="text-gray-500 text-sm">Detecting your location…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6">
        <p className="text-2xl">⚠️</p>
        <p className="text-gray-700 text-center text-sm">{error}</p>
        <p className="text-gray-400 text-xs text-center">Enable location access and reload the page.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{location?.city ?? 'Nearby'}</h1>
          <p className="text-xs text-gray-400">{location?.district}</p>
        </div>
        <span className="text-2xl">🗺️</span>
      </div>

      {location && <AreaBriefing lat={location.latitude} lng={location.longitude} city={location.city} district={location.district} />}

      {jobId && !jobDone && <LoadingPulse progress={jobStatus.progress} message="Finding the best spots nearby…" />}

      <QuickActionGrid />

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Search radius</p>
        <RadiusSelector value={radius} onChange={setRadius} />
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Top Picks</h2>
        {placesLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {jobDone ? 'No places found nearby. Try a larger radius.' : 'Places loading in background…'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {places.slice(0, 6).map(place => <PlaceCard key={place.id} place={place} />)}
          </div>
        )}
      </div>
    </div>
  )
}
