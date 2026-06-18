import Link from 'next/link'
const ACTIONS = [
  { label: 'Things To Do', icon: '🎯', href: '/explore/things-to-do' },
  { label: 'Restaurants', icon: '🍽️', href: '/explore/restaurants' },
  { label: 'Attractions', icon: '🏛️', href: '/explore/attractions' },
  { label: 'Events Today', icon: '🎉', href: '/explore/events' },
  { label: 'Hidden Gems', icon: '💎', href: '/explore/hidden-gems' },
  { label: 'Scenic Views', icon: '🌅', href: '/explore/scenic-views' },
  { label: 'Walking Tours', icon: '🚶', href: '/itinerary' },
  { label: 'Hotels Nearby', icon: '🏨', href: '/explore/hotels' },
]
export function QuickActionGrid() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {ACTIONS.map(action => (
        <Link key={action.href} href={action.href}
          className="flex flex-col items-center gap-1 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
          <span className="text-2xl">{action.icon}</span>
          <span className="text-xs text-gray-600 text-center leading-tight font-medium">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}
