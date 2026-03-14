import { neonText } from './spinner'

export interface AgentThought {
  type: 'thinking' | 'analyzing' | 'searching' | 'found' | 'ignored' | 'concluding'
  message: string
  timestamp: number
}

export class AIAgentDisplay {
  private thoughts: AgentThought[] = []
  private currentPhase = ''
  private startTime = 0
  private displayed = false

  start(phase: string): void {
    this.currentPhase = phase
    this.startTime = Date.now()
    this.thoughts = []
    this.displayed = false
  }

  think(type: AgentThought['type'], message: string): void {
    this.thoughts.push({ type, message, timestamp: Date.now() })
    this.thoughts = this.thoughts.slice(-8)
    this.render()
  }

  stop(): void {
    this.render(true)
    console.log('')
  }

  private render(final = false): void {
    if (!this.displayed && !final) {
      console.log('')
      this.displayed = true
    }

    const elapsed = (Date.now() - this.startTime) / 1000
    const elapsedStr = elapsed < 60 ? `${elapsed.toFixed(1)}s` : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`
    const latest = this.thoughts.slice(-5)

    let output = ''
    
    if (latest.length === 0) {
      output = `${neonText('🤖 AGENT', 'magenta')} ${neonText(this.currentPhase, 'cyan')} | ${elapsedStr}`
    } else {
      const icons: Record<string, string> = {
        thinking: '💭',
        analyzing: '🔍',
        searching: '🎯',
        found: '🚨',
        ignored: '✅',
        concluding: '📋'
      }
      
      const thought = latest[latest.length - 1]
      const icon = icons[thought.type] || '💭'
      const msg = thought.message.length > 70 ? thought.message.slice(0, 70) + '...' : thought.message
      
      output = `${neonText('🤖 AGENT', 'magenta')} ${icon} ${msg} | ${elapsedStr}`
    }

    process.stdout.write('\r' + output + ' '.repeat(40))
  }

  getThoughts(): AgentThought[] {
    return [...this.thoughts]
  }
}

export function generateComprehensiveReport(
  findings: any[],
  confirmedCount: number,
  dismissedCount: number,
  filesScanned: number,
  scanTime: number,
  aiAnalysisTime: number
): void {
  console.log('')
  console.log(neonText('═'.repeat(60), 'cyan'))
  console.log(neonText('           🛡️  VULNIX AI SECURITY REPORT  🛡️', 'magenta'))
  console.log(neonText('═'.repeat(60), 'cyan'))
  console.log('')

  // Executive Summary
  console.log(neonText('  📊 EXECUTIVE SUMMARY', 'cyan'))
  console.log(neonText('  ─'.repeat(30), 'cyan'))
  console.log(`  Files Analyzed:       ${filesScanned}`)
  console.log(`  Static Findings:     ${findings.length}`)
  console.log(`  AI Confirmed:        ${confirmedCount}`)
  console.log(`  False Positives:    ${dismissedCount}`)
  console.log(`  Scan Time:           ${scanTime.toFixed(1)}s`)
  console.log(`  AI Analysis:         ${aiAnalysisTime.toFixed(1)}s`)
  console.log(`  Total Time:          ${(scanTime + aiAnalysisTime).toFixed(1)}s`)
  console.log('')

  // Security Score
  const score = findings.length === 0 ? 100 : Math.max(0, 100 - (confirmedCount * 15))
  let scoreColor = 'green'
  if (score < 70) scoreColor = 'yellow'
  if (score < 50) scoreColor = 'red'
  
  console.log(neonText('  🎯 SECURITY SCORE', 'cyan'))
  console.log(neonText('  ─'.repeat(30), 'cyan'))
  console.log(`  Score: ${neonText(score + '/100', scoreColor as any)}`)
  
  if (findings.length === 0) {
    console.log(neonText('  ✓ No security vulnerabilities detected!', 'green'))
    console.log(neonText('  ✓ Your codebase passes all security checks', 'green'))
  } else {
    console.log('')
    console.log(neonText('  🚨 VULNERABILITIES FOUND', 'red'))
    
    const bySev: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    findings.forEach(f => bySev[f.severity] = (bySev[f.severity] || 0) + 1)
    
    console.log(`    Critical: ${neonText(bySev.critical.toString(), 'red')}`)
    console.log(`    High:     ${neonText(bySev.high.toString(), 'yellow')}`)
    console.log(`    Medium:   ${neonText(bySev.medium.toString(), 'magenta')}`)
    console.log(`    Low:      ${bySev.low}`)
    console.log(`    Info:     ${bySev.info}`)
  }

  console.log('')
  
  // Detailed Findings
  if (findings.length > 0) {
    console.log(neonText('  📋 DETAILED FINDINGS', 'cyan'))
    console.log(neonText('  ─'.repeat(30), 'cyan'))
    
    for (const f of findings.slice(0, 20)) {
      const sevIcon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '⚪'
      console.log('')
      console.log(`  ${sevIcon} ${neonText(f.severity.toUpperCase(), f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'yellow' : 'magenta')}: ${f.title}`)
      console.log(`     → ${f.file}:${f.line}`)
      if (f.code) {
        console.log(`     Code: ${f.code.slice(0, 50)}`)
      }
      if (f.aiExplanation) {
        console.log(`     💡 ${f.aiExplanation.slice(0, 100)}`)
      }
      if (f.aiFix || f.fix) {
        console.log(neonText(`     ✅ Fix: ${(f.aiFix || f.fix).slice(0, 80)}`, 'green'))
      }
    }
    
    if (findings.length > 20) {
      console.log('')
      console.log(`  ... and ${findings.length - 20} more issues`)
    }
  }

  // AI Analysis Summary
  console.log('')
  console.log(neonText('  🤖 AI ANALYSIS LOG', 'cyan'))
  console.log(neonText('  ─'.repeat(30), 'cyan'))
  
  const agent = new AIAgentDisplay()
  agent.start('Final Analysis')
  agent.think('concluding', `Analyzed ${filesScanned} files`)
  agent.think('concluding', `Confirmed ${confirmedCount} real vulnerabilities`)
  agent.think('concluding', `Dismissed ${dismissedCount} false positives`)
  
  if (findings.length === 0) {
    agent.think('concluding', 'No security issues detected')
    agent.think('concluding', 'Codebase is secure')
  } else {
    agent.think('concluding', `Found ${confirmedCount} issues requiring attention`)
  }
  agent.stop()

  console.log('')
  console.log(neonText('═'.repeat(60), 'cyan'))
  console.log(neonText('    Report generated by Vulnix AI Security Agent', 'cyan'))
  console.log(neonText('═'.repeat(60), 'cyan'))
  console.log('')
}
