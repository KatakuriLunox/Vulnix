const FRAMES = [
  '▁▂▃▄▅▆▇█▇▆▅▄▃▁',
  '▔▏▎▍▌▋▊▉▊▋▌▍▎▏',
  '┤┘┴┌├┐┌┤┘┴┬┤┘',
  '░▒▓█░▒▓█░▒▓█',
  '◐◑◒◓◔◕◖◗◘◙',
  '◇◆□■◇◆□■◇◆',
  '◉○◉○◉○◉○◉',
  '▣▤▥▦▧▨▩▪▫▬',
  '█▓▒░█▓▒░█▓▒░',
  '⌬⌤⌥⌦⌧⌨〈〉⌫'
]

const COLORS = [
  '\x1b[36m', // cyan
  '\x1b[35m', // magenta
  '\x1b[34m', // blue
  '\x1b[33m', // yellow
]

export class Spinner {
  private frame = 0
  private colorIndex = 0
  private interval: NodeJS.Timeout | null = null
  private message: string

  constructor(message: string) {
    this.message = message
  }

  start(): void {
    const frames = process.stdout.isTTY ? FRAMES : ['●', '○', '◐', '◑']
    this.interval = setInterval(() => {
      const frame = frames[this.frame % frames.length]
      const color = process.stdout.isTTY ? COLORS[this.colorIndex % COLORS.length] : ''
      const reset = '\x1b[0m'
      process.stdout.write(`\r${color}${frame} ${this.message}${reset}`)
      this.frame++
      if (this.frame % 4 === 0) this.colorIndex++
    }, 80)
  }

  stop(text?: string): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    const color = '\x1b[32m'
    const reset = '\x1b[0m'
    const check = '✓'
    process.stdout.write(`\r${color}${check}${reset} ${text || this.message}\n`)
  }

  stopError(text?: string): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    const color = '\x1b[31m'
    const reset = '\x1b[0m'
    const cross = '✗'
    process.stdout.write(`\r${color}${cross}${reset} ${text || this.message}\n`)
  }
}

export function neonText(text: string, color: string = 'cyan'): string {
  const colors: Record<string, string> = {
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
  }
  const c = colors[color] || colors.cyan
  return `${c}${text}\x1b[0m`
}

export function gradientBar(width: number = 30): string {
  const gradient = '█▓▒░▒▓'
  let bar = ''
  for (let i = 0; i < width; i++) {
    bar += gradient[i % gradient.length]
  }
  return `\x1b[36m${bar}\x1b[0m`
}
