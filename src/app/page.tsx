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
  const { location, jobId, loading: locLoading, error, serverError } = useLocation()
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
      status: locLoading ? 'waiting' : serverError ? 'error' : jobId ? 'done' : 'error',
      detail: jobId ? `Job ${jobId.slice(0, 8)}…` : (!locLoading && !error && !jobId ? serverError ?? 'API /api/location returned error' : ''),
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
  const heroPlace = places[0]

  if (locLoading || (!location && !error)) {
    return (
      <div className="app-shell flex min-h-screen flex-col gap-4 p-6 pt-12">
        <h1 className="text-lg font-semibold text-[#222222]">Loading your local guide</h1>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div key={i} className="airbnb-card flex items-start gap-3 p-4">
              <span className="text-lg mt-0.5">{icon(s.status)}</span>
              <div>
                <p className={`text-sm font-medium ${s.status === 'error' ? 'text-red-600' : 'text-[#222222]'}`}>{s.label}</p>
                {s.detail && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell flex min-h-screen flex-col gap-4 p-6 pt-12">
        <h1 className="text-lg font-semibold text-[#222222]">Setup status</h1>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div key={i} className="airbnb-card flex items-start gap-3 p-4">
              <span className="text-lg mt-0.5">{icon(s.status)}</span>
              <div>
                <p className={`text-sm font-medium ${s.status === 'error' ? 'text-red-600' : 'text-[#222222]'}`}>{s.label}</p>
                {s.detail && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Enable location access and reload the page.</p>
      </div>
    )
  }

  return (
    <div className="app-shell flex flex-col gap-5 px-4 pb-10 pt-5">
      <div className="airbnb-card overflow-hidden p-0 stagger-fade-in">
        <div className="bg-[linear-gradient(135deg,#ff385c,#ff7a59)] px-5 pb-6 pt-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">Nearby stays and experiences</p>
              <h1 className="mt-2 text-[28px] font-semibold leading-tight">{location?.city ?? 'Nearby'}</h1>
              <p className="mt-1 text-sm text-white/80">{location?.district || 'A local guide shaped around where you are now.'}</p>
            </div>
            <div className="airbnb-pill-button flex h-12 w-12 items-center justify-center border-white/40 bg-white/15 text-2xl text-white shadow-none">⌂</div>
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="airbnb-pill-button flex items-center gap-3 px-4 py-3">
            <span className="text-lg text-[#222222]">⌕</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#222222]">{location?.city ?? 'Current area'}</p>
              <p className="text-xs text-[var(--text-muted)]">{radius / 1000 < 1 ? `${radius}m` : `${radius / 1000}km`} radius · live local results</p>
            </div>
          </div>
        </div>
      </div>

      {location && <AreaBriefing lat={location.latitude} lng={location.longitude} city={location.city} district={location.district} />}

      {jobId && !jobDone && <LoadingPulse progress={jobStatus.progress} message="Finding the best spots nearby…" />}

      {places.length === 0 && (
        <div className="airbnb-card flex flex-col gap-3 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Pipeline status</p>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-base">{icon(s.status)}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${s.status === 'error' ? 'text-red-600' : 'text-[#3f3f3f]'}`}>{s.label}</span>
                {s.detail && <span className="ml-1 text-xs text-[var(--text-muted)]">— {s.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <QuickActionGrid />

      <div className="airbnb-card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Search radius</p>
        <RadiusSelector value={radius} onChange={setRadius} />
      </div>

      {heroPlace && (
        <div className="airbnb-card flex items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Guest favorite nearby</p>
            <p className="mt-1 truncate text-base font-semibold text-[#222222]">{heroPlace.name}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{heroPlace.category ?? 'Handpicked local spot'}</p>
          </div>
          <div className="rounded-full bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[#ff385c]">
            {Number.isFinite(Number(heroPlace.rating)) ? `★ ${Number(heroPlace.rating).toFixed(1)}` : 'Local'}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Explore</p>
            <h2 className="mt-1 text-xl font-semibold text-[#222222]">Top picks near you</h2>
          </div>
          <span className="text-sm text-[var(--text-muted)]">{places.length} stays & spots</span>
        </div>
        {placesLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-[320px] rounded-[26px] bg-white/70 animate-pulse shadow-[0_12px_30px_rgba(34,34,34,0.06)]" />)}
          </div>
        ) : places.length === 0 ? (
          <div className="airbnb-card px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            {jobDone ? 'No places found nearby. Try a larger radius.' : 'Places loading in background…'}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {places.slice(0, 6).map(place => <PlaceCard key={place.id} place={place} />)}
          </div>
        )}
      </div>
    </div>
  )
}
