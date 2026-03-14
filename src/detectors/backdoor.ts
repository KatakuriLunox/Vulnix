import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class BackdoorDetector extends BaseDetector {
  name = 'Suspicious Patterns'
  category = 'backdoor'

  private suspiciousPatterns = [
    { pattern: /\^[\s]*['"][a-zA-Z0-9+=]{4,}['"]/gi, message: 'XOR encoding pattern - potential obfuscation' },
    { pattern: /eval\s*\(\s*String\.fromCharCode/gi, message: 'Obfuscated code execution via char codes' },
    { pattern: /atob\s*\(\s*['"][a-zA-Z0-9+/=]{20,}['"]\s*\)/gi, message: 'Base64 encoded string - potential payload' },
    { pattern: /setTimeout\s*\(\s*['"]/gi, message: 'Delayed code execution from string', severity: 'medium' as any },
    { pattern: /setInterval\s*\(\s*['"]/gi, message: 'Interval code execution from string', severity: 'medium' as any },
    { pattern: /new\s+Function\s*\(/gi, message: 'Dynamic function creation - potential code injection' },
    { pattern: /process\.env\[/gi, message: 'Accessing environment variables - check for credential exposure' },
    { pattern: /child_process\.exec\s*\(\s*\$/gi, message: 'Shell command injection risk', severity: 'critical' as any },
    { pattern: /exec\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Command injection via user input', severity: 'critical' as any },
    { pattern: /exec\s*\(\s*req\.(?:params|query|body)/gi, message: 'Command injection vulnerability', severity: 'critical' as any },
    { pattern: /spawn\s*\(\s*['"]\/bin\/sh['"]/gi, message: 'Shell spawn may be used for attacks' },
    { pattern: /__import__\s*\(\s*['"]os['"]/gi, message: 'Dynamic os import - potential attack' },
    { pattern: /__import__\s*\(\s*['"]subprocess['"]/gi, message: 'Dynamic subprocess import' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    const cleanContent = this.removeCommentsAndStrings(content, file.extension)

    for (const { pattern, message, severity = 'high' } of this.suspiciousPatterns) {
      findings.push(...this.match(cleanContent, pattern, file, 'Suspicious Pattern', severity, message,
        'Investigate this pattern for potential backdoors'))
    }

    return findings
  }

  private removeCommentsAndStrings(content: string, extension: string): string {
    let result = content

    if (['.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.cs', '.go', '.rs'].includes(extension)) {
      result = result.replace(/\/\/.*$/gm, '')
      result = result.replace(/\/\*[\s\S]*?\*\//g, '')
    }

    if (['.py', '.rb', '.sh'].includes(extension)) {
      result = result.replace(/#.*$/gm, '')
    }

    result = result.replace(/'[^']*'/g, "''")
    result = result.replace(/"[^"]*"/g, '""')
    result = result.replace(/`[^`]*`/g, '``')

    return result
  }
}
