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
  if (!briefing) return <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <p className="text-sm text-indigo-800 leading-relaxed">{briefing}</p>
    </div>
  )
}
