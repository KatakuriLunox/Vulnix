import { ScanResult } from '../types'

export function reportJSON(result: ScanResult): void {
  const output = {
    scanTime: result.scanTime,
    filesScanned: result.filesScanned,
    findings: result.findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      file: f.file,
      line: f.line,
      code: f.code,
      message: f.message,
      fix: f.fix || f.aiFix,
      category: f.category,
      aiStatus: f.aiStatus,
      aiExplanation: f.aiExplanation,
      aiFix: f.aiFix
    })),
    summary: {
      total: result.findings.length,
      critical: result.findings.filter(f => f.severity === 'critical').length,
      high: result.findings.filter(f => f.severity === 'high').length,
      medium: result.findings.filter(f => f.severity === 'medium').length,
      low: result.findings.filter(f => f.severity === 'low').length,
      info: result.findings.filter(f => f.severity === 'info').length,
      confirmed: result.confirmedCount,
      dismissed: result.dismissedCount,
      newFromAI: result.newFromAI
    },
    aiVerified: result.aiVerified,
    staticCount: result.staticCount
  }

  console.log(JSON.stringify(output, null, 2))
}
