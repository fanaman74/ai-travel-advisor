'use client'
import { useEffect, useState } from 'react'
interface Props { lat: number; lng: number; city: string; district: string }
export function AreaBriefing({ lat, lng, city, district }: Props) {
  const [briefing, setBriefing] = useState<string | null>(null)
  useEffect(() => {
    const url = new URL('/api/area-briefing', window.location.origin)
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lng', lng.toString())
    url.searchParams.set('city', city)
    url.searchParams.set('district', district)
    fetch(url.toString()).then(r => r.json()).then(d => setBriefing(d.briefing)).catch(() => {})
  }, [lat, lng, city, district])
  if (!briefing) return <div className="airbnb-card h-28 animate-pulse bg-[var(--surface-muted)]" />
  return (
    <div className="airbnb-card overflow-hidden p-0 stagger-fade-in">
      <div className="bg-[linear-gradient(135deg,#ff385c,#ff7a59)] px-5 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Area briefing</p>
        <p className="mt-1 text-lg font-semibold">{city}{district ? `, ${district}` : ''}</p>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm leading-7 text-[#484848]">{briefing}</p>
      </div>
    </div>
  )
}
