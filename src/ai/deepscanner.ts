import { Finding } from '../types'
import { deepScanWithProgress, StreamingOptions } from './client'

export interface DeepScanProgress {
  currentFile: number
  totalFiles: number
}

const BATCH_SIZE = 5

export async function deepScan(
  files: { path: string; content: string }[],
  apiKey: string,
  onProgress?: (progress: DeepScanProgress) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  const allFindings: Finding[] = []

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = files.slice(i, i + BATCH_SIZE)

    if (onProgress) {
      onProgress({ currentFile: Math.min(i + BATCH_SIZE, files.length), totalFiles: files.length })
    }

    const promises = batch.map(async (file) => {
      const options: StreamingOptions = { signal: abortSignal }
      return deepScanWithProgress(file, apiKey, options)
    })

    const results = await Promise.all(promises)
    
    for (const issues of results) {
      allFindings.push(...issues)
    }
  }

  return allFindings
}
