import { ExplorePage } from '../ExplorePage'
export default function RestaurantsPage() {
  return <ExplorePage title="Restaurants" icon="🍽️" type="restaurant" filterOptions={['Open Now','Budget','Fine Dining','Local Cuisine','Fast Food']} emptyMessage="No restaurants found nearby. Try a larger radius." />
}
