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

const program = new Command()

program
  .name('vulnix')
  .description('CLI security scanner for AI-generated and vibe-coded projects')
  .version('1.0.0')

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
  .option('--api-key <key>', 'Mistral API key for AI verification')
  .action(async (scanPath: string, options: any) => {
    const severity = options.severity as Severity
    const ignore = options.ignore ? options.ignore.split(',') : []
    const maxFiles = parseInt(options.maxFiles) || 1000
    
    const apiKey = options.apiKey || process.env.MISTRAL_API_KEY
    
    if ((options.ai || options.full) && !apiKey) {
      console.error('Error: --api-key required or set MISTRAL_API_KEY environment variable')
      process.exit(1)
    }

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

    console.log(`Scanning ${scanPath}...`)

    const fileContents = new Map<string, string>()
    let result = await scanner.scan({ path: scanPath, ai: options.ai, full: options.full, output: options.output, severity, ignore, maxFiles, apiKey }, fileContents)

    if (options.ai && apiKey) {
      console.log('Verifying findings with AI...')
      
      const initialCount = result.findings.length
      
      result.findings = await verifyFindings(result.findings, fileContents, apiKey)
      
      result.confirmedCount = result.findings.filter(f => f.aiStatus === 'confirmed').length
      result.dismissedCount = initialCount - result.findings.length
      result.aiVerified = true

      if (options.full) {
        console.log('Running deep scan...')
        
        const files = Array.from(fileContents.entries()).map(([path, content]) => ({ path, content }))
        const aiFindings = await deepScan(files, apiKey)
        
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
    const config = {
      ignore: ['node_modules', '.git', 'dist', 'generated'],
      severity: 'low',
      maxFiles: 1000
    }
    
    fs.writeFileSync('.vulnixrc', JSON.stringify(config, null, 2))
    console.log('Created .vulnixrc configuration file')
  })

program.parse()
