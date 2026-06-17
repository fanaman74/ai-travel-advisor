import OpenAI from 'openai'

export interface PlaceInput {
  name: string
  type: string
  rating: number | null
  reviews: string[]
}

export interface PlaceEnrichment {
  summary: string
  pros: string[]
  cons: string[]
  best_for: string[]
  visit_duration: string
  hidden_gem_score: number
  tourist_trap_score: number
}

export interface AreaBriefingInput {
  city: string
  district: string
  attractionCount: number
  restaurantCount: number
  eventCount: number
}

export interface Recommendation {
  place_name: string
  reason: string
}

export interface ItineraryStop {
  time: string
  place_id: null
  name: string
  duration: string
  notes: string
}

export interface Itinerary {
  title: string
  stops: ItineraryStop[]
}

function getClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  })
}

export async function enrichPlaces(
  places: PlaceInput[]
): Promise<PlaceEnrichment[]> {
  const client = getClient()

  const prompt = `For each of these places, provide enrichment data as a JSON array:
${places
  .map(
    (p) =>
      `- ${p.name} (${p.type}, rating: ${p.rating || 'N/A'}, ${p.reviews.length} reviews)`
  )
  .join('\n')}

Respond with ONLY a valid JSON array. Each item must have:
{
  "summary": "brief description",
  "pros": ["advantage 1", "advantage 2"],
  "cons": ["disadvantage 1"],
  "best_for": ["group 1", "group 2"],
  "visit_duration": "X hours/minutes",
  "hidden_gem_score": number 0-100,
  "tourist_trap_score": number 0-100
}`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.choices[0]?.message?.content || ''

  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          summary: item.summary ?? '',
          pros: item.pros ?? [],
          cons: item.cons ?? [],
          best_for: item.best_for ?? [],
          visit_duration: item.visit_duration ?? '',
          hidden_gem_score: item.hidden_gem_score ?? 0,
          tourist_trap_score: item.tourist_trap_score ?? 0,
        }))
      : [
          {
            summary: '',
            pros: [],
            cons: [],
            best_for: [],
            visit_duration: '',
            hidden_gem_score: 0,
            tourist_trap_score: 0,
          },
        ]
  } catch {
    return places.map(() => ({
      summary: '',
      pros: [],
      cons: [],
      best_for: [],
      visit_duration: '',
      hidden_gem_score: 0,
      tourist_trap_score: 0,
    }))
  }
}

export async function generateAreaBriefing(
  input: AreaBriefingInput
): Promise<string> {
  const client = getClient()

  const prompt = `Write a brief, atmospheric briefing for a visitor arriving in ${input.district}, ${input.city}.
Include:
- A welcoming introduction
- What they'll find here (${input.attractionCount} attractions, ${input.restaurantCount} restaurants, ${input.eventCount} events)
- Local character and vibe

Keep it to 2-3 sentences. Be poetic but informative.`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
  })

  return response.choices[0]?.message?.content || ''
}

export async function generateRecommendations(input: {
  city: string
  timeOfDay: string
  preferences: Record<string, boolean>
  places: Array<{ name: string; type: string; summary: string | null }>
}): Promise<Recommendation[]> {
  const client = getClient()

  const prefs = Object.entries(input.preferences)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const prompt = `Given these places in ${input.city} and the user's preferences (${prefs}), recommend 2-3 places for ${input.timeOfDay}.

Places:
${input.places
  .map((p) => `- ${p.name} (${p.type}): ${p.summary || 'No description'}`)
  .join('\n')}

Respond with ONLY a valid JSON array with no markdown formatting:
[
  {
    "place_name": "Place Name",
    "reason": "Why this is good for them at this time"
  }
]`

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.choices[0]?.message?.content || ''

  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function generateItinerary(input: {
  city: string
  durationHours: number
  preferences: Record<string, boolean>
  places: Array<{
    name: string
    type: string
    visit_duration: string | null
    address: string | null
  }>
}): Promise<Itinerary> {
  const client = getClient()

  const prefs = Object.entries(input.preferences)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const prompt = `Create a ${input.durationHours}-hour itinerary for ${input.city} with user preferences: ${prefs || 'flexible'}.

Available places:
${input.places
  .map(
    (p) =>
      `- ${p.name} (${p.type}, ${p.visit_duration || 'duration unknown'}): ${p.address || 'address unknown'}`
  )
  .join('\n')}

Respond with ONLY a valid JSON object (no markdown):
{
  "title": "Catchy itinerary name",
  "stops": [
    {
      "time": "HH:MM",
      "place_id": null,
      "name": "Place name",
      "duration": "X hours/minutes",
      "notes": "Practical tips"
    }
  ]
}`

  const response = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages: [{ role: 'user', content: prompt }],
  })

  let content = response.choices[0]?.message?.content || ''

  // Strip markdown code fences
  content = content
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(content)
    return {
      title: parsed.title ?? `Itinerary for ${input.city}`,
      stops: Array.isArray(parsed.stops)
        ? parsed.stops.map((stop) => ({
            time: stop.time ?? '',
            place_id: null,
            name: stop.name ?? '',
            duration: stop.duration ?? '',
            notes: stop.notes ?? '',
          }))
        : [],
    }
  } catch {
    return {
      title: `Itinerary for ${input.city}`,
      stops: [],
    }
  }
}
