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

export function ExplorePage({ title, icon, type, filterOptions = [], filterFn, emptyMessage }: Props) {
  const { location } = useLocation()
  const [radius, setRadius] = useState(5000)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const { places, loading } = useNearby(location?.latitude ?? null, location?.longitude ?? null, radius, type)
  const filtered = filterFn && activeFilters.length > 0 ? places.filter(p => filterFn(p, activeFilters)) : places

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-bold text-gray-900">{icon} {title}</h1>
      </div>
      <RadiusSelector value={radius} onChange={setRadius} />
      {filterOptions.length > 0 && <FilterBar options={filterOptions} active={activeFilters} onChange={setActiveFilters} />}
      {loading ? (
        <div className="flex flex-col gap-3 mt-2">{[1,2,3].map(i=><div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{emptyMessage ?? `No ${title.toLowerCase()} found nearby.`}</div>
      ) : (
        <div className="flex flex-col gap-3">{filtered.map(p=><PlaceCard key={p.id} place={p}/>)}</div>
      )}
    </div>
  )
}
