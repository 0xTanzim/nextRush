/**
 * @nextrush/di - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as diApi from '../index';
import { METADATA_KEYS } from '../index';
import type {
  ClassProvider,
  ConfigOptions,
  Constructor,
  Container,
  FactoryProvider,
  Provider,
  RegisterOptions,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(diApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Container
      'container',
      'createContainer',

      // Decorators
      'Config',
      'Injectable',
      'Optional',
      'Repository',
      'Service',
      'delay',
      'getConfigPrefix',
      'getOptionalParams',
      'getServiceScope',
      'getServiceType',
      'hasServiceMetadata',
      'inject',
      'isParameterOptional',
      'markInjectable',

      // Types (runtime constant)
      'METADATA_KEYS',

      // Errors
      'CircularDependencyError',
      'DIError',
      'DependencyResolutionError',
      'InvalidProviderError',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof METADATA_KEYS).toBe('object');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      ClassProvider<object>,
      ConfigOptions,
      Constructor,
      Container,
      FactoryProvider<object>,
      Provider<object>,
      RegisterOptions,
      Scope,
      ServiceOptions,
      Token<object>,
      ValueProvider<object>,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
