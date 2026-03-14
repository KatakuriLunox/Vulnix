import { Finding, ScanResult, SEVERITY_ORDER } from '../types'

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
  console.log('')
  console.log(`${BOLD}🔍 vulnix v1.0.0${RESET}`)
  console.log('━'.repeat(40))
  
  if (result.findings.length === 0) {
    console.log(`${BOLD}✓ No vulnerabilities found${RESET}`)
    console.log(`Scanned ${result.filesScanned} files in ${result.scanTime.toFixed(1)}s`)
    return
  }

  const bySeverity = groupBySeverity(result.findings)

  for (const severity of SEVERITY_ORDER) {
    const findings = bySeverity[severity]
    if (!findings || findings.length === 0) continue

    const color = SEVERITY_COLORS[severity]
    const label = severity.toUpperCase()
    
    console.log('')
    console.log(`${color}${BOLD}${label}: ${findings.length} issue${findings.length > 1 ? 's' : ''}${RESET}`)
    
    for (const finding of findings.slice(0, 10)) {
      console.log(`  ${color}●${RESET} ${finding.title}`)
      console.log(`    → ${finding.file}:${finding.line}`)
      if (finding.code) {
        console.log(`    ${color}│${RESET} ${finding.code.substring(0, 60)}`)
      }
      if (finding.aiStatus === 'confirmed' && finding.aiExplanation) {
        console.log(`    🤖 ${finding.aiExplanation.substring(0, 80)}...`)
      }
      if (finding.aiStatus === 'confirmed' && finding.aiFix) {
        console.log(`    ✅ Fix: ${finding.aiFix.substring(0, 60)}...`)
      }
    }
    
    if (findings.length > 10) {
      console.log(`  ... and ${findings.length - 10} more`)
    }
  }

  console.log('')
  console.log('━'.repeat(40))
  console.log(`${BOLD}📊 Statistics:${RESET}`)
  console.log(`  Static scan:    ${result.staticCount} issues found`)
  
  if (result.aiVerified) {
    console.log(`  🤖 AI verified:    ${result.confirmedCount} confirmed real`)
    console.log(`  ❌ AI dismissed:   ${result.dismissedCount} false positives`)
  }
  
  if (result.newFromAI > 0) {
    console.log(`  ✨ AI discovered: ${result.newFromAI} new issues`)
  }
  
  console.log(`  ⏱ Completed in    ${result.scanTime.toFixed(1)}s`)
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
