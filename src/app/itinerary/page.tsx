'use client'
import { useState } from 'react'
import { useLocation } from '@/hooks/useLocation'
import { usePreferences } from '@/hooks/useLocalStorage'
import { ItineraryTimeline } from '@/components/ItineraryTimeline'
import Link from 'next/link'
import type { Itinerary } from '@/types'

const DURATIONS = [{ label: '1 Hour', value: 1 }, { label: '2 Hours', value: 2 }, { label: 'Half Day', value: 4 }, { label: 'Full Day', value: 8 }]

export default function ItineraryPage() {
  const { location } = useLocation()
  const [preferences] = usePreferences()
  const [duration, setDuration] = useState(4)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!location) return
    setLoading(true)
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.latitude, lng: location.longitude, durationHours: duration, preferences, city: location.city }),
      })
      const data = await res.json()
      setItinerary(data)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">🗓️ Plan My Day</h1>
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-3">How long do you have?</p>
        <div className="grid grid-cols-2 gap-2">
          {DURATIONS.map(d => (
            <button key={d.value} onClick={() => setDuration(d.value)}
              className={`py-3 rounded-xl text-sm font-medium transition-colors ${duration === d.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={generate} disabled={loading || !location}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 transition-opacity">
        {loading ? 'Generating…' : 'Generate Itinerary ✨'}
      </button>
      {itinerary && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">{itinerary.title}</h2>
          <ItineraryTimeline stops={itinerary.content?.stops ?? []} />
        </div>
      )}
    </div>
  )
}
