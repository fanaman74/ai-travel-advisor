import { ExplorePage } from '../ExplorePage'
export default function HotelsPage() {
  return <ExplorePage title="Hotels Nearby" icon="Stays" type="hotel" filterOptions={['Budget','Mid-range','Luxury']} />
}
