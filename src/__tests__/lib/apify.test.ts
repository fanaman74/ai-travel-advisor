import { runGoogleMapsScraper, runGoogleMapsReviewsScraper, runTripAdvisorScraper, runEventbriteScraper } from '@/lib/apify'
import { ApifyClient } from 'apify-client'

jest.mock('apify-client')

const mockDatasetListItems = jest.fn()
const mockActorCall = jest.fn()
const mockActor = jest.fn(() => ({ call: mockActorCall }))

;(ApifyClient as jest.Mock).mockImplementation(() => ({
  actor: mockActor,
  dataset: () => ({ listItems: mockDatasetListItems }),
}))

describe('runGoogleMapsScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APIFY_API_KEY = 'test-api-key'
    delete process.env.APIFY_GOOGLE_MAPS_MAX_PLACES_PER_SEARCH
  })

  it('returns array of raw places', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({
      items: [
        { title: 'Cafe Bruges', latitude: 51.2093, longitude: 3.2247, totalScore: 4.5 },
      ],
    })

    const results = await runGoogleMapsScraper({ lat: 51.2093, lng: 3.2247, radius: 1000 })

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Cafe Bruges')
  })

  it('calls actor with correct actor ID and input parameters', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({ items: [] })

    await runGoogleMapsScraper({ lat: 51.2093, lng: 3.2247, radius: 1000 })

    expect(mockActor).toHaveBeenCalledWith('compass/crawler-google-places')
    expect(mockActorCall).toHaveBeenCalled()
    const callArgs = mockActorCall.mock.calls[0][0]
    expect(callArgs.searchStringsArray).toBeDefined()
    expect(Array.isArray(callArgs.searchStringsArray)).toBe(true)
    expect(callArgs.searchStringsArray[0]).toBe('restaurants')
    expect(callArgs.customGeolocation).toEqual({
      type: 'Point',
      coordinates: [3.2247, 51.2093],
    })
    expect(callArgs.maxCrawledPlacesPerSearch).toBe(5)
    expect(callArgs.maxCrawledPlaces).toBe(30)
    expect(callArgs.language).toBe('en')
  })
})

describe('runGoogleMapsReviewsScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APIFY_API_KEY = 'test-api-key'
    delete process.env.APIFY_GOOGLE_MAPS_MAX_REVIEWS_PER_PLACE
  })

  it('returns array of reviews with place IDs', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({
      items: [
        {
          placeId: 'place1',
          reviews: [
            { text: 'Great place!', rating: 5, name: 'John', publishedAtDate: '2024-01-01' },
          ],
        },
      ],
    })

    const results = await runGoogleMapsReviewsScraper(['place1'])

    expect(results).toHaveLength(1)
    expect(results[0].placeId).toBe('place1')
    expect(results[0].reviews).toHaveLength(1)
  })

  it('returns empty array for empty placeIds input', async () => {
    const results = await runGoogleMapsReviewsScraper([])

    expect(results).toEqual([])
    expect(mockActorCall).not.toHaveBeenCalled()
  })

  it('calls actor with maxReviewsPerPlace set to 3', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({ items: [] })

    await runGoogleMapsReviewsScraper(['place1'])

    expect(mockActor).toHaveBeenCalledWith('compass/Google-Maps-Reviews-Scraper')
    expect(mockActorCall).toHaveBeenCalled()
    const callArgs = mockActorCall.mock.calls[0][0]
    expect(callArgs.maxReviewsPerPlace).toBe(3)
  })
})

describe('runTripAdvisorScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APIFY_API_KEY = 'test-api-key'
    process.env.APIFY_TRIPADVISOR_LOCATION = 'Vilvoorde, Belgium'
  })

  it('returns array of raw places from TripAdvisor', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({
      items: [
        { title: 'Museum XYZ', latitude: 51.2093, longitude: 3.2247, rating: 4.6 },
      ],
    })

    const results = await runTripAdvisorScraper({ lat: 51.2093, lng: 3.2247 })

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Museum XYZ')
    expect(mockActor).toHaveBeenCalledWith('maxcopell/tripadvisor')
    expect(mockActorCall.mock.calls[0][0].query).toBe('Vilvoorde, Belgium')
  })
})

describe('runEventbriteScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APIFY_API_KEY = 'test-api-key'
    process.env.APIFY_EVENTBRITE_COUNTRY = 'belgium'
    process.env.APIFY_EVENTBRITE_CITY = 'Vilvoorde'
  })

  it('returns array of raw places from Eventbrite', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({
      items: [
        { title: 'Concert Event', latitude: 51.2093, longitude: 3.2247 },
      ],
    })

    const results = await runEventbriteScraper({ lat: 51.2093, lng: 3.2247 })

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Concert Event')
    expect(mockActor).toHaveBeenCalledWith('aitorsm/eventbrite')
  })

  it('calls actor with today\'s ISO date as startDate', async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds123' })
    mockDatasetListItems.mockResolvedValue({ items: [] })

    await runEventbriteScraper({ lat: 51.2093, lng: 3.2247 })

    expect(mockActorCall).toHaveBeenCalled()
    const callArgs = mockActorCall.mock.calls[0][0]
    expect(callArgs.country).toBe('belgium')
    expect(callArgs.city).toBe('Vilvoorde')
    expect(callArgs.startDate).toBeDefined()
    expect(callArgs.maxResults).toBe(20)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    expect(callArgs.startDate).toMatch(datePattern)
  })
})
