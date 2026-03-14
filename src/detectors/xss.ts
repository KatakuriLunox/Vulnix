import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class XSSDetector extends BaseDetector {
  name = 'XSS Vulnerability'
  category = 'xss'

  private dangerousPatterns = [
    { pattern: /dangerouslySetInnerHTML\s*=/gi, fix: 'Use DOMPurify.sanitize() before passing to __html' },
    { pattern: /\.innerHTML\s*=/gi, fix: 'Use textContent or sanitize user input with DOMPurify' },
    { pattern: /document\.write\s*\(/gi, fix: 'Use safe DOM manipulation methods instead' },
    { pattern: /eval\s*\(\s*.*(?:req|request|params|body|query|user|input)/gi, fix: 'Avoid eval with user input' },
    { pattern: /\<\%\s*=\s*.*\%\>/gi, fix: 'Use auto-escaping or sanitize input' },
    { pattern: /\{\{\s*.*\}\}/gi, fix: 'Ensure template variables are sanitized' },
    { pattern: /v-html\s*=/gi, fix: 'Use v-text or sanitize content with DOMPurify' },
    { pattern: /\[innerHTML\]\s*=/gi, fix: 'Use safe DOM methods or sanitize input' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, fix } of this.dangerousPatterns) {
      findings.push(...this.match(content, pattern, file, 'Cross-Site Scripting (XSS)', 'high', 
        'Potential XSS vulnerability - user input rendered without sanitization', fix))
    }

    return findings
  }
}
