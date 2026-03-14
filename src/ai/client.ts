import { AIVerification } from '../types'

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export async function callMistral(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<{ status: string; explanation: string; fix?: string }> {
  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'devstral-2512',
        messages,
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json() as any
    const content = data.choices[0]?.message?.content || ''

    return parseAIResponse(content)
  } catch (error) {
    return {
      status: 'error',
      explanation: `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

function parseAIResponse(content: string): { status: string; explanation: string; fix?: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        status: parsed.status || 'unverified',
        explanation: parsed.explanation || 'No explanation provided',
        fix: parsed.fix
      }
    }

    const lines = content.split('\n')
    let status = 'unverified'
    let explanation = content
    let fix: string | undefined

    for (const line of lines) {
      if (line.toLowerCase().includes('confirmed') || line.toLowerCase().includes('real')) {
        status = 'confirmed'
      } else if (line.toLowerCase().includes('false positive') || line.toLowerCase().includes('dismiss')) {
        status = 'false-positive'
      }
      if (line.toLowerCase().startsWith('fix:') || line.toLowerCase().startsWith('suggestion:')) {
        fix = line.substring(5).trim()
      }
    }

    return { status, explanation, fix }
  } catch {
    return {
      status: 'unverified',
      explanation: 'Failed to parse AI response'
    }
  }
}

export async function verifySingleFinding(
  finding: { id: string; title: string; message: string; file: string; line: number; code: string; category: string },
  fileContent: string,
  apiKey: string,
  promptFn: (finding: any, context: string) => string
): Promise<AIVerification> {
  const lines = fileContent.split('\n')
  const start = Math.max(0, finding.line - 15)
  const end = Math.min(lines.length, finding.line + 15)
  const context = lines.slice(start, end).join('\n')

  const prompt = promptFn({ ...finding, context }, context)
  
  const response = await callMistral(apiKey, [
    { role: 'system', content: 'You are a security expert. Analyze code for vulnerabilities.' },
    { role: 'user', content: prompt }
  ])

  return {
    findingId: finding.id,
    status: response.status as any,
    explanation: response.explanation,
    fix: response.fix
  }
}
