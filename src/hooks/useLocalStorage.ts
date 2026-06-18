'use client'
import { useState, useEffect } from 'react'
import type { UserPreferences, SavedPlaces } from '@/types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  foodie: false, history: false, nature: false,
  nightlife: false, budget: false, luxury: false,
}

export const DEFAULT_SAVED: SavedPlaces = {
  wishlist: [], visited: [], favorites: [],
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) setValue(JSON.parse(stored))
    } catch {}
  }, [key])

  function set(newValue: T) {
    setValue(newValue)
    try { localStorage.setItem(key, JSON.stringify(newValue)) } catch {}
  }

  return [value, set] as const
}

export function usePreferences() {
  return useLocalStorage<UserPreferences>('preferences', DEFAULT_PREFERENCES)
}

export function useSavedPlaces() {
  return useLocalStorage<SavedPlaces>('saved', DEFAULT_SAVED)
}
