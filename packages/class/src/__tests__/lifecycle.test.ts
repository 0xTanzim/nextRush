/**
 * @nextrush/controllers - Service lifecycle hooks (OnInit / OnShutdown)
 *
 * Proves the registrar bridges duck-typed service lifecycle hooks into the app
 * lifecycle: `onInit` at `app.ready()` (not before), `onShutdown` at
 * `app.close()`, async hooks awaited, shutdown in reverse of init order, and no
 * Extension registered when nothing implements a hook.
 *
 * Uses `isolate: true` so each app owns fresh service singletons (no cross-test
 * leakage through the global container), and explicit `@inject(Class)` so the
 * dependency graph is walkable under esbuild (which omits `design:paramtypes`).
 */

import { Application } from '@nextrush/core';
import { Controller, Get, type OnInit, type OnShutdown } from '../index.js';
import { Service, inject } from '@nextrush/di';
import { Router } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerControllers } from '../registrar/registrar.js';

/** Shared ordered log of hook invocations across a single test. */
let events: string[] = [];

beforeEach(() => {
  events = [];
});

// --- Ordered graph: XController -> Repo -> Db (both services have hooks) ------

@Service()
class Db implements OnInit, OnShutdown {
  ready = false;
  async onInit(): Promise<void> {
    // Simulate async work to prove it is awaited before ready() resolves.
    await Promise.resolve();
    this.ready = true;
    events.push('db:init');
  }
  async onShutdown(): Promise<void> {
    await Promise.resolve();
    events.push('db:shutdown');
  }
}

@Service()
class Repo implements OnInit, OnShutdown {
  constructor(@inject(Db) readonly db: Db) {}
  onInit(): void {
    events.push('repo:init');
  }
  onShutdown(): void {
    events.push('repo:shutdown');
  }
}

@Controller('/x')
class XController {
  constructor(@inject(Repo) private readonly repo: Repo) {}
  @Get()
  get() {
    void this.repo;
    return {};
  }
}

// --- No-hook service ----------------------------------------------------------

@Service()
class Plain {
  value = 1;
}

@Controller('/plain')
class PlainController {
  constructor(@inject(Plain) private readonly plain: Plain) {}
  @Get()
  get() {
    void this.plain;
    return {};
  }
}

describe('service lifecycle hooks', () => {
  it('calls onInit only when app.ready() runs, not at registration', async () => {
    const app = new Application({ router: new Router() });
    await registerControllers(app, { controllers: [XController], isolate: true });

    expect(events).toEqual([]); // registered but not booted yet
    expect(app.extensionCount).toBe(1);

    await app.ready();
    expect(events).toEqual(['db:init', 'repo:init']);
  });

  it('awaits async onInit before ready() resolves', async () => {
    const app = new Application({ router: new Router() });
    await registerControllers(app, { controllers: [XController], isolate: true });
    await app.ready();

    // Db.onInit is async; if it were not awaited, ready() would resolve before
    // the flag flips. The recorded event proves completion.
    expect(events).toContain('db:init');
  });

  it('calls onShutdown on app.close() in reverse of the onInit order', async () => {
    const app = new Application({ router: new Router() });
    await registerControllers(app, { controllers: [XController], isolate: true });
    await app.ready();

    events.length = 0; // isolate init from shutdown assertions
    await app.close();

    expect(events).toEqual(['repo:shutdown', 'db:shutdown']);
  });

  it('leaves a hook-free service untouched and registers no extension', async () => {
    const app = new Application({ router: new Router() });
    await registerControllers(app, { controllers: [PlainController], isolate: true });

    expect(app.extensionCount).toBe(0);

    await app.ready();
    await app.close();
    expect(events).toEqual([]);
  });

  it('throws a clear error when the app is already ready', async () => {
    const app = new Application({ router: new Router() });
    await app.ready(); // freeze configuration first

    await expect(
      registerControllers(app, { controllers: [XController], isolate: true })
    ).rejects.toThrow(/serve\(\)\/listen\(\)\/ready\(\)/);
  });
});
