/**
 * The application shape a driver under test builds for one dispatch.
 *
 * @remarks
 * Shared by every driver because the shape must be identical across runtimes for
 * a scenario's result to be comparable — and because the `beforeBoot` shape is
 * the whole point of that flag: routes declared with `app.get(...)` live on the
 * application's OWN router, which only boot mounts, so an entry point that skips
 * the boot step cannot route them.
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import type { DispatchInit } from './types';

/** Build the application for one dispatch, honoring {@link DispatchInit.beforeBoot}. */
export function buildConformanceApp(init: DispatchInit | undefined): Application {
  const proxy = init?.proxy ?? false;
  return init?.beforeBoot === true
    ? createApp({ proxy, router: createRouter() })
    : createApp({ proxy });
}
