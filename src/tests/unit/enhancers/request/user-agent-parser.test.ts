/**
 * User Agent Parser Unit Tests
 */

import {
    isBot,
    isMobile,
    parseBrowser,
    parseDevice,
    parseOS,
    parseUserAgent,
} from '@/core/enhancers/request/user-agent-parser';
import { describe, expect, it } from 'vitest';

describe('User Agent Parser', () => {
  describe('parseBrowser', () => {
    it('should detect Chrome', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseBrowser(ua)).toBe('Chrome');
    });

    it('should detect Firefox', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
      expect(parseBrowser(ua)).toBe('Firefox');
    });

    it('should detect Safari', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
      expect(parseBrowser(ua)).toBe('Safari');
    });

    it('should detect Edge', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseBrowser(ua)).toBe('Edge');
    });

    it('should return Unknown for unrecognized browsers', () => {
      expect(parseBrowser('')).toBe('Unknown');
      expect(parseBrowser('CustomBrowser/1.0')).toBe('Unknown');
    });
  });

  describe('parseOS', () => {
    it('should detect Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(parseOS(ua)).toBe('Windows');
    });

    it('should detect macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1)';
      expect(parseOS(ua)).toBe('macOS');
    });

    it('should detect Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
      expect(parseOS(ua)).toBe('Linux');
    });

    it('should detect Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36';
      expect(parseOS(ua)).toBe('Android');
    });

    it('should detect iOS', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)';
      expect(parseOS(ua)).toBe('iOS');
    });

    it('should return Unknown for unrecognized OS', () => {
      expect(parseOS('')).toBe('Unknown');
    });
  });

  describe('parseDevice', () => {
    it('should detect Desktop', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(parseDevice(ua)).toBe('Desktop');
    });

    it('should detect Mobile', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Mobile';
      expect(parseDevice(ua)).toBe('Mobile');
    });

    it('should detect Tablet', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15';
      expect(parseDevice(ua)).toBe('Tablet');
    });
  });

  describe('isBot', () => {
    it('should detect Googlebot', () => {
      const ua =
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      expect(isBot(ua)).toBe(true);
    });

    it('should detect crawlers', () => {
      const ua = 'Mozilla/5.0 (compatible; crawler/1.0)';
      expect(isBot(ua)).toBe(true);
    });

    it('should not flag regular browsers', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';
      expect(isBot(ua)).toBe(false);
    });
  });

  describe('isMobile', () => {
    it('should detect Mobile keyword', () => {
      const ua = 'Mozilla/5.0 Mobile Safari/605.1.15';
      expect(isMobile(ua)).toBe(true);
    });

    it('should detect Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14)';
      expect(isMobile(ua)).toBe(true);
    });

    it('should detect iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1)';
      expect(isMobile(ua)).toBe(true);
    });

    it('should not flag desktop browsers', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      expect(isMobile(ua)).toBe(false);
    });
  });

  describe('parseUserAgent', () => {
    it('should parse complete user agent info', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const info = parseUserAgent(ua);

      expect(info.raw).toBe(ua);
      expect(info.browser).toBe('Chrome');
      expect(info.os).toBe('Windows');
      expect(info.device).toBe('Desktop');
      expect(info.isMobile).toBe(false);
      expect(info.isBot).toBe(false);
    });

    it('should handle empty user agent', () => {
      const info = parseUserAgent('');

      expect(info.raw).toBe('');
      expect(info.browser).toBe('Unknown');
      expect(info.os).toBe('Unknown');
      expect(info.device).toBe('Desktop');
      expect(info.isMobile).toBe(false);
      expect(info.isBot).toBe(false);
    });

    it('should handle undefined user agent', () => {
      const info = parseUserAgent();

      expect(info.raw).toBe('');
    });
  });
});
