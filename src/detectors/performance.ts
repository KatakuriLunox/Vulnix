import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class PerformanceDetector extends BaseDetector {
  name = 'Performance Issues'
  category = 'performance'

  private patterns = [
    { pattern: /while\s*\(\s*true\s*\)/gi, message: 'Infinite loop detected', severity: 'high' },
    { pattern: /while\s*\(\s*1\s*\)/gi, message: 'Infinite loop (while 1)', severity: 'high' },
    { pattern: /for\s*\(\s*;\s*;\s*\)/gi, message: 'Infinite for loop', severity: 'high' },
    { pattern: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*Infinity/gi, message: 'Infinite loop pattern', severity: 'high' },
    { pattern: /setInterval\s*\(\s*[^,]+,\s*0\s*\)/gi, message: 'setInterval with 0ms may cause CPU spinning', severity: 'medium' },
    { pattern: /setTimeout\s*\(\s*[^,]+,\s*0\s*\)\s*;?\s*setTimeout/gi, message: 'Potential recursive timeout pattern', severity: 'medium' },
    { pattern: /new\s+Array\s*\(\s*\d{7,}\s*\)/gi, message: 'Very large array allocation', severity: 'medium' },
    { pattern: /JSON\.stringify\s*\(\s*.*,\s*null,\s*\d{4,}\s*\)/gi, message: 'Deep JSON serialization may cause stack overflow', severity: 'medium' },
    { pattern: /\.join\s*\(\s*['"][\w]{100,}['"]\s*\)/gi, message: 'Large string join may cause memory issues', severity: 'low' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message, severity } of this.patterns) {
      findings.push(...this.match(content, pattern, file, 'Performance Issue', severity as any, message,
        'Review loop conditions and consider adding bounds'))
    }

    return findings
  }
}
