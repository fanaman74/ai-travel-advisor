import { ExplorePage } from '../ExplorePage'
export default function ScenicViewsPage() {
  return <ExplorePage title="Scenic Views" icon="🌅" filterOptions={['Sunset','Sunrise','Photography','Walking']} emptyMessage="No scenic viewpoints found nearby." />
}
