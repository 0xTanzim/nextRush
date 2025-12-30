/**
 * @nextrush/dev - CLI Logger Utilities
 *
 * Pretty terminal output for the NextRush CLI.
 *
 * @packageDocumentation
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

/**
 * Format a timestamp for logs
 */
function getTimestamp(): string {
  return new Date().toLocaleTimeString();
}

/**
 * Log an info message
 */
export function log(message: string): void {
  const time = getTimestamp();
  console.log(
    `${colors.gray}[${time}]${colors.reset} ${colors.cyan}[nextrush]${colors.reset} ${message}`,
  );
}

/**
 * Log a success message
 */
export function success(message: string): void {
  const time = getTimestamp();
  console.log(
    `${colors.gray}[${time}]${colors.reset} ${colors.green}✓${colors.reset} ${message}`,
  );
}

/**
 * Log a warning message
 */
export function warn(message: string): void {
  const time = getTimestamp();
  console.warn(
    `${colors.gray}[${time}]${colors.reset} ${colors.yellow}⚠${colors.reset} ${message}`,
  );
}

/**
 * Log an error message
 */
export function error(message: string): void {
  const time = getTimestamp();
  console.error(
    `${colors.gray}[${time}]${colors.reset} ${colors.red}✗${colors.reset} ${message}`,
  );
}

/**
 * Log a debug message (only in verbose mode)
 */
export function debug(message: string, verbose = false): void {
  if (!verbose) return;

  const time = getTimestamp();
  console.log(
    `${colors.gray}[${time}] [debug]${colors.reset} ${colors.dim}${message}${colors.reset}`,
  );
}

/**
 * Print the NextRush banner
 */
export function banner(title: string): void {
  console.log(`\n${colors.cyan}⚡ NextRush ${title}${colors.reset}\n`);
}

/**
 * Print a section header
 */
export function section(title: string): void {
  console.log(`\n${colors.bold}${title}${colors.reset}\n`);
}

/**
 * Print a key-value pair
 */
export function info(key: string, value: string): void {
  console.log(`  ${colors.dim}${key}:${colors.reset} ${value}`);
}

/**
 * Print a blank line
 */
export function newline(): void {
  console.log();
}

/**
 * Clear the console
 */
export function clear(): void {
  console.clear();
}

/**
 * Create a spinner (simple text-based for cross-runtime compatibility)
 */
export function spinner(message: string): {
  stop: (finalMessage?: string) => void;
  update: (newMessage: string) => void;
} {
  let current = message;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  let running = true;

  const interval = setInterval(() => {
    if (!running) return;
    process.stdout.write(`\r${colors.cyan}${frames[frameIndex]}${colors.reset} ${current}`);
    frameIndex = (frameIndex + 1) % frames.length;
  }, 80);

  return {
    stop: (finalMessage?: string) => {
      running = false;
      clearInterval(interval);
      process.stdout.write(`\r${colors.green}✓${colors.reset} ${finalMessage ?? current}\n`);
    },
    update: (newMessage: string) => {
      current = newMessage;
    },
  };
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
