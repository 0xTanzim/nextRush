/**
 * 🔧 Request Enhancer Component - Enterprise Request Enhancement
 * SOLID-compliant component for enhancing request objects
 */

import type { MinimalApplication } from '../../core/interfaces';
import { BaseComponent } from '../../core/base-component';
import type { NextRushRequest } from '../../types/express';

/**
 * Request Enhancer Component - Enhances request objects with additional methods
 */
export class RequestEnhancerComponent extends BaseComponent {
  readonly name = 'RequestEnhancer';

  constructor() {
    super('RequestEnhancer');
  }

  /**
   * Install request enhancement capabilities
   */
  install(app: MinimalApplication): void {
    // Request enhancement happens in the request enhancer
  }

  /**
   * Start the request enhancer
   */
  override async start(): Promise<void> {
    console.log('Request enhancer component started');
  }

  /**
   * Stop the request enhancer
   */
  override async stop(): Promise<void> {
    console.log('Request enhancer component stopped');
  }

  /**
   * Enhance a request object with additional methods
   */
  enhance(req: NextRushRequest): NextRushRequest {
    // The actual enhancement is done by RequestEnhancer class
    // This component provides the interface
    return req;
  }
}
