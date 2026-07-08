/**
 * @nextrush/controllers - registerModule() + module-graph Tests
 *
 * Covers the module system: a module's controllers/providers register through
 * the existing pipeline, `imports` compose the whole graph, diamond/duplicate
 * imports dedupe, an import cycle is guarded, all provider-config forms resolve,
 * and lifecycle hooks + request scope from prior waves still work via a module.
 *
 * Uses explicit `@inject(Class)` so dependency graphs are walkable under esbuild
 * (which omits `design:paramtypes`), mirroring the sibling registrar tests.
 */

import { Application } from '@nextrush/core';
import { Controller, Get, Module, type OnInit } from '@nextrush/decorators';
import { Service, createContainer, inject, type Container } from '@nextrush/di';
import { Router } from '@nextrush/router';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotAModuleError } from '../errors.js';
import { collectModuleControllers, collectModuleGraph } from '../module-graph.js';
import { registerModule } from '../module-registrar.js';

// --- (a) controllers + providers ---------------------------------------------

@Service()
class GreetService {
  greet(): string {
    return 'hi';
  }
}

@Controller('/greet')
class GreetController {
  constructor(@inject(GreetService) private readonly svc: GreetService) {}
  @Get()
  say() {
    return { message: this.svc.greet() };
  }
}

@Module({ controllers: [GreetController], providers: [GreetService] })
class GreetModule {}

// --- (b) imports compose ------------------------------------------------------

@Service()
class BillingService {
  total(): number {
    return 10;
  }
}

@Controller('/billing')
class BillingController {
  constructor(@inject(BillingService) private readonly svc: BillingService) {}
  @Get()
  amount() {
    return { total: this.svc.total() };
  }
}

@Module({ controllers: [BillingController], providers: [BillingService] })
class BillingModule {}

@Controller('/root')
class RootController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ imports: [BillingModule], controllers: [RootController] })
class RootModule {}

// --- (c) diamond / duplicate imports -----------------------------------------

@Controller('/shared')
class SharedController {
  @Get()
  get() {
    return {};
  }
}

@Module({ controllers: [SharedController] })
class SharedModule {}

@Module({ imports: [SharedModule] })
class LeftModule {}

@Module({ imports: [SharedModule] })
class RightModule {}

@Module({ imports: [LeftModule, RightModule, SharedModule] })
class DiamondRootModule {}

// --- (d) import cycle ---------------------------------------------------------
// A <-> B mutual import. Assigned after class declaration to form the cycle.

@Module({})
class CycleAModule {}

@Module({})
class CycleBModule {}

// Patch metadata to create the cycle (decorators can't reference not-yet-defined
// classes). Reflect metadata is the same store @Module writes to.
{
  const meta = (cls: Function) => Reflect.getOwnMetadata(Symbol.for('nextrush:module'), cls);
  meta(CycleAModule).imports.push(CycleBModule);
  meta(CycleBModule).imports.push(CycleAModule);
}

// --- (e) provider config forms ------------------------------------------------

class FactoryOutput {
  readonly kind = 'factory';
}

class UseClassTarget {
  readonly kind = 'class';
}

@Controller('/cfg')
class CfgController {
  @Get()
  get() {
    return {};
  }
}

@Module({
  controllers: [CfgController],
  providers: [
    { provide: 'VALUE_TOKEN', useValue: 42 },
    { provide: 'CLASS_TOKEN', useClass: UseClassTarget },
    { provide: 'FACTORY_TOKEN', useFactory: () => new FactoryOutput() },
  ],
})
class CfgModule {}

// --- (f) lifecycle hooks + request scope -------------------------------------

let events: string[] = [];

@Service()
class InitService implements OnInit {
  onInit(): void {
    events.push('init');
  }
}

@Controller('/init')
class InitController {
  constructor(@inject(InitService) private readonly svc: InitService) {}
  @Get()
  get() {
    void this.svc;
    return {};
  }
}

@Module({ controllers: [InitController], providers: [InitService] })
class InitModule {}

