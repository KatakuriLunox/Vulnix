import { Finding } from '../types'
import { deepScanWithProgress, StreamingOptions } from './client'

export interface DeepScanProgress {
  currentFile: number
  totalFiles: number
}

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 1500

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
      let streamPreview = ''
      const options: StreamingOptions = { 
        signal: abortSignal,
        onThinking: (thought) => onProgress?.(thought),
        onChunk: (chunk) => {
          streamPreview += chunk
          if (streamPreview.length > 50) {
            onProgress?.(`🧠 ${file.path}: ${streamPreview.slice(0, 50)}...`)
            streamPreview = ''
          }
        },
        onDone: () => {
          if (streamPreview) {
            onProgress?.(`🧠 ${file.path}: ${streamPreview.slice(0, 50)}...`)
          }
        }
      }
      return deepScanWithProgress(file, apiKey, options)
    })

    const results = await Promise.all(promises)
    
    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    
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
