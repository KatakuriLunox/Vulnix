import { Finding } from '../types'
import { deepScanWithProgress, StreamingOptions } from './client'

export interface DeepScanProgress {
  currentFile: number
  totalFiles: number
  currentFileName?: string
}

const BATCH_SIZE = 5

export async function deepScan(
  files: { path: string; content: string }[],
  apiKey: string,
  onProgress?: (progress: DeepScanProgress) => void,
  onThinking?: (thought: string) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  const allFindings: Finding[] = []
  const totalFiles = files.length
  let completed = 0

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (abortSignal?.aborted) break
    
    const batch = files.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(totalFiles / BATCH_SIZE)

    if (onThinking) {
      onThinking(`🔬 Batch ${batchNum}/${totalBatches}: Scanning ${batch.length} files in parallel...`)
    }

    if (onProgress) {
      onProgress({
        currentFile: completed,
        totalFiles,
        currentFileName: `Batch ${batchNum}/${totalBatches}`
      })
    }

    const promises = batch.map(async (file) => {
      try {
        const options: StreamingOptions = {
          onThinking: (thought) => {
            if (onThinking && !abortSignal?.aborted) {
              onThinking(`  📄 ${file.path}: ${thought}`)
            }
          },
          signal: abortSignal
        }

        const issues = await deepScanWithProgress(file, apiKey, options)
        return issues
      } catch (error) {
        if (onThinking) {
          onThinking(`  ❌ ${file.path}: Error - ${error instanceof Error ? error.message : 'Unknown'}`)
        }
        return []
      }
    })

    const results = await Promise.all(promises)
    
    for (const issues of results) {
      if (issues.length > 0) {
        allFindings.push(...issues)
        if (onThinking) {
          onThinking(`  🚨 Found ${issues.length} issue(s)`)
        }
      }
    }

    completed += batch.length
    if (onProgress) {
      onProgress({
        currentFile: Math.min(completed, totalFiles),
        totalFiles,
        currentFileName: `Batch ${batchNum}/${totalBatches} complete`
      })
    }
  }

  return allFindings
}
