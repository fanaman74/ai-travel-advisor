import Link from 'next/link'

const ACTIONS = [
  { label: 'Experiences', eyebrow: 'Discover', href: '/explore/things-to-do', image: '/category-experiences.svg', tint: '#fff5f0' },
  { label: 'Restaurants', eyebrow: 'Dine', href: '/explore/restaurants', image: '/category-restaurants.svg', tint: '#fff7ee' },
  { label: 'Attractions', eyebrow: 'Culture', href: '/explore/attractions', image: '/category-attractions.svg', tint: '#f9f4ff' },
  { label: 'Events Today', eyebrow: 'Tonight', href: '/explore/events', image: '/category-events.svg', tint: '#fff3f8' },
  { label: 'Hidden Gems', eyebrow: 'Local', href: '/explore/hidden-gems', image: '/category-hidden-gems.svg', tint: '#f3fbff' },
  { label: 'Scenic Views', eyebrow: 'Outdoors', href: '/explore/scenic-views', image: '/category-scenic-views.svg', tint: '#f4fff7' },
  { label: 'Walking Tours', eyebrow: 'Route', href: '/itinerary', image: '/category-walking-tours.svg', tint: '#fff8f1' },
  { label: 'Hotels Nearby', eyebrow: 'Stay', href: '/explore/hotels', image: '/category-hotels.svg', tint: '#f4f6ff' },
]

export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map(action => (
        <Link
          key={action.href}
          href={action.href}
          className="airbnb-card overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <div className="aspect-[1.18/1] overflow-hidden" style={{ backgroundColor: action.tint }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={action.image}
              alt={`${action.label} illustration`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{action.eyebrow}</p>
              <p className="mt-1 text-sm font-semibold leading-tight text-[#222222]">{action.label}</p>
            </div>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[#444444]">Open</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
