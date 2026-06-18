'use client'
import { useSavedPlaces } from '@/hooks/useLocalStorage'
import Link from 'next/link'

export default function SavedPage() {
  const [saved, setSaved] = useSavedPlaces()
  const tabs = [
    { key: 'favorites' as const, label: 'Favorites', icon: '❤️' },
    { key: 'wishlist' as const, label: 'Wishlist', icon: '🔖' },
    { key: 'visited' as const, label: 'Visited', icon: '✅' },
  ]
  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-lg font-bold text-gray-900">🗂️ Saved Places</h1>
      </div>
      {tabs.map(tab => (
        <div key={tab.key}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{tab.icon} {tab.label} ({saved[tab.key].length})</h2>
          {saved[tab.key].length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Nothing saved yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {saved[tab.key].map(id => (
                <div key={id} className="bg-white rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-mono text-xs">{id.slice(0, 8)}…</span>
                  <button onClick={() => setSaved({ ...saved, [tab.key]: saved[tab.key].filter(x => x !== id) })} className="text-red-400 text-xs">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
