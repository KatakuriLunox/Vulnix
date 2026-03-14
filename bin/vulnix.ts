#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
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
import { configManager } from '../src/config'
import { Spinner, neonText } from '../src/reporter/spinner'
import { AIAgentDisplay, generateComprehensiveReport } from '../src/reporter/agent'

const program = new Command()
let abortController: AbortController | null = null

function setupInterruptHandler(): void {
  process.on('SIGINT', () => {
    if (abortController) {
      abortController.abort()
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
    console.log(neonText('🔐 VULNIX AI AGENT', 'magenta'))
    console.log(neonText('═'.repeat(25), 'cyan'))
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

program.name('vulnix').description('AI Security Agent').version('1.6.1')

program.command('scan')
  .description('Scan for vulnerabilities')
  .argument('[path]', 'Path to scan (default: current directory)', process.cwd())
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
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log(neonText('    🤖 VULNIX AI SECURITY AGENT v1.6.1', 'magenta'))
    console.log(neonText('═'.repeat(50), 'cyan'))

    const agent = new AIAgentDisplay()
    agent.start('Initializing')
    agent.think('searching', `Initializing scan on ${scanPath}...`)

    try {
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

    const spinner = new Spinner('Analyzing codebase...')
    spinner.start()

    const fileContents = new Map<string, string>()
    const totalStart = Date.now()
    let result = await scanner.scan({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles: parseInt(options.maxFiles) || 1000, apiKey }, fileContents)
    const scanTime = (Date.now() - totalStart) / 1000

    spinner.stop(`Found ${result.findings.length} issues`)
    agent.think('found', `Static analysis: ${result.findings.length} potential issues found in ${result.filesScanned} files`)

    if (options.ai && apiKey) {
      agent.think('analyzing', 'Starting AI verification...')
      const aiStart = Date.now()
      
      result = await runAI(result, fileContents, apiKey, options, agent)
      
      const aiTime = (Date.now() - aiStart) / 1000
      agent.think('concluding', `AI analysis complete in ${aiTime.toFixed(1)}s`)

      const totalTime = (Date.now() - totalStart) / 1000

      if (options.output === 'json' || options.output === 'html') {
        if (options.output === 'json') {
          console.log(JSON.stringify(result, null, 2))
        }
      } else {
        generateComprehensiveReport(
          result.findings,
          result.confirmedCount,
          result.dismissedCount,
          result.filesScanned,
          scanTime,
          totalTime - scanTime
        )
      }
    } else {
      const totalTime = (Date.now() - totalStart) / 1000
      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else if (options.output === 'html') {
        console.log('HTML output not implemented in agent mode')
      } else {
        generateComprehensiveReport(result.findings, 0, 0, result.filesScanned, scanTime, 0)
      }
    }

    process.exit(result.findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 1 : 0)
    } catch (error) {
      console.error('')
      console.error(neonText('✗ Error: ' + (error instanceof Error ? error.message : 'Unknown error'), 'red'))
      process.exit(1)
    }
  })

async function runAI(result: ScanResult, fileContents: Map<string, string>, apiKey: string | undefined, options: any, agent: AIAgentDisplay): Promise<ScanResult> {
  if (!apiKey) return result
  abortController = new AbortController()

  if (options.ai) {
    agent.think('analyzing', `Verifying ${result.findings.length} findings with AI...`)

    const initialCount = result.findings.length
    result.findings = await verifyFindings(result.findings, fileContents, apiKey, 
      (thought) => agent.think('analyzing', thought),
      abortController.signal
    )

    const confirmed = result.findings.filter(f => f.aiStatus === 'confirmed').length
    const dismissed = initialCount - result.findings.length
    
    agent.think('found', `Confirmed ${confirmed} real vulnerabilities`)
    agent.think('ignored', `Dismissed ${dismissed} false positives`)

    result.confirmedCount = confirmed
    result.dismissedCount = dismissed
    result.aiVerified = true
  }

  if (options.full) {
    const files = Array.from(fileContents.entries()).map(([p, c]) => ({ path: p, content: c }))
    agent.think('searching', `Deep scanning ${files.length} files for advanced vulnerabilities...`)

    const aiFindings = await deepScan(files, apiKey, 
      (thought) => agent.think('searching', thought),
      abortController.signal
    )
    
    agent.think('found', `AI discovered ${aiFindings.length} additional issues`)

    result.findings.push(...aiFindings)
    result.newFromAI = aiFindings.length
    result.confirmedCount += aiFindings.length
  }

  abortController = null
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
