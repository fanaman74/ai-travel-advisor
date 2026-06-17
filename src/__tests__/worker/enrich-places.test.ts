import { enrichInBatches } from '@/worker/enrich-places'
import * as ai from '@/lib/ai'

jest.mock('@/lib/ai')

describe('enrichInBatches', () => {
  it('calls enrichPlaces in batches of 10', async () => {
    const mockEnrich = ai.enrichPlaces as jest.Mock
    mockEnrich.mockImplementation((batch) =>
      Promise.resolve(
        batch.map(() => ({
          summary: 'Nice place',
          pros: [],
          cons: [],
          best_for: [],
          visit_duration: '1 hour',
          hidden_gem_score: 50,
          tourist_trap_score: 30,
        }))
      )
    )

    const places = Array(15).fill({
      name: 'Test Place',
      type: 'attraction',
      rating: 4.0,
      reviews: [],
    })

    const result = await enrichInBatches(places)

    expect(mockEnrich).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(15)
  })

  it('returns empty array for empty input', async () => {
    const result = await enrichInBatches([])
    expect(result).toHaveLength(0)
  })
})
