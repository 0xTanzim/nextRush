/** Console logging helpers with ANSI styling. */

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

export function log(msg, style) {
  if (style === 'dim') {
    console.log(`${DIM}${msg}${RESET}`);
  } else {
    console.log(msg);
  }
}

export function logError(msg) {
  console.error(`${RED}✖ ERROR:${RESET} ${msg}`);
}

export function logWarn(msg) {
  console.warn(`${YELLOW}⚠ WARN:${RESET} ${msg}`);
}

export function logStep(msg) {
  console.log(`${CYAN}→${RESET} ${msg}`);
}

export function logResult(key, value, extra) {
  const pad = 20;
  const line = `  ${String(key).padEnd(pad)} ${value}`;
  console.log(extra ? `${line}  ${DIM}${extra}${RESET}` : line);
}

export function logHeader(title) {
  const width = 60;
  const border = '═'.repeat(width);
  console.log('');
  console.log(`${BOLD}${GREEN}╔${border}╗${RESET}`);
  console.log(`${BOLD}${GREEN}║${RESET} ${title.padEnd(width - 1)}${BOLD}${GREEN}║${RESET}`);
  console.log(`${BOLD}${GREEN}╚${border}╝${RESET}`);
  console.log('');
}
