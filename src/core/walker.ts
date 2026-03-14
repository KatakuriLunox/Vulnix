import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import ignore from 'ignore'
import { FileInfo, EXTENSION_TO_LANGUAGE, DEFAULT_EXCLUDES } from '../types'

export class Walker {
  private ig = ignore()
  private fileExtensions = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java',
    '.c', '.cpp', '.cs', '.php', '.rs', '.swift', '.kt', '.scala',
    '.sh', '.bash', '.zsh', '.sql', '.html', '.htm', '.css', '.scss',
    '.less', '.vue', '.svelte', '.json', '.yaml', '.yml', '.xml'
  ])

  constructor(excludes: string[] = []) {
    this.ig.add(DEFAULT_EXCLUDES)
    this.ig.add(excludes)
  }

  async walk(targetPath: string, maxFiles?: number): Promise<FileInfo[]> {
    const files: FileInfo[] = []
    const absolutePath = path.resolve(targetPath)
    
    const stats = fs.statSync(absolutePath)
    
    if (stats.isFile()) {
      const fileInfo = this.createFileInfo(absolutePath, targetPath)
      if (fileInfo) files.push(fileInfo)
    } else if (stats.isDirectory()) {
      const pattern = path.join(absolutePath, '**', '*').replace(/\\/g, '/')
      const allFiles = await glob(pattern, {
        nodir: true,
        dot: false,
        follow: false
      })

      for (const filePath of allFiles) {
        if (maxFiles && files.length >= maxFiles) break
        
        const relativePath = path.relative(absolutePath, filePath).replace(/\\/g, '/')
        
        if (this.ig.ignores(relativePath)) continue
        
        const ext = path.extname(filePath).toLowerCase()
        if (!this.fileExtensions.has(ext)) continue
        
        const fileInfo = this.createFileInfo(filePath, absolutePath)
        if (fileInfo) files.push(fileInfo)
      }
    }

    return files
  }

  private createFileInfo(filePath: string, basePath: string): FileInfo | null {
    try {
      const stats = fs.statSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      
      if (!this.fileExtensions.has(ext)) return null
      
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').length

      return {
        path: filePath,
        relativePath: path.relative(basePath, filePath).replace(/\\/g, '/'),
        extension: ext,
        language: EXTENSION_TO_LANGUAGE[ext] || 'unknown',
        size: stats.size,
        lines
      }
    } catch {
      return null
    }
  }
}
