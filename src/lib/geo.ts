import ngeohash from 'ngeohash'

export function toGeohash(lat: number, lng: number, precision = 6): string {
  return ngeohash.encode(lat, lng, precision)
}

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function arePlacesClose(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  thresholdMeters = 50
): boolean {
  return haversineMeters(lat1, lng1, lat2, lng2) <= thresholdMeters
}
