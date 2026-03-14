import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class ErrorHandlingDetector extends BaseDetector {
  name = 'Error Handling'
  category = 'errorhandling'

  private silentCatchPatterns = [
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/gi, message: 'Empty catch block - errors silently swallowed' },
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}\s*$/gm, message: 'Empty catch block' },
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*console\.log\s*\(\s*\w*\s*\)\s*\}\s*$/gm, message: 'Only logging error, not handling it' },
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*return\s+/gi, message: 'Silent error suppression' },
    { pattern: /try\s*\{[^}]*\}[^}]*catch\s*\(\s*\w*\s*\)\s*\{\s*\}$/gm, message: 'Empty error handling' },
    { pattern: /@SuppressWarnings/gi, message: 'Suppressed warnings may hide issues' }
  ]

  private noErrorPatterns = [
    { pattern: /process\.on\s*\(\s*['"]uncaughtException['"]/gi, message: 'UncaughtException handler may mask bugs', severity: 'low' as any },
    { pattern: /process\.on\s*\(\s*['"]unhandledRejection['"]/gi, message: 'UnhandledRejection handler may mask bugs', severity: 'low' as any },
    { pattern: /error\s*:\s*undefined/gi, message: 'Error variable set to undefined', severity: 'medium' as any },
    { pattern: /throw\s+undefined/gi, message: 'Throwing undefined provides no context', severity: 'medium' as any },
    { pattern: /throw\s+new\s+Error\s*\(\s*['"]['"]\s*\)/gi, message: 'Empty error message', severity: 'low' as any }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message } of this.silentCatchPatterns) {
      findings.push(...this.match(content, pattern, file, 'Silent Error Handling', 'medium', message,
        'Handle errors properly or log with context'))
    }

    for (const { pattern, message, severity } of this.noErrorPatterns) {
      findings.push(...this.match(content, pattern, file, 'Error Handling Issue', severity, message,
        'Provide meaningful error messages and handling'))
    }

    return findings
  }
}
