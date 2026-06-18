'use client'
import { useLocation } from '@/hooks/useLocation'
import { useNearby } from '@/hooks/useNearby'
import { PlaceCard } from '@/components/PlaceCard'
import Link from 'next/link'
export default function HiddenGemsPage() {
  const { location } = useLocation()
  const { places, loading } = useNearby(location?.latitude ?? null, location?.longitude ?? null, 10000)
  const gems = places.filter(p => (p.hidden_gem_score ?? 0) > 60).sort((a, b) => (b.hidden_gem_score ?? 0) - (a.hidden_gem_score ?? 0))
  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">💎 Hidden Gems</h1>
      </div>
      <p className="text-sm text-gray-500">Places the locals love, tourists haven&apos;t found yet.</p>
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i=><div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse"/>)}</div>
      ) : gems.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hidden gems found yet. Check back after the background scan completes.</div>
      ) : (
        <div className="flex flex-col gap-3">{gems.map(p=><PlaceCard key={p.id} place={p}/>)}</div>
      )}
    </div>
  )
}
