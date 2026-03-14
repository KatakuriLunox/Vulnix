import { BaseDetector } from './base'
import { FileInfo, Finding, Severity } from '../types'

export class AIDetector extends BaseDetector {
  name = 'AI Data Leakage'
  category = 'ai'

  private patterns: { pattern: RegExp; message: string; severity: Severity }[] = [
    { pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi, message: 'Potential AI API key exposed', severity: 'high' },
    { pattern: /sk-[a-zA-Z0-9]{20,}/gi, message: 'Potential AI service secret key exposed', severity: 'high' },
    { pattern: /system\s*:\s*['"]?\s*(?:you are|you act as|prompt)/gi, message: 'Possible prompt injection pattern', severity: 'medium' },
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    // Skip certain file types that cause false positives
    const skipExtensions = ['.json', '.lock', '.md', '.txt', '.yaml', '.yml']
    if (skipExtensions.includes(file.extension)) {
      return findings
    }

    for (const { pattern, message, severity } of this.patterns) {
      findings.push(...this.match(content, pattern, file, 'AI/ML Security', severity, message,
        'Review AI integration for data leakage risks'))
    }

    return findings
  }
}
