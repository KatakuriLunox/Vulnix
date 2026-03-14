import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class AIDetector extends BaseDetector {
  name = 'AI Data Leakage'
  category = 'ai'

  private patterns = [
    { pattern: /system\s*:\s*['"]?\s*(?:you are|you act as|prompt)/gi, message: 'Possible prompt injection pattern' },
    { pattern: /ignore\s+(?:previous|all|above)\s+(?:instructions|prompts|commands)/gi, message: 'Prompt injection attempt detected' },
    { pattern: /devstral|mistral|gpt|claude|gemini|openai/gi, message: 'Check for hardcoded API keys for AI services' },
    { pattern: /temperature\s*=\s*0(?:\.0+)?/gi, message: 'Temperature set to 0 - may want to allow some creativity', severity: 'info' as any },
    { pattern: /max_tokens\s*=\s*[1-9]\d{2,}/gi, message: 'Very high max_tokens may expose internal data', severity: 'low' as any },
    { pattern: /stop\s*=\s*\[.*['"](?:end|stop|terminate)['"]/gi, message: 'Check stop sequences for information leakage' },
    { pattern: /baseURL\s*=\s*['"]https?:\/\/api\./gi, message: 'Ensure API endpoint is not hardcoded with credentials' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message, severity = 'low' } of this.patterns) {
      findings.push(...this.match(content, pattern, file, 'AI/ML Security', severity, message,
        'Review AI integration for data leakage risks'))
    }

    return findings
  }
}
