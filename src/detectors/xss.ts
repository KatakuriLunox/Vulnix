import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class XSSDetector extends BaseDetector {
  name = 'XSS Vulnerability'
  category = 'xss'

  private dangerousPatterns = [
    { pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{/gi, fix: 'Use DOMPurify.sanitize() before passing to __html' },
    { pattern: /\.innerHTML\s*=\s*(?!.*(?:animate|transition|style))/gi, fix: 'Use textContent or sanitize user input with DOMPurify' },
    { pattern: /document\.write\s*\(/gi, fix: 'Use safe DOM manipulation methods instead' },
    { pattern: /eval\s*\(\s*(?:req|request|params|body|query|user|input)/gi, fix: 'Avoid eval with user input' },
    { pattern: /\<\%\s*=\s*(?!.*\b(?:for|if|loop)\b)/gi, fix: 'Use auto-escaping or sanitize input' },
    { pattern: /v-html\s*=\s*\{/gi, fix: 'Use v-text or sanitize content with DOMPurify' },
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
