import { Finding, ScanResult, SEVERITY_ORDER } from '../types'
import { neonText } from './spinner'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '\x1b[31m',
  high: '\x1b[33m',
  medium: '\x1b[35m',
  low: '\x1b[36m',
  info: '\x1b[90m'
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

export function reportTerminal(result: ScanResult): void {
  console.log(neonText('═'.repeat(50), 'cyan'))
  console.log(neonText('  ⚡ SCAN RESULTS ', 'magenta') + neonText('v1.1.0', 'cyan'))
  console.log(neonText('═'.repeat(50), 'cyan'))
  console.log('')
  
  if (result.findings.length === 0) {
    console.log(neonText('  ✓ NO VULNERABILITIES DETECTED', 'green'))
    console.log(`  Scanned ${result.filesScanned} files in ${result.scanTime.toFixed(1)}s`)
    console.log('')
    return
  }

  const bySeverity = groupBySeverity(result.findings)

  for (const severity of SEVERITY_ORDER) {
    const findings = bySeverity[severity]
    if (!findings || findings.length === 0) continue

    const color = SEVERITY_COLORS[severity]
    const label = severity.toUpperCase()
    const colorName = severity === 'critical' ? 'red' : severity === 'high' ? 'yellow' : severity === 'medium' ? 'magenta' : 'cyan'
    
    console.log(neonText(`  ┌─ ${label}: ${findings.length} issue${findings.length > 1 ? 's' : ''} `, colorName))
    console.log(neonText('  │', 'cyan'))
    
    for (const finding of findings.slice(0, 10)) {
      console.log(`  │  ${color}●${RESET} ${finding.title}`)
      console.log(`  │  ${color}→${RESET} ${finding.file}:${finding.line}`)
      if (finding.code) {
        console.log(`  │  ${color}│${RESET} ${finding.code.substring(0, 55)}`)
      }
      if (finding.aiStatus === 'confirmed' && finding.aiExplanation) {
        console.log(neonText(`  │  ◈ AI: ${finding.aiExplanation.substring(0, 70)}...`, 'magenta'))
      }
      if (finding.aiStatus === 'confirmed' && finding.aiFix) {
        console.log(neonText(`  │  ✓ Fix: ${finding.aiFix.substring(0, 50)}...`, 'green'))
      }
      console.log(neonText('  │', 'cyan'))
    }
    
    if (findings.length > 10) {
      console.log(`  │  ... and ${findings.length - 10} more`)
      console.log(neonText('  │', 'cyan'))
    }
  }

  console.log(neonText('  └' + '─'.repeat(45), 'cyan'))
  console.log('')
  console.log(neonText('  📊 STATISTICS ', 'magenta'))
  console.log(neonText('  ├', 'cyan') + ` Static scan:     ${result.staticCount} issues`)
  
  if (result.aiVerified) {
    console.log(neonText('  ├', 'cyan') + ` AI verified:     ${result.confirmedCount} confirmed`)
    console.log(neonText('  ├', 'cyan') + ` AI dismissed:    ${result.dismissedCount} false positives`)
  }
  
  if (result.newFromAI > 0) {
    console.log(neonText('  ├', 'cyan') + ` AI discovered:   ${result.newFromAI} new issues`)
  }
  
  console.log(neonText('  └', 'cyan') + ` Scan time:       ${result.scanTime.toFixed(1)}s`)
  console.log('')
}

function groupBySeverity(findings: Finding[]): Record<string, Finding[]> {
  const grouped: Record<string, Finding[]> = {}
  
  for (const finding of findings) {
    if (!grouped[finding.severity]) {
      grouped[finding.severity] = []
    }
    grouped[finding.severity].push(finding)
  }
  
  return grouped
}
