import { Finding } from '../types'
import { deepScanWithProgress, StreamingOptions } from './client'

export interface DeepScanProgress {
  currentFile: number
  totalFiles: number
  currentFileName?: string
}

export async function deepScan(
  files: { path: string; content: string }[],
  apiKey: string,
  onProgress?: (progress: DeepScanProgress) => void,
  onThinking?: (thought: string) => void,
  abortSignal?: AbortSignal
): Promise<Finding[]> {
  const allFindings: Finding[] = []
  const totalFiles = files.length

  for (let i = 0; i < files.length; i++) {
    if (abortSignal?.aborted) break
    
    const file = files[i]
    
    if (onProgress) {
      onProgress({
        currentFile: i + 1,
        totalFiles,
        currentFileName: file.path
      })
    }

    if (onThinking) {
      onThinking(`🧠 Deep scanning file ${i + 1}/${totalFiles}`)
      onThinking(`📂 ${file.path}`)
    }

    try {
      const options: StreamingOptions = {
        onThinking,
        signal: abortSignal
      }

      const issues = await deepScanWithProgress(file, apiKey, options)
      
      if (issues.length > 0) {
        if (onThinking) {
          onThinking(`⚠️ Found ${issues.length} issue(s) in ${file.path}`)
        }
        allFindings.push(...issues)
      } else {
        if (onThinking) {
          onThinking(`✓ ${file.path} - No issues found`)
        }
      }
    } catch (error) {
      if (onThinking) {
        onThinking(`❌ Error scanning ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  return allFindings
}
