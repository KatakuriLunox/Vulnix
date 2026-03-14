import { neonText } from './spinner'

export interface AIState {
  phase: 'idle' | 'verifying' | 'deepscan' | 'done'
  current: number
  total: number
  confirmed: number
  dismissed: number
  found: number
  thought: string
  startTime: number
}

export class AIProgressDisplay {
  private state: AIState
  private lastLine = ''

  constructor() {
    this.state = this.idle()
  }

  private idle(): AIState {
    return { phase: 'idle', current: 0, total: 0, confirmed: 0, dismissed: 0, found: 0, thought: '', startTime: Date.now() }
  }

  start(phase: 'verifying' | 'deepscan', total: number): void {
    this.state = { ...this.idle(), phase, total }
    this.render()
  }

  updateProgress(current: number): void {
    this.state.current = current
    this.render()
  }

  setThought(thought: string): void {
    this.state.thought = thought
    this.render()
  }

  addResult(confirmed: boolean): void {
    if (confirmed) this.state.confirmed++
    else this.state.dismissed++
    this.render()
  }

  addFound(count: number): void {
    this.state.found += count
    this.render()
  }

  stop(): void {
    this.state.phase = 'done'
    this.render()
    console.log('')
  }

  private render(): void {
    const s = this.state
    const elapsed = ((Date.now() - s.startTime) / 1000).toFixed(1)
    
    let line = ''
    
    if (s.phase === 'verifying' || s.phase === 'deepscan') {
      const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
      const bar = this.renderBar(percent)
      const label = s.phase === 'verifying' ? '🤖 AI' : '🧠 DEEP'
      const suffix = s.phase === 'verifying' ? '' : ` files`
      
      line = `${neonText(label, 'magenta')} ${bar} ${percent}% | ${s.current}/${s.total}${suffix} | ${elapsed}s`
      
      if (s.thought) {
        line += ` | ${s.thought}`
      }
    } else if (s.phase === 'done') {
      const status = neonText('✓ DONE', 'green')
      line = `${status} | ${s.confirmed} confirmed | ${s.dismissed} dismissed | ${s.found} found | ${elapsed}s`
    }

    if (line !== this.lastLine) {
      process.stdout.write('\r' + line + ' '.repeat(Math.max(0, 60 - line.length)))
      this.lastLine = line
    }
  }

  private renderBar(percent: number, width: number = 12): string {
    const filled = Math.floor((percent / 100) * width)
    const empty = width - filled
    return `\x1b[36m${'▓'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`
  }
}
