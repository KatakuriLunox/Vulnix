import { Finding } from '../types'

export class Deduplicator {
  deduplicate(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>()

    for (const finding of findings) {
      const key = this.generateKey(finding)
      
      if (!seen.has(key)) {
        seen.set(key, finding)
      }
    }

    return Array.from(seen.values())
  }

  private generateKey(finding: Finding): string {
    return `${finding.file}:${finding.line}:${finding.category}`
  }
}
