export interface AIThought {
  type: 'thinking' | 'analyzing' | 'found' | 'reading' | 'checking' | 'concluding' | 'warning'
  message: string
  timestamp: number
  details?: string
}

export interface AIProgress {
  currentFile?: string
  currentFinding?: string
  thoughts: AIThought[]
  filesAnalyzed: number
  totalFiles: number
  findingsFound: number
}

export class RealtimeAIDisplay {
  private progress: AIProgress
  private onUpdate: (progress: AIProgress) => void
  private interrupted = false

  constructor(onUpdate: (progress: AIProgress) => void) {
    this.progress = {
      thoughts: [],
      filesAnalyzed: 0,
      totalFiles: 0,
      findingsFound: 0
    }
    this.onUpdate = onUpdate
  }

  think(type: AIThought['type'], message: string, details?: string): void {
    if (this.interrupted) return
    
    const thought: AIThought = {
      type,
      message,
      details,
      timestamp: Date.now()
    }
    this.progress.thoughts.push(thought)
    this.onUpdate({ ...this.progress })
  }

  setTotalFiles(count: number): void {
    this.progress.totalFiles = count
    this.onUpdate({ ...this.progress })
  }

  setCurrentFile(file: string): void {
    this.progress.currentFile = file
    this.think('reading', `Reading ${file}...`, file)
  }

  setCurrentFinding(finding: string): void {
    this.progress.currentFinding = finding
    this.think('analyzing', `Analyzing: ${finding}`)
  }

  incrementFiles(): void {
    this.progress.filesAnalyzed++
    this.onUpdate({ ...this.progress })
  }

  incrementFindings(): void {
    this.progress.findingsFound++
    this.think('found', `Found potential vulnerability!`)
  }

  interrupt(): void {
    this.interrupted = true
    this.think('warning', 'Scan interrupted by user')
  }

  isInterrupted(): boolean {
    return this.interrupted
  }

  getProgress(): AIProgress {
    return { ...this.progress }
  }

  reset(): void {
    this.progress = {
      thoughts: [],
      filesAnalyzed: 0,
      totalFiles: 0,
      findingsFound: 0
    }
    this.interrupted = false
  }
}

export function renderProgressBar(current: number, total: number, width: number = 20): string {
  const percent = total > 0 ? current / total : 0
  const filled = Math.floor(percent * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}
