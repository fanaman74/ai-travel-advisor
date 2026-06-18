'use client'
import { ExplorePage } from '../ExplorePage'
import type { Place } from '@/types'
const FILTERS = ['Family Friendly', 'Couples', 'Solo Travelers', 'Budget', 'Luxury', 'Indoor', 'Outdoor']
function filterFn(place: Place, active: string[]): boolean {
  return active.some(f => place.best_for?.some(b => b.toLowerCase().includes(f.toLowerCase())))
}
export default function ThingsToDoPage() {
  return <ExplorePage title="Things To Do" icon="Discover" filterOptions={FILTERS} filterFn={filterFn} />
}
