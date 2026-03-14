import { Finding, FileInfo } from '../types'
import { callMistral, verifySingleFinding, StreamingOptions } from './client'
import { buildVerifyPrompt } from './prompts'

export interface VerificationProgress {
  current: number
  total: number
  currentFile?: string
  currentFinding?: string
}

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

  for (let i = 0; i < findings.length; i++) {
    if (abortSignal?.aborted) break
    
    const finding = findings[i]
    const fileContent = fileContents.get(finding.file) || ''
    
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentFile: finding.file,
        currentFinding: finding.title
      })
    }

    if (onThinking) {
      onThinking(`🔍 Analyzing finding ${i + 1}/${total}: ${finding.title}`)
      onThinking(`📄 File: ${finding.file}:${finding.line}`)
      onThinking(`💭 Context: ${finding.message.substring(0, 100)}...`)
    }

    const options: StreamingOptions = {
      onThinking,
      signal: abortSignal
    }

    const verification = await verifySingleFinding(
      finding,
      fileContent,
      apiKey,
      buildVerifyPrompt,
      options
    )

    if (verification.status === 'false-positive') {
      if (onThinking) {
        onThinking(`✅ Ruled out: ${finding.title} - FALSE POSITIVE`)
        onThinking(`📝 Reason: ${verification.explanation.substring(0, 150)}`)
      }
      continue
    }

    if (verification.status === 'confirmed') {
      if (onThinking) {
        onThinking(`🚨 CONFIRMED: ${finding.title}`)
        onThinking(`💡 Fix: ${verification.fix?.substring(0, 100) || 'See details'}`)
      }
    }

    verified.push({
      ...finding,
      aiStatus: verification.status,
      aiExplanation: verification.explanation,
      aiFix: verification.fix || finding.aiFix
    })
  }

  return verified
}
