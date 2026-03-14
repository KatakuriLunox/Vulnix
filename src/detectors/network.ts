import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class NetworkDetector extends BaseDetector {
  name = 'Network Issues'
  category = 'network'

  private patterns = [
    { pattern: /setTimeout\s*\(\s*function\s*\(\s*\)\s*\{.*while\s*\(/gi, message: 'Potential infinite loop without timeout' },
    { pattern: /request\s*\(\s*\{[^}]*timeout\s*:\s*(?:undefined|null|0)[^}]*\}/gi, message: 'HTTP request without timeout' },
    { pattern: /fetch\s*\(\s*[^,)]*\{[^}]*\}\s*\)/gi, message: 'Check if fetch has timeout configured' },
    { pattern: /axios\.[get|post|put|delete]\s*\([^)]*\)\s*\.then/gi, message: 'Add timeout to axios request' },
    { pattern: /http\.(get|post|request)\s*\([^)]*\)\s*\.on\s*\(\s*['"]error['"]/gi, message: 'Ensure timeout is set for HTTP requests' },
    { pattern: /redirect\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Open redirect vulnerability' },
    { pattern: /window\.location\s*=\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Client-side open redirect' },
    { pattern: /res\.redirect\s*\(\s*req\.(?:query|body|params)/gi, message: 'Open redirect vulnerability' },
    { pattern: /href\s*=\s*['"]?\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Dynamic href without validation' },
    { pattern: /src\s*=\s*['"]?\s*https?:\/\/(?!this\.domain)/gi, message: 'External URL without validation' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message } of this.patterns) {
      findings.push(...this.match(content, pattern, file, 'Network Security Issue', 'medium', message,
        'Configure timeouts and validate redirects'))
    }

    return findings
  }
}
