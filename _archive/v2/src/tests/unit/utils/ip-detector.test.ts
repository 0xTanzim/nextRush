/**
 * Tests for IP Detection Utility
 */

import { describe, expect, it } from 'vitest';
import {
  detectClientIP,
  detectClientIPDetailed,
  isLoopbackIP,
  isPrivateIP,
  isValidIP,
} from '../../../core/utils/ip-detector';

describe('IP Detector', () => {
  describe('detectClientIP', () => {
    it('should detect IP from X-Forwarded-For header', () => {
      const headers = { 'x-forwarded-for': '192.168.1.100, 10.0.0.1' };
      const ip = detectClientIP(headers);
      expect(ip).toBe('192.168.1.100');
    });

    it('should detect IP from X-Real-IP header', () => {
      const headers = { 'x-real-ip': '10.0.0.50' };
      const ip = detectClientIP(headers);
      expect(ip).toBe('10.0.0.50');
    });

    it('should prefer X-Forwarded-For over X-Real-IP', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.100',
        'x-real-ip': '10.0.0.50',
      };
      const ip = detectClientIP(headers);
      expect(ip).toBe('192.168.1.100');
    });

    it('should fall back to socket remote address', () => {
      const headers = {};
      const socket = { remoteAddress: '172.16.0.1' } as any;
      const ip = detectClientIP(headers, socket);
      expect(ip).toBe('172.16.0.1');
    });

    it('should handle IPv6 mapped IPv4 addresses', () => {
      const headers = {};
      const socket = { remoteAddress: '::ffff:192.168.1.1' } as any;
      const ip = detectClientIP(headers, socket);
      expect(ip).toBe('192.168.1.1');
    });

    it('should return default IP when no source available', () => {
      const ip = detectClientIP({}, null);
      expect(ip).toBe('127.0.0.1');
    });

    it('should ignore proxy headers when trustProxy is false', () => {
      const headers = { 'x-forwarded-for': '192.168.1.100' };
      const socket = { remoteAddress: '10.0.0.1' } as any;
      const ip = detectClientIP(headers, socket, { trustProxy: false });
      expect(ip).toBe('10.0.0.1');
    });

    it('should check custom header first', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.100',
        'cf-connecting-ip': '203.0.113.50',
      };
      const ip = detectClientIP(headers, null, {
        customHeader: 'CF-Connecting-IP',
      });
      expect(ip).toBe('203.0.113.50');
    });
  });

  describe('detectClientIPDetailed', () => {
    it('should return detailed result with forward chain', () => {
      const headers = { 'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1' };
      const result = detectClientIPDetailed(headers);

      expect(result.ip).toBe('192.168.1.100');
      expect(result.source).toBe('x-forwarded-for');
      expect(result.fromProxy).toBe(true);
      expect(result.forwardChain).toEqual(['192.168.1.100', '10.0.0.1', '172.16.0.1']);
    });

    it('should indicate when IP comes from socket', () => {
      const socket = { remoteAddress: '172.16.0.1' } as any;
      const result = detectClientIPDetailed({}, socket);

      expect(result.ip).toBe('172.16.0.1');
      expect(result.source).toBe('socket');
      expect(result.fromProxy).toBe(false);
    });
  });

  describe('isValidIP', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('10.0.0.0')).toBe(true);
      expect(isValidIP('255.255.255.255')).toBe(true);
      expect(isValidIP('0.0.0.0')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIP('256.1.1.1')).toBe(false);
      expect(isValidIP('192.168.1')).toBe(false);
      expect(isValidIP('192.168.1.1.1')).toBe(false);
      expect(isValidIP('not-an-ip')).toBe(false);
      expect(isValidIP('')).toBe(false);
    });

    it('should validate IPv6 loopback', () => {
      expect(isValidIP('::1')).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(isValidIP(null as any)).toBe(false);
      expect(isValidIP(undefined as any)).toBe(false);
    });
  });

  describe('isPrivateIP', () => {
    it('should identify private IPv4 ranges', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
      expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('should identify public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('203.0.113.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });
  });

  describe('isLoopbackIP', () => {
    it('should identify loopback addresses', () => {
      expect(isLoopbackIP('127.0.0.1')).toBe(true);
      expect(isLoopbackIP('127.0.0.100')).toBe(true);
      expect(isLoopbackIP('::1')).toBe(true);
      expect(isLoopbackIP('localhost')).toBe(true);
    });

    it('should identify non-loopback addresses', () => {
      expect(isLoopbackIP('192.168.1.1')).toBe(false);
      expect(isLoopbackIP('10.0.0.1')).toBe(false);
    });
  });
});
