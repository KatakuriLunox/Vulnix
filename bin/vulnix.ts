#!/usr/bin/env node

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
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
import { Spinner, neonText, gradientBar } from '../src/reporter/spinner'

const program = new Command()

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

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
    console.log(neonText('  🔐 VULNIX AI SECURITY SYSTEM ', 'magenta') + neonText('v1.1.0', 'cyan'))
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log('')
    console.log(neonText('  ⚡ First time activation detected!', 'yellow'))
    console.log('')
    console.log('  📡 Connecting to Mistral AI...')
    console.log('  🌐 Endpoint: https://console.mistral.ai/')
    console.log('')
    console.log(neonText('  Enter your Mistral API key to unlock AI features:', 'cyan'))
    console.log('')
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    return new Promise((resolve) => {
      readline.question('  > ', (answer: string) => {
        readline.close()
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
  .description('CLI security scanner for AI-generated and vibe-coded projects')
  .version('1.1.0')

program
  .command('scan')
  .description('Scan a project for vulnerabilities')
  .argument('<path>', 'Path to scan')
  .option('--ai', 'Use AI to verify findings')
  .option('--full', 'AI deep scan (requires --ai)')
  .option('-o, --output <format>', 'Output format: terminal, json, html', 'terminal')
  .option('-s, --severity <level>', 'Minimum severity: critical, high, medium, low, info', 'info')
  .option('-i, --ignore <paths>', 'Comma-separated paths to ignore')
  .option('--max-files <number>', 'Maximum files to scan', '1000')
  .option('--api-key <key>', 'Mistral API key for AI verification (or set MISTRAL_API_KEY env)')
  .action(async (scanPath: string, options: any) => {
    const severity = options.severity as Severity
    const ignore = options.ignore ? options.ignore.split(',') : []
    const maxFiles = parseInt(options.maxFiles) || 1000
    
    const apiKey = await getApiKey(options)
    
    if ((options.ai || options.full) && !apiKey) {
      console.error(neonText('✗ API key required for AI features', 'red'))
      console.error('  Set MISTRAL_API_KEY env variable or use --api-key flag')
      process.exit(1)
    }

    console.log('')
    console.log(neonText('═'.repeat(50), 'cyan'))
    console.log(neonText('  ⚡ VULNIX SECURITY SCANNER ', 'magenta') + neonText('v1.1.0', 'cyan'))
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
    let result = await scanner.scan({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles, apiKey }, fileContents)

    scanSpinner.stop('Scan complete')

    if (options.ai && apiKey) {
      const verifySpinner = new Spinner('Initializing neural network...')
      verifySpinner.start()
      
      const initialCount = result.findings.length
      
      await new Promise(r => setTimeout(r, 500))
      verifySpinner.stop('Neural network online')
      
      console.log(neonText('  ◈ Verifying findings with DevStral AI...', 'magenta'))
      
      const verify2Spinner = new Spinner('Analyzing code patterns...')
      verify2Spinner.start()
      
      result.findings = await verifyFindings(result.findings, fileContents, apiKey)
      
      verify2Spinner.stop('Analysis complete')
      
      result.confirmedCount = result.findings.filter(f => f.aiStatus === 'confirmed').length
      result.dismissedCount = initialCount - result.findings.length
      result.aiVerified = true

      if (options.full) {
        console.log('')
        const deepSpinner = new Spinner('Initiating deep scan protocol...')
        deepSpinner.start()
        
        const files = Array.from(fileContents.entries()).map(([path, content]) => ({ path, content }))
        const aiFindings = await deepScan(files, apiKey)
        
        deepSpinner.stop('Deep scan complete')
        
        result.findings.push(...aiFindings)
        result.newFromAI = aiFindings.length
        result.confirmedCount += aiFindings.length
      }
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

program
  .command('init')
  .description('Generate .vulnixrc config file')
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
  .description('Manage vulnix configuration')
  .option('--set-key <key>', 'Set Mistral API key')
  .option('--show-key', 'Show saved API key (masked)')
  .option('--clear-key', 'Clear saved API key')
  .action((options) => {
    console.log('')
    console.log(neonText('═'.repeat(40), 'cyan'))
    console.log(neonText('  ⚡ VULNIX CONFIG', 'magenta'))
    console.log(neonText('═'.repeat(40), 'cyan'))
    console.log('')
    
    if (options.setKey) {
      configManager.setApiKey(options.setKey)
      console.log(neonText('  ✓ API key encrypted & stored', 'green'))
    } else if (options.showKey) {
      const key = configManager.getApiKey()
      if (key) {
        console.log(neonText(`  Key: ${key.substring(0, 7)}...${key.substring(key.length - 4)}`, 'cyan'))
      } else {
        console.log(neonText('  No API key configured', 'yellow'))
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
