import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface VulnixConfig {
  apiKey?: string
  hasAskedForKey?: boolean
}

const CONFIG_FILE = '.vulnixrc'

export class ConfigManager {
  private configPath: string

  constructor() {
    this.configPath = path.join(os.homedir(), CONFIG_FILE)
  }

  getConfig(): VulnixConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8')
        return JSON.parse(content)
      }
    } catch {
      // Ignore errors
    }
    return {}
  }

  saveConfig(config: VulnixConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
  }

  getApiKey(): string | undefined {
    return this.getConfig().apiKey
  }

  setApiKey(apiKey: string): void {
    if (!apiKey) {
      this.saveConfig({})
    } else {
      this.saveConfig({ apiKey, hasAskedForKey: true })
    }
  }

  hasApiKey(): boolean {
    return !!this.getApiKey()
  }
}

export const configManager = new ConfigManager()
