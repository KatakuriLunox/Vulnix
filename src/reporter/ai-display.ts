import { neonText } from './spinner'

export interface AIProgressState {
  phase: 'init' | 'verifying' | 'deepscan' | 'complete'
  current: number
  total: number
  currentFile?: string
  currentFinding?: string
  thought: string
  findingsFound: number
  confirmed: number
  dismissed: number
  startTime: number
  aborted: boolean
}

export class AIProgressDisplay {
  private state: AIProgressState
  private renderInterval: NodeJS.Timeout | null = null
  private lastOutput = ''
  private initialized = false

  constructor() {
    this.state = this.getInitialState()
  }

  private getInitialState(): AIProgressState {
    return {
      phase: 'init',
      current: 0,
      total: 0,
      thought: '',
      findingsFound: 0,
      confirmed: 0,
      dismissed: 0,
      startTime: Date.now(),
      aborted: false
    }
  }

  start(phase: 'verifying' | 'deepscan', total: number): void {
    this.state = {
      ...this.getInitialState(),
      phase,
      total,
      startTime: Date.now()
    }
    this.initialized = false
    this.render(true)
    this.renderInterval = setInterval(() => this.render(false), 800)
  }

  update(updates: Partial<AIProgressState>): void {
    this.state = { ...this.state, ...updates }
    this.render(false)
  }

  setThought(thought: string): void {
    this.state.thought = thought
    this.render(false)
  }

  addThought(thought: string): void {
    if (thought.includes('Batch')) {
      this.state.thought = thought
    }
    this.render(false)
  }

  incrementFound(): void {
    this.state.findingsFound++
    this.render(false)
  }

  incrementConfirmed(): void {
    this.state.confirmed++
    this.render(false)
  }

  incrementDismissed(): void {
    this.state.dismissed++
    this.render(false)
  }

  abort(): void {
    this.state.aborted = true
    this.stop()
  }

  stop(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval)
      this.renderInterval = null
    }
    this.state.phase = 'complete'
    this.render(true)
  }

  private render(force: boolean): void {
    const s = this.state
    const elapsed = ((Date.now() - s.startTime) / 1000).toFixed(1)
    
    let output = ''
    
    if (s.phase === 'verifying') {
      output = this.renderVerification(s, elapsed)
    } else if (s.phase === 'deepscan') {
      output = this.renderDeepScan(s, elapsed)
    } else if (s.phase === 'complete') {
      output = this.renderComplete(s, elapsed)
    }

    if (output !== this.lastOutput || force || !this.initialized) {
      if (!this.initialized) {
        console.log('')
        this.initialized = true
      }
      process.stdout.write('\r' + output + '\n')
      this.lastOutput = output
    }
  }

  private renderVerification(s: AIProgressState, elapsed: string): string {
    const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
    const bar = this.renderBar(percent)

    return `${neonText('  🤖 AI VERIFYING', 'magenta')} ${bar} ${percent}% | ${s.current}/${s.total} | ${elapsed}s`
  }

  private renderDeepScan(s: AIProgressState, elapsed: string): string {
    const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
    const bar = this.renderBar(percent)

    return `${neonText('  🧠 DEEP SCAN', 'magenta')} ${bar} ${percent}% | ${s.current}/${s.total} files | ${elapsed}s`
  }

  private renderComplete(s: AIProgressState, elapsed: string): string {
    const status = s.aborted 
      ? neonText('  ⚠️ ABORTED', 'yellow')
      : neonText('  ✓ DONE', 'green')

    return `${status} | ${s.confirmed} confirmed | ${s.dismissed} dismissed | ${elapsed}s`
  }

  private renderBar(percent: number, width: number = 15): string {
    const filled = Math.floor((percent / 100) * width)
    const empty = width - filled
    return `\x1b[36m${'▓'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`
  }

  getState(): AIProgressState {
    return { ...this.state }
  }
}
