'use client'
import type { Place } from '@/types'
import { useSavedPlaces } from '@/hooks/useLocalStorage'

const FALLBACK_IMAGE = '/place-placeholder.svg'

interface Props {
  place: Place
  showDistance?: boolean
}

export function PlaceCard({ place, showDistance = true }: Props) {
  const [saved, setSaved] = useSavedPlaces()
  const rating = Number(place.rating)
  const distance = Number(place.distance_m)
  const reviewCount = Number(place.review_count)
  const priceLevel = Number(place.price_level)
  const hiddenGemScore = Number(place.hidden_gem_score)
  const touristTrapScore = Number(place.tourist_trap_score)

  function toggleSave() {
    const id = place.id
    const inFav = saved.favorites.includes(id)
    setSaved({
      ...saved,
      favorites: inFav ? saved.favorites.filter(x => x !== id) : [...saved.favorites, id],
    })
  }

  const isSaved = saved.favorites.includes(place.id)
  const distText = Number.isFinite(distance)
    ? distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`
    : null
  const priceText = Number.isFinite(priceLevel) && priceLevel > 0 ? '$'.repeat(priceLevel) : 'Local pick'
  const badgeText = place.category ?? place.type.replace('_', ' ')

  return (
    <div className="stagger-fade-in overflow-hidden rounded-[26px] bg-white shadow-[0_16px_30px_rgba(34,34,34,0.08)]">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={place.photos?.[0] ?? FALLBACK_IMAGE}
          alt={place.photos?.[0] ? place.name : 'Generic place photo'}
          className="h-56 w-full object-cover bg-gray-100"
          onError={event => {
            event.currentTarget.src = FALLBACK_IMAGE
          }}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#222222] backdrop-blur-sm">
            {badgeText}
          </span>
          <button
            onClick={toggleSave}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg shadow-[0_8px_18px_rgba(34,34,34,0.12)] backdrop-blur-sm"
          >
            {isSaved ? '♥' : '♡'}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-semibold leading-tight text-[#222222]">{place.name}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {showDistance && distText ? `${distText} away` : priceText}
            </p>
          </div>
          {Number.isFinite(rating) && rating > 0 && (
            <span className="shrink-0 text-sm font-semibold text-[#222222]">
              ★ {rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--text-muted)]">
          {Number.isFinite(reviewCount) && reviewCount > 0 && <span>{reviewCount} reviews</span>}
          {place.visit_duration && <span>{place.visit_duration}</span>}
          {!showDistance && distText && <span>{distText} away</span>}
          {priceText && <span>{priceText}</span>}
        </div>
        {place.summary && <p className="line-clamp-2 text-sm leading-6 text-[#484848]">{place.summary}</p>}
        <div className="flex gap-2 flex-wrap">
          {Number.isFinite(hiddenGemScore) && hiddenGemScore > 60 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Hidden gem</span>
          )}
          {Number.isFinite(touristTrapScore) && touristTrapScore > 65 && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Crowded spot</span>
          )}
          {place.category && (
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[#5d5d5d]">{place.category}</span>
          )}
        </div>
      </div>
    </div>
  )
}
