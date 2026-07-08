/**
 * nextrush meta-package — createApp() container ownership
 *
 * The class-based flow (`registerControllers`) reads `app.container`. The
 * batteries-included `createApp` from `nextrush` must therefore guarantee a
 * container is always present, while still honoring an explicitly supplied one.
 *
 * The default is the shared `@nextrush/di` container export (explicit ownership,
 * zero DI-resolution behavior change) — a single seam a future per-app-isolation
 * RFC can swap. See docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md.
 */

import { container as sharedContainer, createContainer } from '@nextrush/di';
import { describe, expect, it } from 'vitest';
import { createApp } from '../index.js';

describe('createApp() container ownership', () => {
  it('guarantees app.container is defined by default', () => {
    const app = createApp();

    expect(app.container).toBeDefined();
  });

  it('defaults app.container to the shared @nextrush/di container', () => {
    const app = createApp();

    expect(app.container).toBe(sharedContainer);
  });

  it('honors an explicitly passed container', () => {
    const custom = createContainer();

    const app = createApp({ container: custom });

    expect(app.container).toBe(custom);
  });
});
