import { Finding } from '../types'
import { verifySingleFinding } from './client'
import { buildVerifyPrompt } from './prompts'

export async function verifyFindings(
  findings: Finding[],
  fileContents: Map<string, string>,
  apiKey: string
): Promise<Finding[]> {
  if (findings.length === 0) return findings

  const batchSize = 5
  const verified: Finding[] = []

  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize)
    
    const results = await Promise.all(
      batch.map(async (finding) => {
        const fileContent = fileContents.get(finding.file) || ''
        
        const verification = await verifySingleFinding(
          finding,
          fileContent,
          apiKey,
          buildVerifyPrompt
        )

        return {
          finding,
          verification
        }
      })
    )

    for (const { finding, verification } of results) {
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
