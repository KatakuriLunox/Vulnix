export function buildVerifyPrompt(finding: any, context: string): string {
  return `You are a security expert analyzing code for vulnerabilities.

## Finding to Verify:
- Title: ${finding.title}
- Category: ${finding.category}
- Message: ${finding.message}
- Code: ${finding.code}
- File: ${finding.file}
- Line: ${finding.line}

## Code Context (15 lines before and after):
\`\`\`
${context}
\`\`\`

## Your Task:
Analyze if this is a REAL vulnerability or a FALSE POSITIVE.

Respond in JSON format:
{
  "status": "confirmed" | "false-positive",
  "explanation": "Why this is or isn't a real vulnerability",
  "fix": "How to fix it (if real)"
}

Be strict - only confirm if there's a genuine security risk.`
}

export function buildDeepScanPrompt(fileContent: string, filePath: string): string {
  return `You are a security expert performing a deep scan of code for vulnerabilities that static analysis cannot detect.

## File: ${filePath}

## Code:
\`\`\`
${fileContent}
\`\`\`

## Your Task:
Analyze this code for security issues that regex-based scanners miss:
- Business logic vulnerabilities
- Insecure data flows
- Authentication/authorization flaws
- Race conditions
- Insecure deserialization
- SSRF
- IDOR
- Auth bypass via logic errors
- Information leakage
- Improper input validation
- Hardcoded credentials in unusual places

Respond in JSON array format (empty array if no issues):
[
  {
    "line": <line number>,
    "title": "Brief issue title",
    "category": "category name",
    "severity": "critical | high | medium | low",
    "explanation": "What's wrong and why it's dangerous",
    "fix": "How to fix it"
  }
]

Be thorough but accurate. Only report genuine security issues.`
}

export function buildDeepScanSystemPrompt(): string {
  return `You are a security expert specialized in finding complex vulnerabilities in code. 
You analyze code thoroughly to find issues that simple pattern matching cannot detect.
Always respond with valid JSON.`
}
