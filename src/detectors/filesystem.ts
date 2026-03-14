import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class FilesystemDetector extends BaseDetector {
  name = 'Path Traversal'
  category = 'filesystem'

  private dangerousPatterns = [
    { pattern: /readFile\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'File read with user input - potential path traversal' },
    { pattern: /readFile\s*\(\s*req\.(?:params|query|body)/gi, message: 'File read with unsanitized user input' },
    { pattern: /readFileSync\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Path traversal vulnerability' },
    { pattern: /readFileSync\s*\(\s*req\.(?:params|query|body)/gi, message: 'Path traversal vulnerability' },
    { pattern: /open\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'File operation with user input' },
    { pattern: /writeFile\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'File write with user input - may allow arbitrary write' },
    { pattern: /writeFile\s*\(\s*req\.(?:params|query|body)/gi, message: 'Unrestricted file write vulnerability' },
    { pattern: /unlink\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'File delete with user input' },
    { pattern: /unlink\s*\(\s*req\.(?:params|query|body)/gi, message: 'Arbitrary file deletion vulnerability' },
    { pattern: /rmdir\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Directory delete with user input' },
    { pattern: /mkdir\s*\(\s*\$_(?:GET|POST|REQUEST)/gi, message: 'Directory create with user input' },
    { pattern: /\.\.\/.*\$_(?:GET|POST|REQUEST)/gi, message: 'Path traversal with user input' },
    { pattern: /path\.join\s*\([^)]*\$_(?:GET|POST|REQUEST)/gi, message: 'Path join without validation' },
    { pattern: /path\.join\s*\([^)]*req\.(?:params|query|body)/gi, message: 'Path traversal risk' },
    { pattern: /fs\.readFile\s*\(\s*\+.*(?:req|params)/gi, message: 'File read with string concatenation' },
    { pattern: /fs\.writeFile\s*\(\s*\+.*(?:req|params)/gi, message: 'File write with string concatenation' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message } of this.dangerousPatterns) {
      findings.push(...this.match(content, pattern, file, 'Path Traversal', 'high', message,
        'Validate and sanitize user input, use allowlists'))
    }

    return findings
  }
}
