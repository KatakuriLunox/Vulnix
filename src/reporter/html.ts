import { ScanResult, SEVERITY_ORDER } from '../types'

export function reportHTML(result: ScanResult): void {
  const bySeverity = groupBySeverity(result.findings)
  const severityCounts = SEVERITY_ORDER.map(s => ({
    severity: s,
    count: bySeverity[s]?.length || 0
  }))

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vulnix Security Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 10px; }
    .meta { color: #8b949e; margin-bottom: 30px; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
    .stat { background: #161b22; padding: 15px 25px; border-radius: 8px; border: 1px solid #30363d; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { color: #8b949e; font-size: 14px; }
    .critical .stat-value { color: #f85149; }
    .high .stat-value { color: #d29922; }
    .medium .stat-value { color: #a371f7; }
    .low .stat-value { color: #3fb950; }
    .section { margin-bottom: 30px; }
    .section h2 { margin-bottom: 15px; color: #58a6ff; }
    .finding { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
    .finding.critical { border-left: 4px solid #f85149; }
    .finding.high { border-left: 4px solid #d29922; }
    .finding.medium { border-left: 4px solid #a371f7; }
    .finding.low { border-left: 4px solid #3fb950; }
    .finding.info { border-left: 4px solid #8b949e; }
    .finding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .finding-title { font-weight: bold; font-size: 16px; }
    .severity-badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .severity-badge.critical { background: #f8514922; color: #f85149; }
    .severity-badge.high { background: #d2992222; color: #d29922; }
    .severity-badge.medium { background: #a371f722; color: #a371f7; }
    .severity-badge.low { background: #3fb95022; color: #3fb950; }
    .severity-badge.info { background: #8b949e22; color: #8b949e; }
    .finding-meta { color: #8b949e; font-size: 13px; margin-bottom: 8px; }
    .finding-code { background: #0d1117; padding: 10px; border-radius: 4px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; overflow-x: auto; color: #79c0ff; }
    .finding-message { margin-top: 10px; color: #c9d1d9; }
    .ai-verified { margin-top: 10px; padding: 10px; background: #23863622; border-radius: 4px; font-size: 13px; }
    .ai-dismissed { margin-top: 10px; padding: 10px; background: #8b949e22; border-radius: 4px; font-size: 13px; }
    .fix { margin-top: 8px; color: #3fb950; }
    .empty { text-align: center; padding: 40px; color: #8b949e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Vulnix Security Report</h1>
    <p class="meta">Scanned ${result.filesScanned} files in ${result.scanTime.toFixed(1)}s</p>
    
    <div class="summary">
      ${severityCounts.map(s => `
      <div class="stat ${s.severity}">
        <div class="stat-value">${s.count}</div>
        <div class="stat-label">${s.severity.toUpperCase()}</div>
      </div>
      `).join('')}
    </div>

    ${result.findings.length === 0 ? '<div class="empty">No vulnerabilities found! ✓</div>' : ''}

    ${SEVERITY_ORDER.map(severity => {
      const findings = bySeverity[severity]
      if (!findings || findings.length === 0) return ''
      return `
      <div class="section">
        <h2>${severity.toUpperCase()} (${findings.length})</h2>
        ${findings.map(f => `
        <div class="finding ${f.severity}">
          <div class="finding-header">
            <span class="finding-title">${escapeHtml(f.title)}</span>
            <span class="severity-badge ${f.severity}">${f.severity}</span>
          </div>
          <div class="finding-meta">${escapeHtml(f.file)}:${f.line} • ${escapeHtml(f.category)}</div>
          ${f.code ? `<div class="finding-code">${escapeHtml(f.code)}</div>` : ''}
          <div class="finding-message">${escapeHtml(f.message)}</div>
          ${f.aiStatus === 'confirmed' ? `<div class="ai-verified">🤖 ${escapeHtml(f.aiExplanation || '')}</div>` : ''}
          ${f.aiStatus === 'false-positive' ? `<div class="ai-dismissed">❌ ${escapeHtml(f.aiExplanation || 'False positive')}</div>` : ''}
          ${f.aiFix || f.fix ? `<div class="fix">✅ Fix: ${escapeHtml(f.aiFix || f.fix || '')}</div>` : ''}
        </div>
        `).join('')}
      </div>
      `
    }).join('')}
  </div>
</body>
</html>`

  console.log(html)
}

function groupBySeverity(findings: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}
  for (const finding of findings) {
    if (!grouped[finding.severity]) grouped[finding.severity] = []
    grouped[finding.severity].push(finding)
  }
  return grouped
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
