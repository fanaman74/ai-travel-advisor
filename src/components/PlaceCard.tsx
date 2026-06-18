'use client'
import type { Place } from '@/types'
import { useSavedPlaces } from '@/hooks/useLocalStorage'

interface Props {
  place: Place
  showDistance?: boolean
}

export function PlaceCard({ place, showDistance = true }: Props) {
  const [saved, setSaved] = useSavedPlaces()

  function toggleSave() {
    const id = place.id
    const inFav = saved.favorites.includes(id)
    setSaved({
      ...saved,
      favorites: inFav ? saved.favorites.filter(x => x !== id) : [...saved.favorites, id],
    })
  }

  const isSaved = saved.favorites.includes(place.id)
  const distText = place.distance_m != null
    ? place.distance_m < 1000 ? `${Math.round(place.distance_m)}m` : `${(place.distance_m / 1000).toFixed(1)}km`
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      {place.photos?.[0] && (
        <img src={place.photos[0]} alt={place.name} className="w-full h-40 object-cover rounded-xl" />
      )}
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-gray-900 text-base leading-tight flex-1 pr-2">{place.name}</h3>
        <button onClick={toggleSave} className="text-xl">{isSaved ? '❤️' : '🤍'}</button>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        {place.rating && (
          <span className="flex items-center gap-1">
            ⭐ {place.rating.toFixed(1)}
            {place.review_count && <span>({place.review_count})</span>}
          </span>
        )}
        {showDistance && distText && <span>📍 {distText}</span>}
        {place.visit_duration && <span>⏱ {place.visit_duration}</span>}
      </div>
      {place.summary && <p className="text-sm text-gray-600 line-clamp-2">{place.summary}</p>}
      <div className="flex gap-2 flex-wrap mt-1">
        {place.hidden_gem_score != null && place.hidden_gem_score > 60 && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">💎 Hidden Gem</span>
        )}
        {place.tourist_trap_score != null && place.tourist_trap_score > 65 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠️ Tourist Trap</span>
        )}
        {place.price_level != null && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{'$'.repeat(place.price_level)}</span>
        )}
      </div>
    </div>
  )
}
