import Link from 'next/link'
const ACTIONS = [
  { label: 'Experiences', icon: 'Discover', href: '/explore/things-to-do' },
  { label: 'Restaurants', icon: 'Dine', href: '/explore/restaurants' },
  { label: 'Attractions', icon: 'Culture', href: '/explore/attractions' },
  { label: 'Events Today', icon: 'Tonight', href: '/explore/events' },
  { label: 'Hidden Gems', icon: 'Local', href: '/explore/hidden-gems' },
  { label: 'Scenic Views', icon: 'Outdoors', href: '/explore/scenic-views' },
  { label: 'Walking Tours', icon: 'Route', href: '/itinerary' },
  { label: 'Hotels Nearby', icon: 'Stay', href: '/explore/hotels' },
]
export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map(action => (
        <Link key={action.href} href={action.href}
          className="airbnb-card flex items-center justify-between gap-3 px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{action.icon}</p>
            <p className="mt-1 text-sm font-semibold leading-tight text-[#222222]">{action.label}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-lg text-[#222222]">→</span>
        </Link>
      ))}
    </div>
  )
}
