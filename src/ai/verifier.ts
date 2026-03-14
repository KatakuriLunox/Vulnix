import { Finding, FileInfo } from '../types'
import { callMistral, verifySingleFinding, StreamingOptions } from './client'
import { buildVerifyPrompt } from './prompts'

export interface VerificationProgress {
  current: number
  total: number
}

const VERIFY_BATCH_SIZE = 5

const BATCH_DELAY_MS = 1500

export async function verifyFindings(
  findings: Finding[],
  fileContents: Map<string, string>,
  apiKey: string,
  onProgress?: (thought: string) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  if (findings.length === 0) return findings

  const verified: Finding[] = []

  for (let i = 0; i < findings.length; i += VERIFY_BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = findings.slice(i, i + VERIFY_BATCH_SIZE)

    if (onProgress) {
      onProgress(`🤖 Analyzing ${batch.length} findings in parallel...`)
    }

    const promises = batch.map(async (finding) => {
      const fileContent = fileContents.get(finding.file) || ''
      
      let streamPreview = ''
      const options: StreamingOptions = {
        signal: abortSignal,
        onThinking: (thought) => onProgress?.(thought),
        onChunk: (chunk) => {
          streamPreview += chunk
          if (streamPreview.length > 50) {
            onProgress?.(`🤖 AI reasoning: ${streamPreview.slice(0, 50)}...`)
            streamPreview = ''
          }
        },
        onDone: () => {
          if (streamPreview) {
            onProgress?.(`🤖 AI reasoning: ${streamPreview.slice(0, 50)}...`)
          }
        }
      }

      return verifySingleFinding(finding, fileContent, apiKey, buildVerifyPrompt, options)
    })

    const results = await Promise.all(promises)

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS))

    for (let j = 0; j < results.length; j++) {
      const verification = results[j]
      const finding = batch[j]

      if (verification.status === 'false-positive') {
        if (onProgress) {
          onProgress(`✅ Dismissed: ${finding.title} (false positive)`)
        }
        continue
      }

      if (onProgress) {
        onProgress(`🚨 Confirmed: ${finding.title}`)
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
