import { classifyPlaceType, mergePlaces } from '@/worker/merge-places'
import type { RawApifyPlace } from '@/types'

const base: RawApifyPlace = {
  title: 'Grand Cafe',
  latitude: 51.2093,
  longitude: 3.2247,
  totalScore: 4.5,
  reviewsCount: 200,
  address: 'Market Square 1',
  placeId: 'gm_001',
}

describe('mergePlaces', () => {
  it('keeps a single place as-is', () => {
    const result = mergePlaces([base])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Grand Cafe')
  })

  it('deduplicates places within 50m with same name', () => {
    const nearby: RawApifyPlace = {
      ...base,
      latitude: 51.20931,  // ~1m away
      longitude: 3.22471,
      placeId: 'ta_001',
    }
    const result = mergePlaces([base, nearby])
    expect(result).toHaveLength(1)
  })

  it('keeps distinct places more than 50m apart', () => {
    const farAway: RawApifyPlace = {
      ...base,
      title: 'Another Cafe',
      latitude: 51.2200,
      longitude: 3.2400,
      placeId: 'gm_002',
    }
    const result = mergePlaces([base, farAway])
    expect(result).toHaveLength(2)
  })

  it('normalises missing name from title field', () => {
    const result = mergePlaces([{ ...base, title: 'Title Place', name: undefined }])
    expect(result[0].name).toBe('Title Place')
  })

  it('normalises coordinates from current Google Maps actor location field', () => {
    const result = mergePlaces([{
      title: 'Location Field Cafe',
      location: { lat: 50.9024, lng: 4.3711 },
      totalScore: 4.8,
      placeId: 'gm_location',
    }])

    expect(result).toHaveLength(1)
    expect(result[0].latitude).toBe(50.9024)
    expect(result[0].longitude).toBe(4.3711)
  })

  it('classifies restaurants and hotels from Google categories', () => {
    expect(classifyPlaceType('Italian restaurant')).toBe('restaurant')
    expect(classifyPlaceType('Cafe')).toBe('restaurant')
    expect(classifyPlaceType('Hotel')).toBe('hotel')
    expect(classifyPlaceType('Parking garage')).toBe('essential')
    expect(classifyPlaceType('Museum')).toBe('attraction')
  })
})
