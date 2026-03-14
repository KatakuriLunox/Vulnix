import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class AuthDetector extends BaseDetector {
  name = 'Authentication Bypass'
  category = 'auth'

  private authFunctionNames = [
    'authenticate', 'authorization', 'checkAuth', 'isAuth', 'isAuthenticated',
    'requireAuth', 'ensureAuth', 'validateSession', 'verifyToken', 'checkPermission',
    'hasPermission', 'canAccess', 'isAdmin', 'isUser', 'login', 'checkRole'
  ]

  private weakPatterns = [
    { pattern: /return\s+true\s*;/gi, message: 'Unconditional return true may bypass auth' },
    { pattern: /if\s*\(\s*true\s*\)/gi, message: 'Always-true condition in auth check' },
    { pattern: /\/\/\s*TODO.*auth/gi, message: 'Unimplemented auth logic' },
    { pattern: /\/\/\s*FIXME.*auth/gi, message: 'Incomplete auth implementation' },
    { pattern: /passport\.\w+\s*\(\s*\)/gi, message: 'Empty passport configuration may be insecure' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const stripped = this.stripComments(line, file.extension)
      
      const hasAuthFunction = this.authFunctionNames.some(name => 
        new RegExp(`\\b${name}\\b`, 'i').test(stripped)
      )

      if (hasAuthFunction) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n')
        
        for (const { pattern, message } of this.weakPatterns) {
          if (pattern.test(stripped) || pattern.test(context)) {
            findings.push({
              id: `${file.relativePath}:${i + 1}:${this.name}`,
              title: 'Authentication Bypass',
              severity: 'high',
              file: file.relativePath,
              line: i + 1,
              code: line.trim(),
              message,
              fix: 'Implement proper authentication logic',
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
