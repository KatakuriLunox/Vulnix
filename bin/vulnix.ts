#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { Scanner } from '../src/core/scanner'
import { ScanOptions, ScanResult, Severity } from '../src/types'
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
      if (aiDisplay) {
        aiDisplay.abort()
      }
      console.log(neonText('\n\n  ⚠️  Interrupting scan...', 'yellow'))
      setTimeout(() => {
        console.log(neonText('  Scan aborted by user', 'red'))
        process.exit(130)
      }, 500)
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
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log(neonText('  🔐 VULNIX AI ACTIVATION', 'magenta'))
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log('')
    console.log(neonText('  Enter your Mistral API key:', 'cyan'))
    console.log('  https://console.mistral.ai/\n')
    
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise((resolve) => {
      rl.question('  > ', (answer: string) => {
        rl.close()
        const key = answer.trim()
        if (key) {
          configManager.setApiKey(key)
          console.log(neonText('  ✓ API key saved!\n', 'green'))
        }
        resolve(key || undefined)
      })
    })
  }
  return undefined
}

program
  .name('vulnix')
  .description('AI-powered security scanner')
  .version('1.4.0')

program
  .command('scan')
  .description('Scan for vulnerabilities')
  .argument('<path>', 'Path to scan')
  .option('--ai', 'AI verification')
  .option('--full', 'Deep scan')
  .option('-o, --output <fmt>', 'Output: terminal, json, html', 'terminal')
  .option('-s, --severity <level>', 'Min severity', 'info')
  .option('-i, --ignore <paths>', 'Ignore paths')
  .option('--max-files <n>', 'Max files', '1000')
  .option('--api-key <key>', 'API key')
  .action(async (scanPath: string, options: any) => {
    setupInterruptHandler()
    
    const severity = options.severity as Severity
    const ignore = options.ignore ? options.ignore.split(',') : []
    const maxFiles = parseInt(options.maxFiles) || 1000
    
    const apiKey = await getApiKey(options)
    
    if ((options.ai || options.full) && !apiKey) {
      console.error(neonText('✗ API key required', 'red'))
      process.exit(1)
    }

    console.log('')
    console.log(neonText('⚡ VULNIX v1.4.0', 'magenta'))
    console.log(neonText('═'.repeat(40), 'cyan'))
    console.log('')

    const scanner = new Scanner({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles, apiKey })

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

    const scanSpinner = new Spinner(`Scanning ${scanPath}...`)
    scanSpinner.start()

    const fileContents = new Map<string, string>()
    let result = await scanner.scan({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles, apiKey }, fileContents)

    scanSpinner.stop('Static scan done')

    if (options.ai && apiKey) {
      result = await runAIAnalysis(result, fileContents, apiKey, options)
    }

    if (options.output === 'json') {
      reportJSON(result)
    } else if (options.output === 'html') {
      reportHTML(result)
    } else {
      reportTerminal(result)
    }

    const hasIssues = result.findings.some(f => f.severity === 'critical' || f.severity === 'high')
    process.exit(hasIssues ? 1 : 0)
  })

async function runAIAnalysis(
  result: ScanResult, 
  fileContents: Map<string, string>, 
  apiKey: string | undefined,
  options: any
): Promise<ScanResult> {
  if (!apiKey) return result

  abortController = new AbortController()
  console.log('')

  if (options.ai) {
    aiDisplay = new AIProgressDisplay()
    aiDisplay.start('verifying', result.findings.length)

    const onProgress = (progress: any) => {
      aiDisplay?.update({ current: progress.current, total: progress.total })
    }

    const initialCount = result.findings.length
    
    result.findings = await verifyFindings(
      result.findings, 
      fileContents, 
      apiKey,
      onProgress,
      undefined,
      abortController.signal
    )

    const confirmed = result.findings.filter(f => f.aiStatus === 'confirmed').length
    const dismissed = initialCount - result.findings.length

    aiDisplay.update({ confirmed, dismissed, current: result.findings.length, total: result.findings.length })
    aiDisplay.stop()

    result.confirmedCount = confirmed
    result.dismissedCount = dismissed
    result.aiVerified = true
    console.log('')
  }

  if (options.full && apiKey) {
    const files = Array.from(fileContents.entries()).map(([p, c]) => ({ path: p, content: c }))
    
    aiDisplay = new AIProgressDisplay()
    aiDisplay.start('deepscan', files.length)

    const onProgress = (progress: any) => {
      aiDisplay?.update({ current: progress.currentFile, total: progress.totalFiles })
    }

    const aiFindings = await deepScan(files, apiKey, onProgress, undefined, abortController.signal)
    
    aiDisplay.update({ 
      findingsFound: aiFindings.length, 
      confirmed: result.confirmedCount + aiFindings.length,
      current: files.length, 
      total: files.length 
    })
    aiDisplay.stop()

    result.findings.push(...aiFindings)
    result.newFromAI = aiFindings.length
    result.confirmedCount += aiFindings.length
    console.log('')
  }

  abortController = null
  aiDisplay = null
  return result
}

program
  .command('init')
  .description('Generate config')
  .action(() => {
    fs.writeFileSync('.vulnixrc', JSON.stringify({ ignore: ['node_modules'], severity: 'low' }, null, 2))
    console.log(neonText('  ✓ Config created', 'green'))
  })

program
  .command('config')
  .description('Manage config')
  .option('--set-key <key>', 'Set API key')
  .option('--show-key', 'Show key')
  .option('--clear-key', 'Clear key')
  .action((options) => {
    if (options.setKey) {
      configManager.setApiKey(options.setKey)
      console.log(neonText('  ✓ Key saved', 'green'))
    } else if (options.showKey) {
      const key = configManager.getApiKey()
      console.log(key ? `  ${key.substring(0, 7)}...${key.slice(-4)}` : '  No key')
    } else if (options.clearKey) {
      configManager.setApiKey('')
      console.log(neonText('  ✓ Key cleared', 'green'))
    }
  })

program.parse()
