/**
 * User Agent Parser for NextRush v2
 *
 * Parses and extracts information from User-Agent headers.
 *
 * @packageDocumentation
 */

/**
 * Parsed user agent information
 */
export interface UserAgentInfo {
  raw: string;
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
  isBot: boolean;
}

// Pre-compiled regex patterns for better performance
const BOT_PATTERN = /bot|crawler|spider|crawling/i;
const MOBILE_PATTERN = /Mobile|Android|iPhone|iPad|iPhone OS/;
const TABLET_PATTERN = /Tablet|iPad/;

/**
 * Parse browser name from user agent string
 *
 * @param ua - User agent string
 * @returns Browser name or 'Unknown'
 */
export function parseBrowser(ua: string): string {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edge') || ua.includes('Edg')) return 'Edge';
  if (ua.includes('AppleWebKit')) return 'Chrome'; // Fallback for Chrome-based
  return 'Unknown';
}

/**
 * Parse operating system from user agent string
 *
 * @param ua - User agent string
 * @returns OS name or 'Unknown'
 */
export function parseOS(ua: string): string {
  // Check iOS/iPhone first (before Mac, since iPhone UA includes "like Mac OS X")
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    return 'iOS';
  }
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Parse device type from user agent string
 *
 * @param ua - User agent string
 * @returns Device type: 'Desktop', 'Mobile', or 'Tablet'
 */
export function parseDevice(ua: string): string {
  if (TABLET_PATTERN.test(ua)) return 'Tablet';
  if (MOBILE_PATTERN.test(ua)) return 'Mobile';
  return 'Desktop';
}

/**
 * Check if user agent indicates a bot/crawler
 *
 * @param ua - User agent string
 * @returns true if bot detected
 */
export function isBot(ua: string): boolean {
  return BOT_PATTERN.test(ua);
}

/**
 * Check if user agent indicates a mobile device
 *
 * @param ua - User agent string
 * @returns true if mobile device detected
 */
export function isMobile(ua: string): boolean {
  return MOBILE_PATTERN.test(ua);
}

/**
 * Parse complete user agent information
 *
 * @param ua - User agent string
 * @returns Complete user agent info object
 *
 * @example
 * ```typescript
 * const uaInfo = parseUserAgent(req.headers['user-agent']);
 * console.log(uaInfo.browser); // 'Chrome'
 * console.log(uaInfo.isMobile); // false
 * ```
 */
export function parseUserAgent(ua: string = ''): UserAgentInfo {
  return {
    raw: ua,
    browser: parseBrowser(ua),
    os: parseOS(ua),
    device: parseDevice(ua),
    isMobile: isMobile(ua),
    isBot: isBot(ua),
  };
}
