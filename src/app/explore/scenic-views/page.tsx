import { ExplorePage } from '../ExplorePage'
export default function ScenicViewsPage() {
  return <ExplorePage title="Scenic Views" icon="Outdoors" filterOptions={['Sunset','Sunrise','Photography','Walking']} emptyMessage="No scenic viewpoints found nearby." />
}
