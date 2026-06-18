import { ExplorePage } from '../ExplorePage'
export default function EventsPage() {
  return <ExplorePage title="Events" icon="🎉" type="event" filterOptions={['Today','This Week','Free','Concerts','Festivals']} emptyMessage="No events found nearby." />
}
