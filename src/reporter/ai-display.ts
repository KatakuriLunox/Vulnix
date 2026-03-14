import { neonText } from './spinner'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

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
    this.render()
    this.renderInterval = setInterval(() => this.render(), 100)
  }

  update(updates: Partial<AIProgressState>): void {
    this.state = { ...this.state, ...updates }
  }

  addThought(thought: string): void {
    this.state.thoughts = [...this.state.thoughts.slice(-8), thought]
  }

  incrementFound(): void {
    this.state.findingsFound++
  }

  incrementConfirmed(): void {
    this.state.confirmed++
  }

  incrementDismissed(): void {
    this.state.dismissed++
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

  private render(final = false): void {
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

    if (output !== this.lastRender || final) {
      this.clear()
      process.stdout.write(output)
      this.lastRender = output
    }
  }

  private renderVerification(s: AIProgressState, elapsed: string): string {
    const percent = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0
    const bar = this.renderBar(percent)
    
    let thoughts = ''
    if (s.thoughts.length > 0) {
      const latest = s.thoughts.slice(-3)
      thoughts = latest.map(t => `  ${t}`).join('\n')
    }

    return `
${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  🤖 AI SECURITY ANALYST ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${neonText('  🔬 PHASE: VERIFICATION', 'yellow')}
  Analyzing static scan findings with DevStral AI...

${neonText(`  ${bar} ${percent}%`, 'cyan')}
  Progress: ${s.current}/${s.total} findings analyzed
  Time elapsed: ${elapsed}s

${thoughts ? thoughts : '  💭 Thinking...'}

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
    
    let thoughts = ''
    if (s.thoughts.length > 0) {
      const latest = s.thoughts.slice(-3)
      thoughts = latest.map(t => `  ${t}`).join('\n')
    }

    return `
${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  🧠 DEEP SECURITY SCAN ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${neonText('  🔬 PHASE: DEEP ANALYSIS', 'yellow')}
  Running comprehensive security analysis...
  (This may take a while for large codebases)

${neonText(`  ${bar} ${percent}%`, 'cyan')}
  Files analyzed: ${s.current}/${s.total}
  Time elapsed: ${elapsed}s

${s.currentFile ? `  📄 Current: ${s.currentFile}` : ''}

${thoughts ? thoughts : '  💭 Analyzing attack surfaces...'}

${neonText('──────────────────────────────────────────────────', 'cyan')}
  🚨 Issues found: ${neonText(s.findingsFound.toString(), 'yellow')}
  ✓ Confirmed: ${neonText(s.confirmed.toString(), 'green')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

  ${neonText('Press Ctrl+C to interrupt', 'yellow')}
`
  }

  private renderComplete(s: AIProgressState, elapsed: string): string {
    const status = s.aborted 
      ? neonText('  ⚠️ SCAN ABORTED BY USER', 'yellow')
      : neonText('  ✓ AI ANALYSIS COMPLETE', 'green')

    return `
${neonText('══════════════════════════════════════════════════', 'cyan')}
${neonText('  ✅ ANALYSIS COMPLETE ', 'magenta')}
${neonText('══════════════════════════════════════════════════', 'cyan')}

${status}
  Total time: ${elapsed}s

${neonText('──────────────────────────────────────────────────', 'cyan')}
  ${neonText('📊 FINAL RESULTS:', 'cyan')}
  ✓ Confirmed real vulnerabilities: ${neonText(s.confirmed.toString(), 'green')}
  ✗ False positives dismissed: ${neonText(s.dismissed.toString(), 'red')}
  🚨 Total issues found: ${neonText(s.findingsFound.toString(), 'yellow')}
${neonText('══════════════════════════════════════════════════', 'cyan')}
`
  }

  private renderBar(percent: number, width: number = 25): string {
    const filled = Math.floor((percent / 100) * width)
    const empty = width - filled
    const filledStr = '█'.repeat(Math.max(0, Math.min(filled, width)))
    const emptyStr = '░'.repeat(Math.max(0, empty))
    return `\x1b[36m${filledStr}\x1b[90m${emptyStr}\x1b[0m`
  }

  private clear(): void {
    const lines = this.lastRender.split('\n').length
    process.stdout.write(`\x1b[${lines}A\x1b[J`)
  }

  getState(): AIProgressState {
    return { ...this.state }
  }
}
