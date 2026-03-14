import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class InjectionDetector extends BaseDetector {
  name = 'SQL Injection'
  category = 'injection'

  private sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE', 'UNION']
  private vulnerablePatterns = [
    /execute\s*\(\s*['"`].*\$/gi,
    /query\s*\(\s*['"`].*\$/gi,
    /\.execute\s*\(\s*['"`].*\+/gi,
    /\.query\s*\(\s*['"`].*\+/gi,
    /['"`].*\%s.*['"`].*%/gi,
    /['"`].*\$.*/gi
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const stripped = this.stripComments(line, file.extension)
      
      const hasSQLKeyword = this.sqlKeywords.some(kw => 
        new RegExp(`\\b${kw}\\b`, 'i').test(stripped)
      )
      
      const hasConcatenation = /(\+|f['"`]|format\()\s*['"`].*\$/.test(stripped)
      
      if (hasSQLKeyword && (hasConcatenation || /\$\{/.test(stripped) || /\$\w+/.test(stripped))) {
        for (const pattern of this.vulnerablePatterns) {
          if (pattern.test(stripped)) {
            findings.push({
              id: `${file.relativePath}:${i + 1}:${this.name}`,
              title: 'SQL Injection',
              severity: 'critical',
              file: file.relativePath,
              line: i + 1,
              code: line.trim(),
              message: 'Potential SQL injection - string concatenation used with SQL query',
              fix: 'Use parameterized queries or prepared statements',
              category: this.category,
              aiStatus: 'unverified'
            })
            break
          }
        }
      }
    }

    return findings
  }
}
