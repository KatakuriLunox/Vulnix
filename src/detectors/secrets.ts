import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class SecretsDetector extends BaseDetector {
  name = 'Hardcoded Secrets'
  category = 'secrets'

  private patterns = [
    { pattern: /['"](?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)['"]\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi, message: 'Potential API key exposed' },
    { pattern: /['"](?:secret|token|password|passwd|pwd|credential)['"]\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi, message: 'Potential hardcoded secret' },
    { pattern: /(?<![a-zA-Z0-9])(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}/g, message: 'Stripe-like secret key exposed' },
    { pattern: /['"]gh[pousr]_[a-zA-Z0-9]{36,}/g, message: 'GitHub token exposed' },
    { pattern: /xox[baprs]-[a-zA-Z0-9]{10,}/g, message: 'Slack token exposed' },
    { pattern: /AKIA[0-9A-Z]{16}/g, message: 'AWS access key exposed' },
    { pattern: /['"](?:private[_-]?key|ssh[_-]?key)['"]\s*[:=]\s*['"]-----BEGIN/g, message: 'SSH private key exposed' },
    { pattern: /['"](?:access[_-]?token|auth[_-]?token|bearer[_-]?token)['"]\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{20,}['"]/gi, message: 'Bearer token exposed' },
    { pattern: /firebase[_-]?io|firebase\.google\.com.*['"][a-zA-Z0-9_\-]{20,}['"]/gi, message: 'Firebase config exposed' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message } of this.patterns) {
      findings.push(...this.match(content, pattern, file, 'Hardcoded Secret', 'critical', message, 'Use environment variables or a secrets manager'))
    }

    return findings
  }
}
