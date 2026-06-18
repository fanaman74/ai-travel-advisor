export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

export async function POST(req: NextRequest) {
  const { message, locationContext, history } = await req.json()

  const systemPrompt = `You are a knowledgeable travel assistant. The user is currently in ${locationContext?.city ?? 'an unknown location'}, ${locationContext?.country ?? ''}.
Help them discover great experiences, answer travel questions, and suggest what to do.
Be concise, friendly, and specific to their location.`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []),
    { role: 'user', content: message },
  ]

  const stream = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages,
    stream: true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}