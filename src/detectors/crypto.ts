import { BaseDetector } from './base'
import { FileInfo, Finding } from '../types'

export class CryptoDetector extends BaseDetector {
  name = 'Weak Cryptography'
  category = 'crypto'

  private weakAlgorithms = [
    'md5', 'sha1', 'des', 'rc4', 'aes-128-cbc', 'aes-192-cbc'
  ]

  private dangerousPatterns = [
    { pattern: /Crypto\.createHash\s*\(\s*['"]md5['"]/gi, message: 'MD5 is cryptographically weak' },
    { pattern: /Crypto\.createHash\s*\(\s*['"]sha1['"]/gi, message: 'SHA-1 is cryptographically weak' },
    { pattern: /createCipher\s*\(/gi, message: 'Weak encryption (deprecated)' },
    { pattern: /createDecipher\s*\(/gi, message: 'Weak decryption (deprecated)' },
    { pattern: /hmac\.update\s*\(\s*['"]/gi, message: 'HMAC without algorithm may be weak' },
    { pattern: /password\s*=\s*['"].{0,8}['"]/gi, message: 'Short password detected' },
    { pattern: /bcrypt\.hash\s*\([^,]+,\s*[0-9]{1,2}\s*\)/gi, message: 'Low bcrypt rounds may be insecure' }
  ]

  scan(file: FileInfo, content: string): Finding[] {
    const findings: Finding[] = []

    for (const { pattern, message } of this.dangerousPatterns) {
      findings.push(...this.match(content, pattern, file, 'Weak Cryptography', 'high', message, 
        'Use strong algorithms like SHA-256+ or Argon2 for passwords'))
    }

    const lines = content.split('\n')
    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase()
      for (const algo of this.weakAlgorithms) {
        if (lowerLine.includes(`'${algo}'`) || lowerLine.includes(`"${algo}"`)) {
          findings.push({
            id: `${file.relativePath}:${index + 1}:${this.name}`,
            title: 'Weak Cryptographic Algorithm',
            severity: 'high',
            file: file.relativePath,
            line: index + 1,
            code: line.trim(),
            message: `Weak cryptographic algorithm: ${algo}`,
            fix: `Use ${algo.toUpperCase().replace('AES-128-CBC', 'AES-256-GCM').replace('AES-192-CBC', 'AES-256-GCM')} or better`,
            category: this.category,
            aiStatus: 'unverified'
          })
        }
      }
    })

    return findings
  }
}
