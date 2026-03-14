import { Finding, FileInfo } from '../types'
import { callMistral, verifySingleFinding, StreamingOptions } from './client'
import { buildVerifyPrompt } from './prompts'

export interface VerificationProgress {
  current: number
  total: number
}

const VERIFY_BATCH_SIZE = 3

export async function verifyFindings(
  findings: Finding[],
  fileContents: Map<string, string>,
  apiKey: string,
  onProgress?: (progress: VerificationProgress) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  if (findings.length === 0) return findings

  const verified: Finding[] = []

  for (let i = 0; i < findings.length; i += VERIFY_BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = findings.slice(i, i + VERIFY_BATCH_SIZE)

    if (onProgress) {
      onProgress({ current: i + batch.length, total: findings.length })
    }

    const promises = batch.map(async (finding) => {
      const fileContent = fileContents.get(finding.file) || ''
      
      const options: StreamingOptions = {
        signal: abortSignal
      }

      return verifySingleFinding(finding, fileContent, apiKey, buildVerifyPrompt, options)
    })

    const results = await Promise.all(promises)

    for (let j = 0; j < results.length; j++) {
      const verification = results[j]
      const finding = batch[j]

      if (verification.status === 'false-positive') {
        continue
      }

      verified.push({
        ...finding,
        aiStatus: verification.status,
        aiExplanation: verification.explanation,
        aiFix: verification.fix || finding.aiFix
      })
    }
  }

  return verified
}
