import { Finding, Severity } from '../types'
import { callMistral } from './client'
import { buildDeepScanPrompt, buildDeepScanSystemPrompt } from './prompts'

export async function deepScan(
  files: { path: string; content: string }[],
  apiKey: string
): Promise<Finding[]> {
  const allFindings: Finding[] = []

  for (const file of files) {
    try {
      const prompt = buildDeepScanPrompt(file.content, file.path)
      
      const response = await callMistral(apiKey, [
        { role: 'system', content: buildDeepScanSystemPrompt() },
        { role: 'user', content: prompt }
      ])

      const issues = parseDeepScanResponse(response.explanation, file.path)
      allFindings.push(...issues)
    } catch {
      // Skip files that fail
    }
  }

  return allFindings
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

function mapSeverity(severity: string): Severity {
  const map: Record<string, Severity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low'
  }
  return map[severity] || 'medium'
}
