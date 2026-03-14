import * as fs from 'fs'
import { FileInfo, Finding, ScanOptions, ScanResult, Severity, SEVERITY_ORDER } from '../types'
import { Walker } from './walker'
import { Deduplicator } from './deduplicator'
import { Detector } from '../detectors/base'

export class Scanner {
  private walker: Walker
  private deduplicator: Deduplicator
  private detectors: Detector[] = []

  constructor(options: ScanOptions) {
    this.walker = new Walker(options.ignore)
    this.deduplicator = new Deduplicator()
  }

  registerDetector(detector: Detector): void {
    this.detectors.push(detector)
  }

  async scan(options: ScanOptions, fileContents: Map<string, string> = new Map()): Promise<ScanResult> {
    const startTime = Date.now()
    
    const files = await this.walker.walk(options.path, options.maxFiles)
    const findings: Finding[] = []

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8')
        fileContents.set(file.relativePath, content)

        for (const detector of this.detectors) {
          const detections = detector.scan(file, content)
          findings.push(...detections)
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    const deduplicated = this.deduplicator.deduplicate(findings)
    const filtered = this.filterBySeverity(deduplicated, options.severity)

    const scanTime = (Date.now() - startTime) / 1000

    return {
      findings: filtered,
      filesScanned: files.length,
      scanTime,
      aiVerified: false,
      staticCount: filtered.length,
      confirmedCount: 0,
      dismissedCount: 0,
      newFromAI: 0
    }
  }

  private filterBySeverity(findings: Finding[], minSeverity: Severity): Finding[] {
    const minIndex = SEVERITY_ORDER.indexOf(minSeverity)
    return findings.filter(f => SEVERITY_ORDER.indexOf(f.severity) <= minIndex)
  }
}
