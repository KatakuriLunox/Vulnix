export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AIStatus = 'confirmed' | 'false-positive' | 'pending' | 'unverified'
export type OutputFormat = 'terminal' | 'json' | 'html'

export interface FileInfo {
  path: string
  relativePath: string
  extension: string
  language: string
  size: number
  lines: number
}

export interface Finding {
  id: string
  title: string
  severity: Severity
  file: string
  line: number
  code: string
  message: string
  fix?: string
  category: string
  aiStatus: AIStatus
  aiExplanation?: string
  aiFix?: string
}

export interface ScanOptions {
  path: string
  ai: boolean
  full: boolean
  output: OutputFormat
  severity: Severity
  apiKey?: string
  ignore?: string[]
  maxFiles?: number
}

export interface ScanResult {
  findings: Finding[]
  filesScanned: number
  scanTime: number
  aiVerified: boolean
  staticCount: number
  confirmedCount: number
  dismissedCount: number
  newFromAI: number
}

export interface Detector {
  name: string
  category: string
  scan(file: FileInfo, content: string): Finding[]
}

export interface AIVerification {
  findingId: string
  status: AIStatus
  explanation: string
  fix?: string
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rs': 'rust',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sql': 'sql',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.txt': 'text'
}

export const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
  '*.min.js',
  '*.bundle.js',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.env',
  '.env.local',
  '.env.*.local',
  'generated',
  '.generated',
  '*.pb.go',
  '*.pb.ts',
  'dist-svc',
  '.cache'
]
