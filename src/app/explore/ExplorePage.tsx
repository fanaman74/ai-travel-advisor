'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { useNearby } from '@/hooks/useNearby'
import { PlaceCard } from '@/components/PlaceCard'
import { FilterBar } from '@/components/FilterBar'
import { RadiusSelector } from '@/components/RadiusSelector'
import Link from 'next/link'
import type { Place } from '@/types'

interface Props {
  title: string; icon: string; type?: string
  filterOptions?: string[]
  filterFn?: (place: Place, active: string[]) => boolean
  emptyMessage?: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function toText(place: Place): string {
  return [
    place.name,
    place.type,
    place.category,
    place.summary,
    ...(place.best_for ?? []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isOpenNow(place: Place): boolean {
  if (!place.opening_hours) return false

  const today = DAY_NAMES[new Date().getDay()]
  const hours = place.opening_hours[today]
  if (!hours) return false

  const normalized = hours.toLowerCase()
  if (normalized.includes('24')) return true
  if (normalized.includes('closed')) return false

  // The scraper returns human-readable hours in several formats. If we have
  // hours for today but cannot safely parse them, treat it as a positive signal.
  return true
}

function matchesDefaultFilter(place: Place, filter: string): boolean {
  const text = toText(place)
  const rating = numberValue(place.rating)
  const price = numberValue(place.price_level)

  switch (filter) {
    case 'Open Now':
      return isOpenNow(place)
    case 'Budget':
      return price != null ? price <= 1 : /\b(cafe|fast food|pizza|pub|bar|bakery|salad|budget)\b/.test(text)
    case 'Mid-range':
      return price != null ? price >= 2 && price <= 3 : rating == null || rating < 4.6
    case 'Luxury':
    case 'Fine Dining':
      return price != null ? price >= 4 : (rating ?? 0) >= 4.5 || /\b(fine dining|luxury|gourmet|tasting menu)\b/.test(text)
    case 'Local Cuisine':
      return /\b(belgian|brasserie|bistro|pub|local|traditional|flemish|georgian|italian|restaurant)\b/.test(text)
    case 'Fast Food':
      return /\b(fast food|burger|pizza|sandwich|fries|kebab|takeout)\b/.test(text)
    case 'Sunset':
    case 'Sunrise':
    case 'Photography':
    case 'Walking':
    case 'Outdoor':
      return /\b(park|forest|garden|view|scenic|walking|trail|castle|square|monument|tourist attraction)\b/.test(text)
    case 'Indoor':
      return /\b(museum|hotel|restaurant|cafe|theater|gallery|castle)\b/.test(text)
    case 'Free':
      return price === 0 || /\b(park|forest|monument|square)\b/.test(text)
    case 'Today':
    case 'This Week':
    case 'Concerts':
    case 'Festivals':
      return text.includes(filter.toLowerCase().replace(/s$/, ''))
    default:
      return text.includes(filter.toLowerCase())
  }
}

function defaultFilterFn(place: Place, active: string[]): boolean {
  return active.every(filter => matchesDefaultFilter(place, filter))
}

export function ExplorePage({ title, icon, type, filterOptions = [], filterFn, emptyMessage }: Props) {
  const { location } = useLocation()
  const [radius, setRadius] = useState(5000)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const { places, loading } = useNearby(location?.latitude ?? null, location?.longitude ?? null, radius, type)
  const applyFilters = filterFn ?? defaultFilterFn
  const filtered = activeFilters.length > 0 ? places.filter(p => applyFilters(p, activeFilters)) : places

  return (
    <div className="app-shell flex min-h-screen flex-col gap-5 px-4 pb-10 pt-6">
      <div className="airbnb-card flex items-center gap-3 px-4 py-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-lg text-[#222222]">←</Link>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{icon}</p>
          <h1 className="text-lg font-semibold text-[#222222]">{title}</h1>
        </div>
      </div>
      <div className="airbnb-card flex flex-col gap-4 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Search radius</p>
          <p className="mt-1 text-sm text-[#5f5f5f]">Tune the distance the way you would when browsing neighborhoods.</p>
        </div>
        <RadiusSelector value={radius} onChange={setRadius} />
        {filterOptions.length > 0 && <FilterBar options={filterOptions} active={activeFilters} onChange={setActiveFilters} />}
      </div>
      {loading ? (
        <div className="mt-1 flex flex-col gap-4">{[1, 2, 3].map(i => <div key={i} className="h-[320px] rounded-[26px] bg-white/70 animate-pulse shadow-[0_12px_30px_rgba(34,34,34,0.06)]" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="airbnb-card px-6 py-12 text-center">
          <p className="text-base font-semibold text-[#222222]">Nothing matched these filters yet</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{emptyMessage ?? `No ${title.toLowerCase()} found nearby.`}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">{filtered.map(p => <PlaceCard key={p.id} place={p} />)}</div>
      )}
    </div>
  )
}
