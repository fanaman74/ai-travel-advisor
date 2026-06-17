const mockCreate = jest.fn()

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  }
})

import {
  enrichPlaces,
  generateAreaBriefing,
  generateRecommendations,
  generateItinerary,
} from '@/lib/ai'

describe('enrichPlaces', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('returns enrichment for each place', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                summary: 'Great museum',
                pros: ['free entry'],
                cons: ['crowded'],
                best_for: ['history lovers'],
                visit_duration: '2 hours',
                hidden_gem_score: 45,
                tourist_trap_score: 20,
              },
            ]),
          },
        },
      ],
    })

    const result = await enrichPlaces([
      {
        name: 'City Museum',
        type: 'attraction',
        rating: 4.5,
        reviews: [],
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].summary).toBe('Great museum')
    expect(result[0].hidden_gem_score).toBe(45)
  })

  it('returns empty defaults on JSON parse failure', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    })

    const result = await enrichPlaces([
      {
        name: 'City Museum',
        type: 'attraction',
        rating: 4.5,
        reviews: [],
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].summary).toBe('')
    expect(result[0].hidden_gem_score).toBe(50)
  })

  it('pads results if AI returns fewer items than places', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                summary: 'Only one',
                pros: [],
                cons: [],
                best_for: [],
                visit_duration: '1h',
                hidden_gem_score: 50,
                tourist_trap_score: 30,
              },
            ]),
          },
        },
      ],
    })

    const result = await enrichPlaces([
      {
        name: 'Place A',
        type: 'attraction',
        rating: 4.0,
        reviews: [],
      },
      {
        name: 'Place B',
        type: 'restaurant',
        rating: 4.5,
        reviews: [],
      },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].summary).toBe('Only one')
    expect(result[1].summary).toBe('')
    expect(result[1].hidden_gem_score).toBe(50)
    expect(result[1].tourist_trap_score).toBe(50)
  })
})

describe('generateAreaBriefing', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('returns a briefing string', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'You are in central Bruges.' } }],
    })

    const briefing = await generateAreaBriefing({
      city: 'Bruges',
      district: 'Centre',
      attractionCount: 14,
      restaurantCount: 6,
      eventCount: 2,
    })

    expect(typeof briefing).toBe('string')
    expect(briefing.length).toBeGreaterThan(0)
    expect(briefing).toContain('Bruges')
  })
})

describe('generateRecommendations', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('returns array of recommendations', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                place_name: 'Museum of Fine Arts',
                reason: 'Perfect for afternoon culture',
              },
              {
                place_name: 'Central Park',
                reason: 'Great for evening walks',
              },
            ]),
          },
        },
      ],
    })

    const result = await generateRecommendations({
      city: 'Brussels',
      timeOfDay: 'evening',
      preferences: { art: true, outdoors: true },
      places: [
        { name: 'Museum of Fine Arts', type: 'attraction', summary: 'Art museum' },
        { name: 'Central Park', type: 'park', summary: 'Green space' },
      ],
    })

    expect(result).toHaveLength(2)
    expect(result[0].place_name).toBe('Museum of Fine Arts')
    expect(result[0].reason).toContain('afternoon')
  })

  it('returns empty array on JSON parse failure', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'invalid json' } }],
    })

    const result = await generateRecommendations({
      city: 'Brussels',
      timeOfDay: 'evening',
      preferences: { art: true },
      places: [{ name: 'Test', type: 'test', summary: null }],
    })

    expect(result).toEqual([])
  })
})

describe('generateItinerary', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('returns itinerary with stops', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Perfect Day in Amsterdam',
              stops: [
                {
                  time: '09:00',
                  place_id: null,
                  name: 'Anne Frank House',
                  duration: '1.5 hours',
                  notes: 'Book ahead',
                },
                {
                  time: '11:00',
                  place_id: null,
                  name: 'Canal Cruise',
                  duration: '1 hour',
                  notes: 'Bring camera',
                },
              ],
            }),
          },
        },
      ],
    })

    const result = await generateItinerary({
      city: 'Amsterdam',
      durationHours: 4,
      preferences: { history: true, culture: true },
      places: [
        {
          name: 'Anne Frank House',
          type: 'museum',
          visit_duration: '1.5 hours',
          address: 'Prinsengracht 263-267',
        },
        {
          name: 'Canal Cruise',
          type: 'activity',
          visit_duration: '1 hour',
          address: null,
        },
      ],
    })

    expect(result.title).toBe('Perfect Day in Amsterdam')
    expect(result.stops).toHaveLength(2)
    expect(result.stops[0].name).toBe('Anne Frank House')
  })

  it('strips markdown code fences from response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: `\`\`\`json
{
  "title": "Day in Paris",
  "stops": [
    {
      "time": "10:00",
      "place_id": null,
      "name": "Louvre",
      "duration": "2 hours",
      "notes": "Popular"
    }
  ]
}
\`\`\``,
          },
        },
      ],
    })

    const result = await generateItinerary({
      city: 'Paris',
      durationHours: 4,
      preferences: { art: true },
      places: [
        {
          name: 'Louvre',
          type: 'museum',
          visit_duration: '2 hours',
          address: 'Rue de Rivoli',
        },
      ],
    })

    expect(result.title).toBe('Day in Paris')
    expect(result.stops[0].name).toBe('Louvre')
  })

  it('returns default itinerary on JSON parse failure', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    })

    const result = await generateItinerary({
      city: 'London',
      durationHours: 4,
      preferences: {},
      places: [],
    })

    expect(result.title).toContain('London')
    expect(result.stops).toEqual([])
  })
})
