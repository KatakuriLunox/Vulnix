import { Finding, FileInfo, Severity, Detector } from '../types'

export { Detector }
export abstract class BaseDetector implements Detector {
  abstract name: string
  abstract category: string

  protected match(
    content: string,
    pattern: RegExp,
    file: FileInfo,
    title: string,
    severity: Severity,
    message: string,
    fix?: string
  ): Finding[] {
    const findings: Finding[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const stripped = this.stripComments(line, file.extension)
      if (!stripped.trim()) return

      if (pattern.test(stripped)) {
        findings.push({
          id: `${file.relativePath}:${index + 1}:${this.name}`,
          title,
          severity,
          file: file.relativePath,
          line: index + 1,
          code: line.trim(),
          message,
          fix,
          category: this.category,
          aiStatus: 'unverified'
        })
      }
    })

    return findings
  }

  protected matchWithContext(
    content: string,
    pattern: RegExp,
    file: FileInfo,
    title: string,
    severity: Severity,
    message: string,
    contextKeywords: string[],
    fix?: string
  ): Finding[] {
    const findings: Finding[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const stripped = this.stripComments(line, file.extension)
      
      if (!pattern.test(stripped)) continue

      const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6)).join('\n')
      const hasContext = contextKeywords.some(keyword => context.toLowerCase().includes(keyword.toLowerCase()))

      if (hasContext) {
        findings.push({
          id: `${file.relativePath}:${i + 1}:${this.name}`,
          title,
          severity,
          file: file.relativePath,
          line: i + 1,
          code: line.trim(),
          message,
          fix,
          category: this.category,
          aiStatus: 'unverified'
        })
      }
    }

    return findings
  }

  protected stripComments(line: string, extension: string): string {
    if (['.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.swift', '.kt', '.scala'].includes(extension)) {
      return line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '')
    }
    if (['.py', '.rb', '.sh', '.bash', '.zsh', '.yaml', '.yml'].includes(extension)) {
      return line.replace(/#.*$/, '')
    }
    if (['.php'].includes(extension)) {
      return line.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '')
    }
    return line
  }

  abstract scan(file: FileInfo, content: string): Finding[]
}
