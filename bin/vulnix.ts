#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { Scanner } from '../src/core/scanner'
import { ScanResult, Severity } from '../src/types'
import { SecretsDetector } from '../src/detectors/secrets'
import { InjectionDetector } from '../src/detectors/injection'
import { XSSDetector } from '../src/detectors/xss'
import { AuthDetector } from '../src/detectors/auth'
import { CryptoDetector } from '../src/detectors/crypto'
import { FilesystemDetector } from '../src/detectors/filesystem'
import { NetworkDetector } from '../src/detectors/network'
import { PerformanceDetector } from '../src/detectors/performance'
import { ErrorHandlingDetector } from '../src/detectors/errorhandling'
import { AIDetector } from '../src/detectors/ai'
import { BackdoorDetector } from '../src/detectors/backdoor'
import { verifyFindings } from '../src/ai/verifier'
import { deepScan } from '../src/ai/deepscanner'
import { reportTerminal } from '../src/reporter/terminal'
import { reportJSON } from '../src/reporter/json'
import { reportHTML } from '../src/reporter/html'
import { configManager } from '../src/config'
import { Spinner, neonText } from '../src/reporter/spinner'
import { AIProgressDisplay } from '../src/reporter/ai-display'

const program = new Command()
let abortController: AbortController | null = null
let aiDisplay: AIProgressDisplay | null = null

function setupInterruptHandler(): void {
  process.on('SIGINT', () => {
    if (abortController) {
      abortController.abort()
      if (aiDisplay) aiDisplay.stop()
      console.log(neonText('\n⚠️ Scan aborted', 'yellow'))
      process.exit(130)
    }
  })
}

async function getApiKey(options: any): Promise<string | undefined> {
  if (options.apiKey) return options.apiKey
  const envKey = process.env.MISTRAL_API_KEY
  if (envKey) return envKey
  const savedKey = configManager.getApiKey()
  if (savedKey) return savedKey
  
  if (options.ai || options.full) {
    console.log('')
    console.log(neonText('🔐 VULNIX AI', 'magenta'))
    console.log(neonText('═'.repeat(30), 'cyan'))
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise((resolve) => {
      rl.question('  API Key: ', (answer: string) => {
        rl.close()
        const key = answer.trim()
        if (key) {
          configManager.setApiKey(key)
          console.log(neonText('  ✓ Saved\n', 'green'))
        }
        resolve(key || undefined)
      })
    })
  }
  return undefined
}

program.name('vulnix').description('AI security scanner').version('1.4.1')

program.command('scan')
  .argument('<path>', 'Path to scan')
  .option('--ai', 'AI verification')
  .option('--full', 'Deep scan')
  .option('-o, --output <fmt>', 'terminal/json/html', 'terminal')
  .option('-s, --severity <lvl>', 'info/low/medium/high/critical', 'info')
  .option('-i, --ignore <paths>', 'Ignore paths')
  .option('--max-files <n>', 'Max files', '1000')
  .option('--api-key <key>', 'API key')
  .action(async (scanPath: string, options: any) => {
    setupInterruptHandler()
    
    const severity = options.severity as Severity
    const ignore = options.ignore ? options.ignore.split(',') : []
    const apiKey = await getApiKey(options)
    
    if ((options.ai || options.full) && !apiKey) {
      console.error(neonText('✗ API key required', 'red'))
      process.exit(1)
    }

    console.log('')
    console.log(neonText('⚡ VULNIX v1.4.1', 'magenta'))
    console.log(neonText('═'.repeat(30), 'cyan'))

    const scanner = new Scanner({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles: parseInt(options.maxFiles) || 1000, apiKey })
    scanner.registerDetector(new SecretsDetector())
    scanner.registerDetector(new InjectionDetector())
    scanner.registerDetector(new XSSDetector())
    scanner.registerDetector(new AuthDetector())
    scanner.registerDetector(new CryptoDetector())
    scanner.registerDetector(new FilesystemDetector())
    scanner.registerDetector(new NetworkDetector())
    scanner.registerDetector(new PerformanceDetector())
    scanner.registerDetector(new ErrorHandlingDetector())
    scanner.registerDetector(new AIDetector())
    scanner.registerDetector(new BackdoorDetector())

    const spinner = new Spinner(`Scanning ${scanPath}...`)
    spinner.start()
    const fileContents = new Map<string, string>()
    let result = await scanner.scan({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles: parseInt(options.maxFiles) || 1000, apiKey }, fileContents)
    spinner.stop('Static scan done')

    if (options.ai && apiKey) {
      result = await runAI(result, fileContents, apiKey, options)
    }

    if (options.output === 'json') reportJSON(result)
    else if (options.output === 'html') reportHTML(result)
    else reportTerminal(result)

    process.exit(result.findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 1 : 0)
  })

async function runAI(result: ScanResult, fileContents: Map<string, string>, apiKey: string | undefined, options: any): Promise<ScanResult> {
  if (!apiKey) return result
  abortController = new AbortController()

  if (options.ai) {
    aiDisplay = new AIProgressDisplay()
    aiDisplay.start('verifying', result.findings.length)

    const initialCount = result.findings.length
    result.findings = await verifyFindings(result.findings, fileContents, apiKey, 
      (p) => aiDisplay?.updateProgress(p.current),
      undefined,
      abortController.signal
    )

    const confirmed = result.findings.filter(f => f.aiStatus === 'confirmed').length
    const dismissed = initialCount - result.findings.length
    
    for (let i = 0; i < confirmed; i++) aiDisplay?.addResult(true)
    for (let i = 0; i < dismissed; i++) aiDisplay?.addResult(false)
    aiDisplay.stop()

    result.confirmedCount = confirmed
    result.dismissedCount = dismissed
    result.aiVerified = true
  }

  if (options.full) {
    const files = Array.from(fileContents.entries()).map(([p, c]) => ({ path: p, content: c }))
    aiDisplay = new AIProgressDisplay()
    aiDisplay.start('deepscan', files.length)

    const aiFindings = await deepScan(files, apiKey, 
      (p) => aiDisplay?.updateProgress(p.currentFile),
      undefined,
      abortController.signal
    )
    
    aiDisplay.addFound(aiFindings.length)
    aiDisplay.stop()

    result.findings.push(...aiFindings)
    result.newFromAI = aiFindings.length
    result.confirmedCount += aiFindings.length
  }

  abortController = null
  aiDisplay = null
  return result
}

program.command('init').action(() => {
  fs.writeFileSync('.vulnixrc', JSON.stringify({ ignore: ['node_modules'], severity: 'low' }, null, 2))
  console.log(neonText('✓ Config created', 'green'))
})

program.command('config')
  .option('--set-key <key>', 'Set API key')
  .option('--show-key', 'Show key')
  .option('--clear-key', 'Clear key')
  .action((options) => {
    if (options.setKey) { configManager.setApiKey(options.setKey); console.log(neonText('✓ Saved', 'green')) }
    else if (options.showKey) { const k = configManager.getApiKey(); console.log(k ? `${k.slice(0,7)}...${k.slice(-4)}` : 'None') }
    else if (options.clearKey) { configManager.setApiKey(''); console.log(neonText('✓ Cleared', 'green')) }
  })

program.parse()
