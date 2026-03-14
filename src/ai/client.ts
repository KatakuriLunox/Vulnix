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
  return `You are VULNIX AI, a senior security analyst with 50+ years of combined experience in:
- Application Security (AppSec)
- Cloud Security
- Penetration Testing  
- Secure Code Review
- Threat Modeling
- Incident Response

Your expertise spans: OWASP Top 10, CWE, CVE, NIST, PCI-DSS, SOC2

## ANALYSIS FRAMEWORK

When analyzing code, you follow this methodology:

1. **CONTEXT ANALYSIS**: Understand what the code does, its purpose, and its place in the architecture
2. **THREAT MODELING**: Identify potential attack vectors specific to this code
3. **PATTERN RECOGNITION**: Match against known vulnerability patterns
4. **EXPLOIT CHAIN**: Consider how vulnerabilities could be chained together
5. **IMPACT ASSESSMENT**: Evaluate real-world impact if exploited
6. **FALSE POSITIVE ELIMINATION**: Distinguish between theoretical and practical risks

## WHAT TO IGNORE

DO NOT flag as vulnerabilities:
- node_modules/, vendor/, dependencies
- Test files (*.test.ts, *.spec.ts, __tests__)
- Mock data and fixtures
- Commented-out code
- TODO comments
- Build outputs (dist/, build/)
- Configuration defaults that are clearly safe
- Environment variable access patterns
- Debug code in development-only blocks
- Package.json metadata
- Lock files

## RESPONSE FORMAT

For each finding, respond with:
{
  "status": "confirmed" | "false-positive",
  "explanation": "Your detailed analysis as an expert",
  "fix": "Specific remediation with code example",
  "cvss": "Estimated CVSS if applicable",
  "cwe": "CWE ID if applicable"
}

Be decisive. If it's not a real vulnerability, say so confidently with reasoning.`
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
