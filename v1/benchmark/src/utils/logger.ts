/**
 * 🎨 Console Logger Utilities
 *
 * Beautiful terminal output with colors and formatting
 */

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
} as const;

/**
 * Formatted logger with icons and colors
 */
export const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) =>
    console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg: string) =>
    console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg: string) =>
    console.log(`${colors.cyan}${colors.bright}🚀 ${msg}${colors.reset}`),
  subheader: (msg: string) =>
    console.log(`${colors.magenta}${colors.bright}📊 ${msg}${colors.reset}`),
  benchmark: (msg: string) =>
    console.log(`${colors.yellow}⚡${colors.reset} ${msg}`),
  debug: (msg: string) => console.log(`${colors.dim}🔍 ${msg}${colors.reset}`),
};

/**
 * Progress bar for long-running operations
 */
export class ProgressBar {
  private current = 0;
  private total: number;
  private label: string;

  constructor(total: number, label: string = 'Progress') {
    this.total = total;
    this.label = label;
  }

  update(current: number): void {
    this.current = current;
    this.render();
  }

  increment(): void {
    this.current++;
    this.render();
  }

  private render(): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const barLength = 40;
    const filledLength = Math.round((barLength * this.current) / this.total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    process.stdout.write(
      `\r${colors.cyan}${this.label}${colors.reset} [${bar}] ${percentage}% (${this.current}/${this.total})`
    );

    if (this.current >= this.total) {
      console.log(); // New line when complete
    }
  }

  complete(): void {
    this.current = this.total;
    this.render();
  }
}

/**
 * Format numbers with proper units
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

/**
 * Format bytes with proper units
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${
    sizes[i]
  }`;
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Create a table with proper alignment
 */
export function createTable(headers: string[], rows: string[][]): void {
  // Calculate column widths
  const colWidths = headers.map((header, i) => {
    const maxRowWidth = Math.max(...rows.map((row) => (row[i] || '').length));
    return Math.max(header.length, maxRowWidth);
  });

  // Print header
  const headerRow = headers
    .map((header, i) => header.padEnd(colWidths[i]))
    .join(' | ');
  console.log(`${colors.bright}${headerRow}${colors.reset}`);
  console.log(colWidths.map((width) => '-'.repeat(width)).join('-+-'));

  // Print rows
  rows.forEach((row) => {
    const formattedRow = row
      .map((cell, i) => (cell || '').padEnd(colWidths[i]))
      .join(' | ');
    console.log(formattedRow);
  });
}

/**
 * Print system information in a nice format
 */
export function printSystemInfo(): void {
  import('os')
    .then((os) => {
      const cpus = os.cpus();

      console.log('\n🖥️  System Information:');
      console.log(`   Node.js Version: ${process.version}`);
      console.log(`   V8 Version: ${process.versions.v8}`);
      console.log(`   CPU: ${cpus[0].model} (${cpus.length} cores)`);
      console.log(
        `   Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
      );
      console.log(`   Platform: ${os.platform()} ${os.release()}`);
      console.log(`   Architecture: ${os.arch()}\n`);
    })
    .catch(() => {
      console.log('\n🖥️  System Information: Not available\n');
    });
}
