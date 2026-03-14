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
  if (options.apiKey) {
    return options.apiKey
  }
  
  const envKey = process.env.MISTRAL_API_KEY
  if (envKey) {
    return envKey
  }
  
  const savedKey = configManager.getApiKey()
  if (savedKey) {
    return savedKey
  }
  
  if (options.ai || options.full) {
    console.log('')
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log(neonText('  🔐 VULNIX AI SECURITY SYSTEM ', 'magenta') + neonText('v1.2.0', 'cyan'))
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log('')
    console.log(neonText('  ⚡ First time activation detected!', 'yellow'))
    console.log('')
    console.log('  📡 Connecting to Mistral AI...')
    console.log('  🌐 Endpoint: https://console.mistral.ai/')
    console.log('')
    console.log(neonText('  Enter your Mistral API key to unlock AI features:', 'cyan'))
    console.log('')
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    return new Promise((resolve) => {
      rl.question('  > ', (answer: string) => {
        rl.close()
        const key = answer.trim()
        if (key) {
          configManager.setApiKey(key)
          console.log('')
          console.log(neonText('  ✓ API key secured & encrypted', 'green'))
          console.log(neonText('  ✓ System ready for neural scanning', 'green'))
        }
        console.log('')
        resolve(key || undefined)
      })
    })
  }
  
  return undefined
}

program
  .name('vulnix')
  .description('AI-powered security scanner with real-time analysis')
  .version('1.2.0')

program
  .command('scan')
  .description('Scan a project for vulnerabilities')
  .argument('<path>', 'Path to scan')
  .option('--ai', 'Use AI to verify findings')
  .option('--full', 'AI deep scan (requires --ai)')
  .option('-o, --output <format>', 'Output format: terminal, json, html', 'terminal')
  .option('-s, --severity <level>', 'Minimum severity', 'info')
  .option('-i, --ignore <paths>', 'Comma-separated paths to ignore')
  .option('--max-files <number>', 'Maximum files to scan', '1000')
  .option('--api-key <key>', 'Mistral API key')
  .action(async (scanPath: string, options: any) => {
    setupInterruptHandler()
    
    const severity = options.severity as Severity
    const ignore = options.ignore ? options.ignore.split(',') : []
    const maxFiles = parseInt(options.maxFiles) || 1000
    
    const apiKey = await getApiKey(options)
    
    if ((options.ai || options.full) && !apiKey) {
      console.error(neonText('✗ API key required for AI features', 'red'))
      console.error('  Set MISTRAL_API_KEY or use --api-key')
      process.exit(1)
    }

    console.log('')
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log(neonText('  ⚡ VULNIX SECURITY SCANNER ', 'magenta') + neonText('v1.2.0', 'cyan'))
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log('')

    const scanner = new Scanner({
      path: scanPath,
      ai: options.ai || false,
      full: options.full || false,
      output: options.output,
      severity,
      ignore,
      maxFiles,
      apiKey
    })

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
    let result = await scanner.scan({ 
      path: scanPath, 
      ai: options.ai, 
      full: options.full, 
      output: options.output, 
      severity, 
      ignore, 
      maxFiles, 
      apiKey 
    }, fileContents)

    scanSpinner.stop('Static analysis complete')

    if (options.output !== 'terminal') {
      result = await runAIAnalysis(result, fileContents, apiKey, options)
    } else if (options.ai && apiKey) {
      result = await runAIAnalysisWithDisplay(result, fileContents, apiKey, options)
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

  if (options.ai) {
    result.findings = await verifyFindings(result.findings, fileContents, apiKey)
    result.confirmedCount = result.findings.filter(f => f.aiStatus === 'confirmed').length
    result.dismissedCount = result.staticCount - result.findings.length
    result.aiVerified = true
  }

  if (options.full && apiKey) {
    const files = Array.from(fileContents.entries()).map(([path, content]) => ({ path, content }))
    const aiFindings = await deepScan(files, apiKey)
    result.findings.push(...aiFindings)
    result.newFromAI = aiFindings.length
    result.confirmedCount += aiFindings.length
  }

  return result
}

async function runAIAnalysisWithDisplay(
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

    const onThinking = (thought: string) => {
      aiDisplay?.addThought(thought)
    }

    const onProgress = (progress: any) => {
      aiDisplay?.update({
        current: progress.current,
        total: progress.total,
        currentFinding: progress.currentFinding
      })
    }

    const initialCount = result.findings.length
    
    result.findings = await verifyFindings(
      result.findings, 
      fileContents, 
      apiKey,
      onProgress,
      onThinking,
      abortController.signal
    )

    const confirmed = result.findings.filter(f => f.aiStatus === 'confirmed').length
    const dismissed = initialCount - result.findings.length

    aiDisplay.update({
      confirmed,
      dismissed,
      current: result.findings.length,
      total: result.findings.length
    })
    aiDisplay.stop()

    result.confirmedCount = confirmed
    result.dismissedCount = dismissed
    result.aiVerified = true

    console.log('')
  }

  if (options.full && apiKey) {
    const files = Array.from(fileContents.entries()).map(([path, content]) => ({ path, content }))
    
    aiDisplay = new AIProgressDisplay()
    aiDisplay.start('deepscan', files.length)

    const onThinking = (thought: string) => {
      aiDisplay?.addThought(thought)
    }

    const onProgress = (progress: any) => {
      aiDisplay?.update({
        current: progress.currentFile,
        total: progress.totalFiles,
        currentFile: progress.currentFileName
      })
    }

    const aiFindings = await deepScan(files, apiKey, onProgress, onThinking, abortController.signal)
    
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
  .description('Generate config file')
  .action(() => {
    console.log('')
    console.log(neonText('  ⚡ Initializing Vulnix config...', 'cyan'))
    const config = {
      ignore: ['node_modules', '.git', 'dist', 'generated'],
      severity: 'low',
      maxFiles: 1000
    }
    fs.writeFileSync('.vulnixrc', JSON.stringify(config, null, 2))
    console.log(neonText('  ✓ Config file generated', 'green'))
  })

program
  .command('config')
  .description('Manage configuration')
  .option('--set-key <key>', 'Set API key')
  .option('--show-key', 'Show API key')
  .option('--clear-key', 'Clear API key')
  .action((options) => {
    console.log('')
    console.log(neonText('═'.repeat(40), 'cyan'))
    console.log(neonText('  ⚡ VULNIX CONFIG', 'magenta'))
    console.log(neonText('═'.repeat(40), 'cyan'))
    console.log('')
    
    if (options.setKey) {
      configManager.setApiKey(options.setKey)
      console.log(neonText('  ✓ API key stored', 'green'))
    } else if (options.showKey) {
      const key = configManager.getApiKey()
      if (key) {
        console.log(neonText(`  Key: ${key.substring(0, 7)}...${key.substring(key.length - 4)}`, 'cyan'))
      } else {
        console.log(neonText('  No API key', 'yellow'))
      }
    } else if (options.clearKey) {
      configManager.setApiKey('')
      console.log(neonText('  ✓ API key cleared', 'green'))
    } else {
      console.log('  Options:')
      console.log('    --set-key <key>   Set API key')
      console.log('    --show-key        Show key')
      console.log('    --clear-key       Clear key')
    }
    console.log('')
  })

program.parse()
