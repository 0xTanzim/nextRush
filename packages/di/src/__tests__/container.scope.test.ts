/**
 * @nextrush/di - Container Request Scope Tests
 */

import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { container, inject, Injectable } from '../index.js';

describe("@nextrush/di - Container - Request Scope ('request' → per-child ContainerScoped)", () => {
  beforeEach(() => {
    container.reset();
  });

  it('resolves the same instance within one child but a fresh one per child', () => {
    // Register on the parent with request scope; a per-child resolution should
    // give one instance per child (per request), shared inside that child.
    class ScopedThing {}
    container.register(ScopedThing, { useClass: ScopedThing }, { scope: 'request' });

    const childA = container.createChild();
    const childB = container.createChild();

    const a1 = childA.resolve(ScopedThing);
    const a2 = childA.resolve(ScopedThing);
    const b1 = childB.resolve(ScopedThing);

    expect(a1).toBe(a2); // same within one child
    expect(a1).not.toBe(b1); // fresh across children
  });

  it('shares a request-scoped dependency between two collaborators in one child', () => {
    class RequestState {}
    class ConsumerA {
      constructor(public readonly state: RequestState) {}
    }
    class ConsumerB {
      constructor(public readonly state: RequestState) {}
    }
    // esbuild (vitest) emits no design:paramtypes. Apply @inject FIRST (param
    // decorators run before class decorators), then @Injectable — which snapshots
    // the constructor's injection tokens — so tsyringe can construct with injection.
    inject(RequestState)(ConsumerA, undefined, 0);
    inject(RequestState)(ConsumerB, undefined, 0);
    Injectable()(ConsumerA);
    Injectable()(ConsumerB);

    container.register(RequestState, { useClass: RequestState }, { scope: 'request' });
    container.register(ConsumerA, { useClass: ConsumerA });
    container.register(ConsumerB, { useClass: ConsumerB });

    const child = container.createChild();
    const a = child.resolve(ConsumerA);
    const b = child.resolve(ConsumerB);

    expect(a.state).toBe(b.state); // shared request-scoped dependency
  });
});
