/**
 * @nextrush/di - Container Error & Optional Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CircularDependencyError,
  container,
  DependencyResolutionError,
  inject,
  Optional,
  Service,
} from '../index.js';

describe('@nextrush/di - Container - Circular Dependency Detection (Set-based)', () => {
  beforeEach(() => {
    container.reset();
  });

  it('should detect direct circular dependency with clear error', () => {
    @Service()
    class ServiceA {
      constructor(@inject('ServiceB') public b: unknown) {}
    }

    @Service()
    class ServiceB {
      constructor(@inject(ServiceA) public a: ServiceA) {}
    }

    container.register(ServiceA, { useClass: ServiceA });
    container.register('ServiceB', { useClass: ServiceB });

    expect(() => container.resolve(ServiceA)).toThrow(CircularDependencyError);
  });

  it('should not false-positive on sequential resolutions of the same token', () => {
    @Service()
    class SafeService {
      getValue() {
        return 'safe';
      }
    }

    container.register(SafeService, { useClass: SafeService });

    // Should not throw — resolving the same token twice sequentially is fine
    const a = container.resolve(SafeService);
    const b = container.resolve(SafeService);
    expect(a.getValue()).toBe('safe');
    expect(b.getValue()).toBe('safe');
  });
});

describe('@nextrush/di - Container - Error Messages (P2-4)', () => {
  beforeEach(() => {
    container.reset();
  });

  it('should provide actionable fix in DependencyResolutionError', () => {
    expect(() => container.resolve('NonExistentService')).toThrow(
      /@Service\(\).*@Repository\(\).*@Config\(\)/s
    );
  });

  it('should suggest checking imports in resolution error', () => {
    expect(() => container.resolve('MissingDep')).toThrow(/imported before container\.resolve/);
  });
});

describe('@nextrush/di - Container - Error Classification (P2-11)', () => {
  beforeEach(() => {
    container.reset();
  });

  it('should classify a missing constructor dependency as DependencyResolutionError (not circular)', () => {
    // tsyringe wraps a missing *constructor* dependency in a message containing BOTH
    // "Cannot inject the dependency" AND "unregistered dependency token". A genuine
    // missing dep must map to DependencyResolutionError, never CircularDependencyError.
    @Service()
    class MissingDepService {
      constructor(@inject('UNREGISTERED_DEP') public dep: unknown) {}
    }

    container.register(MissingDepService, { useClass: MissingDepService });

    expect(() => container.resolve(MissingDepService)).toThrow(DependencyResolutionError);
    expect(() => container.resolve(MissingDepService)).not.toThrow(CircularDependencyError);
  });

  it('should still classify a true circular dependency as CircularDependencyError', () => {
    @Service()
    class CycleA {
      constructor(@inject('CycleB') public b: unknown) {}
    }

    @Service()
    class CycleB {
      constructor(@inject(CycleA) public a: unknown) {}
    }

    container.register(CycleA, { useClass: CycleA });
    container.register('CycleB', { useClass: CycleB });

    expect(() => container.resolve(CycleA)).toThrow(CircularDependencyError);
  });
});

describe('@nextrush/di - Container - @Optional Resolution Behavior', () => {
  beforeEach(() => {
    container.reset();
  });

  it('should resolve class with missing optional dep as undefined', () => {
    @Service()
    class OptService {
      constructor(@Optional() @inject('MISSING_MAILER') public mailer?: unknown) {}
    }

    container.register(OptService, { useClass: OptService });

    const instance = container.resolve(OptService);
    expect(instance).toBeDefined();
    expect(instance.mailer).toBeUndefined();
  });

  it('should resolve optional dep when it IS registered', () => {
    @Service()
    class OptServiceWithValue {
      constructor(@Optional() @inject('PRESENT_TOKEN') public dep?: string) {}
    }

    container.register('PRESENT_TOKEN', { useValue: 'hello' });
    container.register(OptServiceWithValue, { useClass: OptServiceWithValue });

    const instance = container.resolve(OptServiceWithValue);
    expect(instance.dep).toBe('hello');
  });

  it('should resolve mixed required + optional deps', () => {
    @Service()
    class MixedDeps {
      constructor(
        @inject('REQ') public required: string,
        @Optional() @inject('OPT_A') public optA?: unknown,
        @Optional() @inject('OPT_B') public optB?: unknown
      ) {}
    }

    container.register('REQ', { useValue: 'required-value' });
    // OPT_A and OPT_B intentionally NOT registered
    container.register(MixedDeps, { useClass: MixedDeps });

    const instance = container.resolve(MixedDeps);
    expect(instance.required).toBe('required-value');
    expect(instance.optA).toBeUndefined();
    expect(instance.optB).toBeUndefined();
  });

  it('should still throw for missing required (non-optional) deps', () => {
    @Service()
    class RequiredOnly {
      constructor(@inject('NOT_REGISTERED') public dep: unknown) {}
    }

    container.register(RequiredOnly, { useClass: RequiredOnly });

    expect(() => container.resolve(RequiredOnly)).toThrow(DependencyResolutionError);
  });
});
