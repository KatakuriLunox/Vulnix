import { Finding, FileInfo } from '../types'
import { callMistral, verifySingleFinding, StreamingOptions } from './client'
import { buildVerifyPrompt } from './prompts'

export interface VerificationProgress {
  current: number
  total: number
  currentFile?: string
  currentFinding?: string
}

const VERIFY_BATCH_SIZE = 3

export async function verifyFindings(
  findings: Finding[],
  fileContents: Map<string, string>,
  apiKey: string,
  onProgress?: (progress: VerificationProgress) => void,
  onThinking?: (thought: string) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  if (findings.length === 0) return findings

  const verified: Finding[] = []
  const total = findings.length

  for (let i = 0; i < findings.length; i += VERIFY_BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = findings.slice(i, i + VERIFY_BATCH_SIZE)
    const batchNum = Math.floor(i / VERIFY_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(total / VERIFY_BATCH_SIZE)

    if (onThinking) {
      onThinking(`🔬 Verifying batch ${batchNum}/${totalBatches}: ${batch.length} findings in parallel...`)
    }

    if (onProgress) {
      onProgress({
        current: i,
        total,
        currentFinding: `Batch ${batchNum}/${totalBatches}`
      })
    }

    const promises = batch.map(async (finding) => {
      const fileContent = fileContents.get(finding.file) || ''
      
      const options: StreamingOptions = {
        onThinking: (thought) => {
          if (onThinking && !abortSignal?.aborted) {
            onThinking(`  📄 ${finding.file}:${finding.line} - ${thought}`)
          }
        },
        signal: abortSignal
      }

      const verification = await verifySingleFinding(
        finding,
        fileContent,
        apiKey,
        buildVerifyPrompt,
        options
      )

      return { finding, verification }
    })

    const results = await Promise.all(promises)

    for (const { finding, verification } of results) {
      if (verification.status === 'false-positive') {
        if (onThinking) {
          onThinking(`  ✅ Ruled out: ${finding.title} (false positive)`)
        }
        continue
      }

      if (verification.status === 'confirmed') {
        if (onThinking) {
          onThinking(`  🚨 CONFIRMED: ${finding.title}`)
        }
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
