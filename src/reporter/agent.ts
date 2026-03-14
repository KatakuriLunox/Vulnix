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
    const latest = this.thoughts.slice(-1)
    
    if (latest.length === 0) {
      return
    }

    const icons: Record<string, string> = {
      thinking: '🤔',
      analyzing: '🔎',
      searching: '📁',
      found: '📍',
      ignored: '✓',
      concluding: '📊'
    }

    const thought = latest[0]
    const icon = icons[thought.type] || '💭'
    const msg = thought.message.length > 60 ? thought.message.slice(0, 60) + '...' : thought.message
    
    const output = `${neonText(icon, 'cyan')} ${msg}`
    
    if (!this.displayed) {
      console.log('')
      this.displayed = true
    }
    
    if (final) {
      console.log(output)
    } else {
      process.stdout.write('\r' + output + ' '.repeat(40))
    }
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
  console.log(neonText('  ──────────────────────────────', 'cyan'))
  console.log(`  Files Analyzed:       ${filesScanned}`)
  console.log(`  Static Findings:     ${findings.length}`)
  console.log(`  AI Confirmed:        ${confirmedCount}`)
  console.log(`  False Positives:    ${dismissedCount}`)
  console.log(`  Scan Time:           ${scanTime.toFixed(1)}s`)
  console.log(`  AI Analysis:         ${aiAnalysisTime.toFixed(1)}s`)
  console.log(`  Total Time:          ${(scanTime + aiAnalysisTime).toFixed(1)}s`)
  console.log('')

  // Security Score - based on AI CONFIRMED findings only
  const criticalCount = findings.filter(f => f.severity === 'critical' && f.aiStatus === 'confirmed').length
  const highCount = findings.filter(f => f.severity === 'high' && f.aiStatus === 'confirmed').length
  const mediumCount = findings.filter(f => f.severity === 'medium' && f.aiStatus === 'confirmed').length
  const lowCount = findings.filter(f => f.severity === 'low' && f.aiStatus === 'confirmed').length
  
  const confirmedTotal = criticalCount + highCount + mediumCount + lowCount
  
  let score = 100
  if (confirmedTotal > 0) {
    score = 100 - (criticalCount * 25) - (highCount * 15) - (mediumCount * 8) - (lowCount * 3)
  }
  score = Math.max(0, Math.min(100, score))
  
  let scoreColor = 'green'
  if (score < 70) scoreColor = 'yellow'
  if (score < 50) scoreColor = 'red'
  
  const confirmedFindings = findings.filter(f => f.aiStatus === 'confirmed')
  
  console.log(neonText('  🎯 SECURITY SCORE', 'cyan'))
  console.log(neonText('  ──────────────────────────────', 'cyan'))
  console.log(`  Score: ${neonText(score + '/100', scoreColor as any)}`)
  
  if (confirmedTotal === 0) {
    console.log(neonText('  ✓ No confirmed vulnerabilities!', 'green'))
    if (dismissedCount > 0) {
      console.log(neonText(`  ✓ Ruled out ${dismissedCount} false positives`, 'cyan'))
    }
  } else {
    console.log('')
    console.log(neonText('  🚨 CONFIRMED VULNERABILITIES', 'red'))
    
    console.log(`    Critical: ${neonText(criticalCount.toString(), 'red')}`)
    console.log(`    High:     ${neonText(highCount.toString(), 'yellow')}`)
    console.log(`    Medium:   ${neonText(mediumCount.toString(), 'magenta')}`)
    console.log(`    Low:      ${lowCount}`)
  }

  console.log('')
  
  // Detailed Findings - only show confirmed
  if (confirmedFindings.length > 0) {
    console.log(neonText('  📋 DETAILED FINDINGS', 'cyan'))
    console.log(neonText('  ──────────────────────────────', 'cyan'))
    
    for (const f of confirmedFindings.slice(0, 20)) {
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
    
    if (confirmedFindings.length > 20) {
      console.log('')
      console.log(`  ... and ${confirmedFindings.length - 20} more issues`)
    }
  }

  // AI Analysis Summary
  console.log('')
  console.log(neonText('  🤖 AI ANALYSIS LOG', 'cyan'))
  console.log(neonText('  ──────────────────────────────', 'cyan'))
  
  const agent = new AIAgentDisplay()
  agent.start('Final Analysis')
  agent.think('concluding', `Analyzed ${filesScanned} files`)
  agent.think('concluding', `Confirmed ${confirmedCount} real vulnerabilities`)
  agent.think('concluding', `Dismissed ${dismissedCount} false positives`)
  
  if (confirmedFindings.length === 0) {
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

export function generateChatReport(
  findings: any[],
  confirmedCount: number,
  filesScanned: number,
  scanTime: number
): void {
  console.log('')
  console.log(neonText('🤖 Vulnix AI Security Scanner', 'cyan'))
  console.log(neonText('─'.repeat(50), 'cyan'))
  console.log('')
  
  console.log(neonText('> Scanning files...', 'green'))
  console.log(`  Found ${filesScanned} files to analyze`)
  console.log('')

  if (findings.length === 0) {
    console.log(neonText('✅ Security Analysis Complete', 'green'))
    console.log('')
    console.log('  No security vulnerabilities detected.')
    console.log(`  Scanned ${filesScanned} files in ${scanTime.toFixed(1)}s`)
    console.log('')
    return
  }

  console.log(neonText(`⚠️  Found ${findings.length} security issues:`, 'yellow'))
  console.log('')

  const bySeverity: Record<string, any[]> = {}
  for (const f of findings) {
    if (!bySeverity[f.severity]) bySeverity[f.severity] = []
    bySeverity[f.severity].push(f)
  }

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
  
  for (const sev of severityOrder) {
    const items = bySeverity[sev]
    if (!items || items.length === 0) continue

    const color = sev === 'critical' ? 'red' : sev === 'high' ? 'yellow' : sev === 'medium' ? 'magenta' : 'cyan'
    const icon = sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '⚪'
    
    console.log(neonText(`  ${icon} ${sev.toUpperCase()} (${items.length})`, color))
    
    for (const f of items.slice(0, 5)) {
      console.log(`     • ${f.title}`)
      console.log(`       ${f.file}:${f.line}`)
      if (f.aiExplanation) {
        console.log(neonText(`       💡 ${f.aiExplanation.slice(0, 100)}...`, 'cyan'))
      }
      if (f.aiFix) {
        console.log(neonText(`       ✅ ${f.aiFix.slice(0, 80)}...`, 'green'))
      }
    }
    
    if (items.length > 5) {
      console.log(`     ... and ${items.length - 5} more`)
    }
    console.log('')
  }

  const criticalCount = bySeverity.critical?.length || 0
  const highCount = bySeverity.high?.length || 0
  
  console.log(neonText('📊 Summary', 'cyan'))
  console.log('─'.repeat(30))
  console.log(`  Files scanned:     ${filesScanned}`)
  console.log(`  Total issues:     ${findings.length}`)
  if (criticalCount > 0) console.log(neonText(`  🔴 Critical:       ${criticalCount}`, 'red'))
  if (highCount > 0) console.log(neonText(`  🟠 High:           ${highCount}`, 'yellow'))
  console.log(`  Scan time:        ${scanTime.toFixed(1)}s`)
  console.log('')
}
