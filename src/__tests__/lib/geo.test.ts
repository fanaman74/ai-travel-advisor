import { toGeohash, haversineMeters, arePlacesClose } from '@/lib/geo'

describe('toGeohash', () => {
  it('returns a 6-character geohash for known coordinates', () => {
    const hash = toGeohash(51.2093, 3.2247)
    expect(hash).toHaveLength(6)
    expect(typeof hash).toBe('string')
  })

  it('returns the same hash for coordinates within ~1.2km', () => {
    const h1 = toGeohash(51.2093, 3.2247)
    const h2 = toGeohash(51.2100, 3.2250)
    expect(h1).toBe(h2)
  })
})

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(51.2093, 3.2247, 51.2093, 3.2247)).toBe(0)
  })

  it('returns ~111km for 1 degree latitude difference', () => {
    const dist = haversineMeters(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(110_000)
    expect(dist).toBeLessThan(112_000)
  })
})

describe('arePlacesClose', () => {
  it('returns true for places within 50m', () => {
    expect(arePlacesClose(51.2093, 3.2247, 51.2094, 3.2248)).toBe(true)
  })

  it('returns false for places more than 50m apart', () => {
    expect(arePlacesClose(51.2093, 3.2247, 51.2200, 3.2400)).toBe(false)
  })
})
