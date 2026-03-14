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
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json() as any
    const content = data.choices[0]?.message?.content || ''

    if (options.onDone) {
      options.onDone(content)
    }

    return parseAIResponse(content)
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
    options.onThinking(`Analyzing ${finding.file}:${finding.line} - ${finding.title}`)
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
    options.onThinking(`Initiating deep security analysis on ${file.path}`)
    options.onThinking(`Reviewing code structure and identifying attack surfaces`)
  }

  const response = await callMistral(apiKey, [
    { role: 'system', content: getExpertSystemPrompt() },
    { role: 'user', content: prompt }
  ], options)

  return parseDeepScanResponse(response.explanation, file.path)
}

function getExpertSystemPrompt(): string {
  return `You are VULNIX AI - an elite security researcher with 50+ years of experience. You've discovered 1000+ CVEs, published in Black Hat, DEF CON, and are an OWASP contributor.

## YOUR IDENTITY & THOUGHT PROCESS

When analyzing code, you think like this:
1. "Let me understand what this code does first..."
2. "Looking at the data flow, I see potential for..."
3. "But wait - is this actually exploitable in practice?"
4. "Let me check if there are any mitigating factors..."
5. "Given the context, this is/isn't a real vulnerability because..."

## CRITICAL RULES

- ALWAYS consider FALSE POSITIVES first - most code patterns are NOT vulnerabilities
- Check if inputs are sanitized, validated, or come from trusted sources
- Consider if the vulnerability requires authentication, network access, or specific conditions
- Test files, mocks, and node_modules are ALWAYS ignored
- Only confirm if there's a REAL, EXPLOITABLE security issue

## WHAT TO IGNORE

- node_modules/, vendor/, dependencies (external code)
- Test files (*.test.ts, *.spec.ts, __tests__, *.test.js)
- Mock data, fixtures, stubs
- Commented-out code
- TODO/FIXME comments
- Build outputs (dist/, build/, .next/)
- Configuration files (config.json, .env.example)
- Package lock files
- Debug code that only runs in development

## RESPONSE FORMAT (JSON only)

{
  "status": "confirmed" | "false-positive",
  "explanation": "Your expert analysis with clear reasoning",
  "fix": "Specific remediation",
  "reason": "Why you reached this conclusion"
}

Think carefully. Be decisive. When in doubt, lean toward false-positive.`
}

function getDeepScanExpertPrompt(fileContent: string, filePath: string): string {
  return `Perform a DEEP SECURITY ANALYSIS of this file:

## File: ${filePath}

## Code:
\`\`\`
${fileContent}
\`\`\`

## Instructions:

1. First, analyze the FILE PURPOSE and CONTEXT:
   - What does this file do?
   - What are the entry points?
   - What data does it process?
   - What are the trust boundaries?

2. Then check for these ADVANCED VULNERABILITIES that regex can't detect:

   a) **Business Logic Flaws**
      - Authentication bypass via race conditions
      - Authorization flaws in workflow
      - Price/total calculation manipulation
      - Session fixation
      
   b) **Data Flow Issues**
      - Sensitive data in logs
      - Unencrypted data transmission
      - Improper input validation chains
      - Path traversal through user input
      
   c) **API Security**
      - Missing rate limiting
      - IDOR vulnerabilities
      - SSRF via URL parameters
      - GraphQL issues
      
   d) **Crypto & Secrets**
      - Weak random number generation
      - Hardcoded seeds
      - Insufficient key sizes
      - ECB mode usage
      
   e) **Modern Framework Issues**
      - React: dangerouslySetInnerHTML without sanitization
      - Express: missing security headers
      - Next.js: server actions without validation
      - Django: raw SQL in ORM

3. For each issue found, provide:
   - Exact line number
   - CWE ID
   - CVSS score estimate (0-10)
   - Proof of concept if possible
   - Concrete fix

4. IGNORE:
   - node_modules imports (external code)
   - Test files
   - Configuration files
   - Commented code

Respond in JSON array format:
[
  {
    "line": 42,
    "title": "SQL Injection in user query",
    "category": "injection",
    "severity": "critical",
    "cwe": "CWE-89",
    "cvss": 9.8,
    "explanation": "Detailed explanation...",
    "fix": "Code fix..."
  }
]

If no issues, return: []`
}

function parseDeepScanResponse(content: string, filePath: string): Finding[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

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
  } catch {
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
