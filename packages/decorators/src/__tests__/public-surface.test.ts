/**
 * @nextrush/decorators - Public API surface test
 *
 * DEPRECATED compatibility shim (re-exports @nextrush/class) — locks the
 * exported symbol set from `src/index.ts` exactly as it stands today. This is
 * NOT an endorsement of the surface; it's the prerequisite for a safe removal
 * (gap-checklist T053) — you can't remove or codemod a surface you haven't
 * first locked. If this test fails, the shim's re-export surface has changed.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as decoratorsApi from '../index';
import { DECORATOR_METADATA_KEYS, isGuardClass, isValidHttpMethod, isValidParamSource, isOnInit, isOnShutdown, Controller, Module, getModuleMetadata, isModule, HttpCode, Redirect, SetHeader, All, Delete, Get, Head, Options, Patch, Post, Put, Body, Ctx, Header, Param, Query, Req, Res, createCustomParamDecorator, UseGuard, getAllGuards, getClassGuards, getMethodGuards, Catch, UseFilter, getAllFilters, getCatchTypes, getClassFilters, getMethodFilters, UseInterceptor, getAllInterceptors, getClassInterceptors, getMethodInterceptors, getAllParamMetadata, getControllerDefinition, getControllerMetadata, getHttpCode, getParamMetadata, getRedirectMetadata, getResponseHeaders, getRouteMetadata, isController, getConstructorParamTypes } from '../index';
import type {
  BodyOptions,
  CanActivate,
  Constructor,
  ControllerMetadata,
  ControllerOptions,
  CustomParamExtractor,
  ExceptionFilter,
  ExceptionFilterClass,
  FilterMetadata,
  Guard,
  GuardContext,
  GuardFn,
  GuardMetadata,
  HeaderOptions,
  Interceptor,
  InterceptorClass,
  InterceptorMetadata,
  MiddlewareRef,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMetadata,
  RouteMethods,
  RouteOptions,
  TransformFn,
  OnInit,
  OnShutdown,
  ModuleMetadata,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderConfig,
  ControllerDefinition,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(decoratorsApi).sort();

    // SEALED: locked back-compat re-export surface from @nextrush/class.
    const expectedRuntime = [
      'DECORATOR_METADATA_KEYS',
      'isGuardClass',
      'isValidHttpMethod',
      'isValidParamSource',
      'isOnInit',
      'isOnShutdown',
      'Controller',
      'Module',
      'getModuleMetadata',
      'isModule',
      'HttpCode',
      'Redirect',
      'SetHeader',
      'All',
      'Delete',
      'Get',
      'Head',
      'Options',
      'Patch',
      'Post',
      'Put',
      'Body',
      'Ctx',
      'Header',
      'Param',
      'Query',
      'Req',
      'Res',
      'createCustomParamDecorator',
      'UseGuard',
      'getAllGuards',
      'getClassGuards',
      'getMethodGuards',
      'Catch',
      'UseFilter',
      'getAllFilters',
      'getCatchTypes',
      'getClassFilters',
      'getMethodFilters',
      'UseInterceptor',
      'getAllInterceptors',
      'getClassInterceptors',
      'getMethodInterceptors',
      'getAllParamMetadata',
      'getControllerDefinition',
      'getControllerMetadata',
      'getHttpCode',
      'getParamMetadata',
      'getRedirectMetadata',
      'getResponseHeaders',
      'getRouteMetadata',
      'isController',
      'getConstructorParamTypes',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DECORATOR_METADATA_KEYS).toBe('object');
    expect(typeof isGuardClass).toBe('function');
    expect(typeof isValidHttpMethod).toBe('function');
    expect(typeof isValidParamSource).toBe('function');
    expect(typeof isOnInit).toBe('function');
    expect(typeof isOnShutdown).toBe('function');
    expect(typeof Controller).toBe('function');
    expect(typeof Module).toBe('function');
    expect(typeof getModuleMetadata).toBe('function');
    expect(typeof isModule).toBe('function');
    expect(typeof HttpCode).toBe('function');
    expect(typeof Redirect).toBe('function');
    expect(typeof SetHeader).toBe('function');
    expect(typeof All).toBe('function');
    expect(typeof Delete).toBe('function');
    expect(typeof Get).toBe('function');
    expect(typeof Head).toBe('function');
    expect(typeof Options).toBe('function');
    expect(typeof Patch).toBe('function');
    expect(typeof Post).toBe('function');
    expect(typeof Put).toBe('function');
    expect(typeof Body).toBe('function');
    expect(typeof Ctx).toBe('function');
    expect(typeof Header).toBe('function');
    expect(typeof Param).toBe('function');
    expect(typeof Query).toBe('function');
    expect(typeof Req).toBe('function');
    expect(typeof Res).toBe('function');
    expect(typeof createCustomParamDecorator).toBe('function');
    expect(typeof UseGuard).toBe('function');
    expect(typeof getAllGuards).toBe('function');
    expect(typeof getClassGuards).toBe('function');
    expect(typeof getMethodGuards).toBe('function');
    expect(typeof Catch).toBe('function');
    expect(typeof UseFilter).toBe('function');
    expect(typeof getAllFilters).toBe('function');
    expect(typeof getCatchTypes).toBe('function');
    expect(typeof getClassFilters).toBe('function');
    expect(typeof getMethodFilters).toBe('function');
    expect(typeof UseInterceptor).toBe('function');
    expect(typeof getAllInterceptors).toBe('function');
    expect(typeof getClassInterceptors).toBe('function');
    expect(typeof getMethodInterceptors).toBe('function');
    expect(typeof getAllParamMetadata).toBe('function');
    expect(typeof getControllerDefinition).toBe('function');
    expect(typeof getControllerMetadata).toBe('function');
    expect(typeof getHttpCode).toBe('function');
    expect(typeof getParamMetadata).toBe('function');
    expect(typeof getRedirectMetadata).toBe('function');
    expect(typeof getResponseHeaders).toBe('function');
    expect(typeof getRouteMetadata).toBe('function');
    expect(typeof isController).toBe('function');
    expect(typeof getConstructorParamTypes).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      BodyOptions,
      CanActivate,
      Constructor,
      ControllerMetadata,
      ControllerOptions,
      CustomParamExtractor,
      ExceptionFilter,
      ExceptionFilterClass,
      FilterMetadata,
      Guard,
      GuardContext,
      GuardFn,
      GuardMetadata,
      HeaderOptions,
      Interceptor,
      InterceptorClass,
      InterceptorMetadata,
      MiddlewareRef,
      ParamMetadata,
      ParamOptions,
      ParamSource,
      QueryOptions,
      RedirectMetadata,
      ResponseHeaderMetadata,
      RouteMetadata,
      RouteMethods,
      RouteOptions,
      TransformFn,
      OnInit,
      OnShutdown,
      ModuleMetadata,
      ModuleOptions,
      ModuleProvider,
      ModuleProviderConfig,
      ControllerDefinition,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