@Service({ scope: 'request' })
class RequestId {
  readonly id = Math.random();
}

@Controller('/req')
class RequestController {
  constructor(@inject(RequestId) private readonly rid: RequestId) {}
  @Get()
  get() {
    void this.rid;
    return {};
  }
}

@Module({ controllers: [RequestController], providers: [RequestId] })
class RequestModule {}

// --- not a module -------------------------------------------------------------

class NotAModule {}

beforeEach(() => {
  events = [];
});

describe('collectModuleGraph', () => {
  it('dedupes diamond/duplicate imports so each module appears once', () => {
    const graph = collectModuleGraph(DiamondRootModule);
    const counts = new Map<Function, number>();
    for (const m of graph) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    expect(counts.get(SharedModule)).toBe(1);
    expect(counts.get(LeftModule)).toBe(1);
    expect(graph).toContain(DiamondRootModule);
  });

  it('collects an imported module before its importer (post-order)', () => {
    const graph = collectModuleGraph(RootModule);
    expect(graph.indexOf(BillingModule)).toBeLessThan(graph.indexOf(RootModule));
  });

  it('guards import cycles without infinite recursion', () => {
    const graph = collectModuleGraph(CycleAModule);
    expect(graph).toContain(CycleAModule);
    expect(graph).toContain(CycleBModule);
  });

  it('throws NotAModuleError for a non-module root', () => {
    expect(() => collectModuleGraph(NotAModule)).toThrow(NotAModuleError);
  });

  it('dedupes controllers across the graph', () => {
    const controllers = collectModuleControllers(collectModuleGraph(DiamondRootModule));
    expect(controllers.filter((c) => c === SharedController)).toHaveLength(1);
  });
});

describe('registerModule()', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application({ router: new Router() });
  });

  it('registers a module\'s routes and resolves its controller with providers', async () => {
    const container = createContainer();
    await registerModule(app, GreetModule, { container });

    expect(app.router!.match('GET', '/greet')).not.toBeNull();
    expect(container.isRegistered(GreetService)).toBe(true);
    const ctrl = container.resolve(GreetController) as GreetController;
    expect(ctrl.say()).toEqual({ message: 'hi' });
  });

  it('composes imports: a root module registers the feature module too', async () => {
    const container = createContainer();
    await registerModule(app, RootModule, { container });

    expect(app.router!.match('GET', '/root')).not.toBeNull();
    expect(app.router!.match('GET', '/billing')).not.toBeNull();
    expect(container.isRegistered(BillingService)).toBe(true);
  });

  it('resolves useValue / useClass / useFactory provider configs', async () => {
    const container = createContainer();
    await registerModule(app, CfgModule, { container });

    expect(container.resolve('VALUE_TOKEN')).toBe(42);
    expect(container.resolve('CLASS_TOKEN')).toBeInstanceOf(UseClassTarget);
    expect(container.resolve('FACTORY_TOKEN')).toBeInstanceOf(FactoryOutput);
  });

  it('applies a route prefix like registerControllers', async () => {
    await registerModule(app, GreetModule, { prefix: '/api', isolate: true });
    expect(app.router!.match('GET', '/api/greet')).not.toBeNull();
  });

  it('bridges service lifecycle hooks into app.ready()', async () => {
    await registerModule(app, InitModule, { isolate: true });
    expect(events).toEqual([]);
    await app.ready();
    expect(events).toEqual(['init']);
  });

  it('binds request-scoped services to a per-request lifecycle', async () => {
    const container = createContainer();
    await registerModule(app, RequestModule, { container, validate: false });

    const child1 = container.createChild();
    const child2 = container.createChild();
    const a = child1.resolve(RequestId) as RequestId;
    const b = child2.resolve(RequestId) as RequestId;

    expect(a).toBe(child1.resolve(RequestId)); // shared within a request
    expect(a).not.toBe(b); // fresh across requests
  });

  it('throws NotAModuleError when the root is not a module', async () => {
    await expect(registerModule(app, NotAModule)).rejects.toThrow(NotAModuleError);
  });
});
