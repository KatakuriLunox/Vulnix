import { Finding } from '../types'
import { deepScanWithProgress, StreamingOptions } from './client'

export interface DeepScanProgress {
  currentFile: number
  totalFiles: number
}

const BATCH_SIZE = 10

export async function deepScan(
  files: { path: string; content: string }[],
  apiKey: string,
  onProgress?: (thought: string) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  const allFindings: Finding[] = []

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = files.slice(i, i + BATCH_SIZE)

    if (onProgress) {
      const batchNames = batch.map(f => f.path.split('/').pop()).join(', ')
      onProgress(`🧠 Deep scanning batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchNames}`)
    }

    const promises = batch.map(async (file) => {
      const options: StreamingOptions = { signal: abortSignal }
      return deepScanWithProgress(file, apiKey, options)
    })

    const results = await Promise.all(promises)
    
    for (let j = 0; j < results.length; j++) {
      const issues = results[j]
      if (issues.length > 0) {
        if (onProgress) {
          onProgress(`🚨 Found ${issues.length} issues in ${batch[j].path}`)
        }
        allFindings.push(...issues)
      }
    }
  }

  return allFindings
}
