/**
 * @nextrush/decorators - @Module Decorator Tests
 *
 * Proves @Module records feature composition (imports/controllers/providers/
 * exports) as metadata and that the readers (isModule, getModuleMetadata)
 * surface it. Encapsulation is not enforced here — this is metadata only.
 */

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Module } from '../module.js';
import { getModuleMetadata, isModule } from '../module.js';
import type { ModuleProvider } from '../module-types.js';

class UserController {}
class UserService {}
class BillingModule {}

describe('@Module', () => {
  it('marks a decorated class as a module', () => {
    @Module({})
    class AppModule {}

    expect(isModule(AppModule)).toBe(true);
  });

  it('returns false for a non-decorated class', () => {
    class Plain {}
    expect(isModule(Plain)).toBe(false);
  });

  it('records controllers, providers, imports, and exports', () => {
    const provider: ModuleProvider = { provide: 'TOKEN', useValue: 42 };

    @Module({
      imports: [BillingModule],
      controllers: [UserController],
      providers: [UserService, provider],
      exports: [UserService],
    })
    class UserModule {}

    const meta = getModuleMetadata(UserModule);
    expect(meta?.imports).toEqual([BillingModule]);
    expect(meta?.controllers).toEqual([UserController]);
    expect(meta?.providers).toEqual([UserService, provider]);
    expect(meta?.exports).toEqual([UserService]);
  });

  it('defaults every field to an empty array', () => {
    @Module({})
    class EmptyModule {}

    const meta = getModuleMetadata(EmptyModule);
    expect(meta?.imports).toEqual([]);
    expect(meta?.controllers).toEqual([]);
    expect(meta?.providers).toEqual([]);
    expect(meta?.exports).toEqual([]);
  });

  it('returns undefined metadata for a non-module class', () => {
    class Plain {}
    expect(getModuleMetadata(Plain)).toBeUndefined();
  });

  it('returns a defensive copy so callers cannot mutate stored metadata', () => {
    @Module({ controllers: [UserController] })
    class M {}

    const meta = getModuleMetadata(M)!;
    meta.controllers.push(UserService);

    expect(getModuleMetadata(M)?.controllers).toEqual([UserController]);
  });
});
