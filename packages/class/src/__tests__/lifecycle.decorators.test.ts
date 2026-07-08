/**
 * @nextrush/decorators - Service Lifecycle Hook interfaces (OnInit / OnShutdown)
 *
 * These are duck-typed behavioral interfaces (no decorator) detected by the
 * presence of a method on an *instance*. The type guards therefore operate on
 * resolved instances, not on class constructors (unlike `isGuardClass`).
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  isOnInit,
  isOnShutdown,
  type OnInit,
  type OnShutdown,
} from '../lifecycle/lifecycle-types.js';

describe('Service lifecycle hook interfaces', () => {
  describe('isOnInit', () => {
    it('returns true for an object literal with an onInit method', () => {
      const obj: OnInit = { onInit() {} };
      expect(isOnInit(obj)).toBe(true);
    });

    it('detects an onInit method defined on the prototype (class instance)', () => {
      class Service implements OnInit {
        onInit(): void {}
      }
      expect(isOnInit(new Service())).toBe(true);
    });

    it('returns false when onInit is absent', () => {
      expect(isOnInit({})).toBe(false);
    });

    it('returns false when onInit is present but not a function', () => {
      expect(isOnInit({ onInit: 42 })).toBe(false);
    });

    it('returns false for null, undefined, and primitives', () => {
      expect(isOnInit(null)).toBe(false);
      expect(isOnInit(undefined)).toBe(false);
      expect(isOnInit('onInit')).toBe(false);
      expect(isOnInit(7)).toBe(false);
    });
  });

  describe('isOnShutdown', () => {
    it('returns true for an object literal with an onShutdown method', () => {
      const obj: OnShutdown = { onShutdown() {} };
      expect(isOnShutdown(obj)).toBe(true);
    });

    it('detects an onShutdown method defined on the prototype (class instance)', () => {
      class Service implements OnShutdown {
        onShutdown(): void {}
      }
      expect(isOnShutdown(new Service())).toBe(true);
    });

    it('returns false when onShutdown is absent or not a function', () => {
      expect(isOnShutdown({})).toBe(false);
      expect(isOnShutdown({ onShutdown: 'nope' })).toBe(false);
    });

    it('returns false for null and non-objects', () => {
      expect(isOnShutdown(null)).toBe(false);
      expect(isOnShutdown(undefined)).toBe(false);
    });
  });
});
