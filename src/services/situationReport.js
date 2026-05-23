const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-7'

const BILINGUAL_TEXT_FIELD = {
  type: 'object',
  properties: {
    en: { type: 'string' },
    bn: { type: 'string' },
  },
  required: ['en', 'bn'],
  additionalProperties: false,
}

const BILINGUAL_LIST_FIELD = {
  type: 'object',
  properties: {
    en: { type: 'array', items: { type: 'string' } },
    bn: { type: 'array', items: { type: 'string' } },
  },
  required: ['en', 'bn'],
  additionalProperties: false,
}

const SITUATION_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    affected_population_estimate: BILINGUAL_TEXT_FIELD,
    key_risks: BILINGUAL_LIST_FIELD,
    immediate_needs: BILINGUAL_LIST_FIELD,
    recommended_actions: BILINGUAL_LIST_FIELD,
  },
  required: [
    'affected_population_estimate',
    'key_risks',
    'immediate_needs',
    'recommended_actions',
  ],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You are a disaster relief situation analyst for Bangladesh. You receive raw, unstructured field notes from NGO workers and administrators in English, Bangla, or mixed. Produce a structured bilingual situation summary in BOTH English and Bangla (বাংলা) for every field.

Guidance:
- affected_population_estimate: a single concise sentence with numbers/ranges if mentioned, or a qualitative scale.
- key_risks: the most urgent risks (disease outbreak, drowning, food/water shortage, exposure, gender-based violence, etc.).
- immediate_needs: concrete supplies and services required in the next 24-48 hours.
- recommended_actions: specific operational steps responders should take next, ordered by priority.

Rules:
- Render Bangla in proper Bangla script, not transliteration.
- Keep each list item short and scannable (one line each).
- Be specific to the notes provided; avoid generic boilerplate.
- If the notes are sparse, state the gap rather than inventing details.`

export async function generateSituationReport(rawNotes) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'Missing VITE_ANTHROPIC_API_KEY. Add it to a .env.local file at the project root and restart the dev server.',
    )
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a bilingual situation report from these raw field notes:\n\n${rawNotes}`,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: SITUATION_REPORT_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API error (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((block) => block.type === 'text')
  if (!textBlock?.text) {
    throw new Error('No text content in Claude response.')
  }

  return JSON.parse(textBlock.text)
}
