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

  const steps = [
    {
      label: 'Detect location',
      status: locLoading ? 'loading' : error ? 'error' : location ? 'done' : 'waiting',
      detail: error ?? (location ? `${location.city} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` : ''),
    },
    {
      label: 'Register with server',
      status: locLoading ? 'waiting' : error ? 'error' : jobId ? 'done' : 'error',
      detail: jobId ? `Job ${jobId.slice(0, 8)}…` : (!locLoading && !error && !jobId ? 'API /api/location returned error' : ''),
    },
    {
      label: 'Scrape nearby places',
      status: !jobId ? 'waiting' : jobStatus.status === 'completed' ? 'done' : jobStatus.status === 'failed' ? 'error' : jobStatus.status === 'running' ? 'loading' : 'loading',
      detail: jobStatus.status ? `Status: ${jobStatus.status}${jobStatus.progress ? ` (${jobStatus.progress}%)` : ''}` : '',
    },
    {
      label: 'Show results',
      status: places.length > 0 ? 'done' : jobDone ? 'error' : 'waiting',
      detail: places.length > 0 ? `${places.length} places found` : jobDone ? 'No places found — try larger radius' : '',
    },
  ]

  const icon = (s: string) => s === 'done' ? '✅' : s === 'error' ? '❌' : s === 'loading' ? '⏳' : '⬜'

  if (locLoading || (!location && !error)) {
    return (
      <div className="flex flex-col min-h-screen gap-4 p-6 pt-12">
        <h1 className="text-lg font-bold text-gray-900">Loading…</h1>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <span className="text-lg mt-0.5">{icon(s.status)}</span>
              <div>
                <p className={`text-sm font-medium ${s.status === 'error' ? 'text-red-600' : 'text-gray-800'}`}>{s.label}</p>
                {s.detail && <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen gap-4 p-6 pt-12">
        <h1 className="text-lg font-bold text-gray-900">Setup Status</h1>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <span className="text-lg mt-0.5">{icon(s.status)}</span>
              <div>
                <p className={`text-sm font-medium ${s.status === 'error' ? 'text-red-600' : 'text-gray-800'}`}>{s.label}</p>
                {s.detail && <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">Enable location access and reload the page.</p>
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

      {/* Status panel — shows when no places yet */}
      {places.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pipeline status</p>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-base">{icon(s.status)}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${s.status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>{s.label}</span>
                {s.detail && <span className="text-xs text-gray-400 ml-1">— {s.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

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
