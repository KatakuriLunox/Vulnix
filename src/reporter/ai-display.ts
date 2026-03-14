import { neonText } from './spinner'

export interface AIProgressState {
  phase: 'init' | 'verifying' | 'deepscan' | 'complete'
  current: number
  total: number
  currentFile?: string
  currentFinding?: string
  thoughts: string[]
  findingsFound: number
  confirmed: number
  dismissed: number
  startTime: number
  aborted: boolean
}

export class AIProgressDisplay {
  private state: AIProgressState
  private renderInterval: NodeJS.Timeout | null = null
  private lastRender = ''
  private lastRenderTime = 0

  constructor() {
    this.state = this.getInitialState()
  }

  private getInitialState(): AIProgressState {
    return {
      phase: 'init',
      current: 0,
      total: 0,
      thoughts: [],
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
    this.render(true)
    this.renderInterval = setInterval(() => this.render(true), 600)
  }

  update(updates: Partial<AIProgressState>): void {
    const oldCurrent = this.state.current
    this.state = { ...this.state, ...updates }
    
    if (updates.current !== undefined && updates.current !== oldCurrent) {
      this.render(true)
    }
  }

  addThought(thought: string): void {
    if (thought.includes('Batch') || thought.includes('Verifying batch')) {
      this.state.thoughts = [thought]
    } else if (!thought.startsWith('  ')) {
      this.state.thoughts = [thought]
    }
    this.render(true)
  }

  incrementFound(): void {
    this.state.findingsFound++
    this.render(true)
  }

  incrementConfirmed(): void {
    this.state.confirmed++
    this.render(true)
  }

  incrementDismissed(): void {
    this.state.dismissed++
    this.render(true)
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

  private render(force = false): void {
    const now = Date.now()
    if (!force && now - this.lastRenderTime < 400) return
    this.lastRenderTime = now

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

    if (output !== this.lastRender || force) {
      process.stdout.write('\r\x1b[2J\x1b[H' + output)
      this.lastRender = output
    }
  }

  private renderVerification(s: AIProgressState, elapsed: string): string {
    const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
    const bar = this.renderBar(percent)

    return `${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  🤖 AI SECURITY ANALYST ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${neonText('  🔬 PHASE: VERIFICATION', 'yellow')}
  Analyzing static scan findings with DevStral AI...

${neonText(`  ${bar} ${percent}%`, 'cyan')}
  ${s.current}/${s.total} findings verified | ${elapsed}s elapsed

${s.thoughts[0] ? neonText(`  ${s.thoughts[0]}`, 'magenta') : ''}

${neonText('──────────────────────────────────────────────────', 'cyan')}
  ✓ Confirmed: ${neonText(s.confirmed.toString(), 'green')}  |  
  ✗ Dismissed: ${neonText(s.dismissed.toString(), 'red')}  |  
  📊 Remaining: ${s.total - s.current}
${neonText('══════════════════════════════════════════════════', 'cyan')}

  ${neonText('Press Ctrl+C to interrupt', 'yellow')}
`
  }

  private renderDeepScan(s: AIProgressState, elapsed: string): string {
    const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
    const bar = this.renderBar(percent)

    return `${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  🧠 DEEP SECURITY SCAN ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${neonText('  🔬 PHASE: DEEP ANALYSIS', 'yellow')}
  Scanning for advanced vulnerabilities...

${neonText(`  ${bar} ${percent}%`, 'cyan')}
  ${s.current}/${s.total} files scanned | ${elapsed}s elapsed

${s.thoughts[0] ? neonText(`  ${s.thoughts[0]}`, 'magenta') : ''}

${neonText('──────────────────────────────────────────────────', 'cyan')}
  🚨 Issues: ${neonText(s.findingsFound.toString(), 'yellow')}  |  
  ✓ Confirmed: ${neonText(s.confirmed.toString(), 'green')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

  ${neonText('Press Ctrl+C to interrupt', 'yellow')}
`
  }

  private renderComplete(s: AIProgressState, elapsed: string): string {
    const status = s.aborted 
      ? neonText('  ⚠️ SCAN ABORTED BY USER', 'yellow')
      : neonText('  ✓ AI ANALYSIS COMPLETE', 'green')

    return `${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  ✅ ANALYSIS COMPLETE ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${status}
  Total time: ${elapsed}s

${neonText('──────────────────────────────────────────────────', 'cyan')}
  ${neonText('📊 FINAL RESULTS:', 'cyan')}
  ✓ Confirmed: ${neonText(s.confirmed.toString(), 'green')}
  ✗ Dismissed: ${neonText(s.dismissed.toString(), 'red')}
  🚨 Total: ${neonText(s.findingsFound.toString(), 'yellow')}
${neonText('══════════════════════════════════════════════════', 'cyan')}
`
  }

  private renderBar(percent: number, width: number = 20): string {
    const filled = Math.floor((percent / 100) * width)
    const empty = width - filled
    return `\x1b[36m${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`
  }

  getState(): AIProgressState {
    return { ...this.state }
  }
}
