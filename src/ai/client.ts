import { AIVerification, Finding } from '../types'

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

export interface StreamingOptions {
  onThinking?: (thought: string) => void
  onChunk?: (chunk: string) => void
  onDone?: (full: string) => void
  signal?: AbortSignal
}

export async function callMistral(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: StreamingOptions = {}
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
        max_tokens: 3000,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let hasShownFirstChunk = false

    while (true) {
      if (options.signal?.aborted) {
        reader.cancel()
        return { status: 'interrupted', explanation: 'Analysis interrupted' }
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              
              if (!hasShownFirstChunk && options.onThinking) {
                hasShownFirstChunk = true
              }
              
              if (options.onChunk) {
                options.onChunk(content)
              }
            }
          } catch {}
        }
      }
    }

    if (options.onDone) {
      options.onDone(fullContent)
    }

    return parseAIResponse(fullContent)
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return {
        status: 'interrupted',
        explanation: 'Analysis was interrupted by user'
      }
    }
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
      if (line.toLowerCase().includes('confirmed') || line.toLowerCase().includes('real') || line.toLowerCase().includes('vulnerability')) {
        status = 'confirmed'
      } else if (line.toLowerCase().includes('false positive') || line.toLowerCase().includes('dismiss') || line.toLowerCase().includes('not a vulnerability')) {
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
  promptFn: (finding: any, context: string) => string,
  options: StreamingOptions = {}
): Promise<AIVerification> {
  const lines = fileContent.split('\n')
  const start = Math.max(0, finding.line - 15)
  const end = Math.min(lines.length, finding.line + 15)
  const context = lines.slice(start, end).join('\n')

  const prompt = promptFn({ ...finding, context }, context)
  
  if (options.onThinking) {
    options.onThinking(`Verifying: ${finding.file.split('/').pop()}:${finding.line}`)
  }
  
  const response = await callMistral(apiKey, [
    { role: 'system', content: getExpertSystemPrompt() },
    { role: 'user', content: prompt }
  ], options)

  return {
    findingId: finding.id,
    status: response.status as any,
    explanation: response.explanation,
    fix: response.fix
  }
}

export async function deepScanWithProgress(
  file: { path: string; content: string },
  apiKey: string,
  options: StreamingOptions = {}
): Promise<Finding[]> {
  const prompt = getDeepScanExpertPrompt(file.content, file.path)
  
  if (options.onThinking) {
    options.onThinking(`Analyzing ${file.path.split('/').pop()}`)
  }

  const response = await callMistral(apiKey, [
    { role: 'system', content: getExpertSystemPrompt() },
    { role: 'user', content: prompt }
  ], options)

  return parseDeepScanResponse(response.explanation, file.path)
}

function getExpertSystemPrompt(): string {
  return `You are a security vulnerability scanner. Always respond with valid JSON array format. No explanations, no markdown, just JSON.`
}

function getDeepScanExpertPrompt(fileContent: string, filePath: string): string {
  return `You are a security vulnerability scanner. Analyze the following code for security issues.

FILE: ${filePath}

CODE:
${fileContent}

Find these types of vulnerabilities:
- SQL Injection (string concatenation in queries)
- XSS (innerHTML, dangerouslySetInnerHTML)  
- Command Injection (exec, spawn, eval)
- Path Traversal
- Hardcoded Secrets
- Insecure Random
- XXE
- Deserialization

IMPORTANT: Look carefully at every line of code for these patterns.

For each vulnerability found, respond with EXACTLY this JSON format (nothing else):
[{"line": LINE_NUMBER, "title": "Issue title", "category": "category", "severity": "critical|high|medium|low", "explanation": "Why this is vulnerable", "fix": "How to fix"}]

If no vulnerabilities found, respond with exactly: []`
}

function parseDeepScanResponse(content: string, filePath: string): Finding[] {
  try {
    let jsonMatch = content.match(/\[[\s\S]*\]/)
    
    if (!jsonMatch) {
      jsonMatch = content.match(/```json\n\[[\s\S]*\]\n```/)
    }
    
    if (!jsonMatch) {
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.toLowerCase().includes('sql injection') || 
            line.toLowerCase().includes('xss') ||
            line.toLowerCase().includes('command injection') ||
            line.toLowerCase().includes('path traversal') ||
            line.toLowerCase().includes('hardcoded secret')) {
          return [{
            id: `${filePath}:1:deepscan`,
            title: "Security vulnerability detected",
            severity: 'high' as const,
            file: filePath,
            line: 1,
            code: content.slice(0, 100),
            message: content.slice(0, 500),
            fix: "Review and fix the security issue",
            category: 'deepscan',
            aiStatus: 'confirmed' as const,
            aiExplanation: content.slice(0, 500),
            aiFix: "Review and fix"
          }]
        }
      }
      return []
    }

    const issues = JSON.parse(jsonMatch[0]) as any[]
    
    return issues.map((issue: any) => ({
      id: `${filePath}:${issue.line}:deepscan`,
      title: issue.title,
      severity: mapSeverity(issue.severity),
      file: filePath,
      line: issue.line,
      code: '',
      message: issue.explanation,
      fix: issue.fix,
      category: issue.category || 'deepscan',
      aiStatus: 'confirmed' as const,
      aiExplanation: issue.explanation,
      aiFix: issue.fix
    }))
  } catch (e) {
    return []
  }
}

function mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const map: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'info'
  }
  return map[severity] || 'medium'
}
