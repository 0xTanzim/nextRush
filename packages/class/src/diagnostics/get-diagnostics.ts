/**
 * Public API for retrieving diagnostics reports
 *
 * Wrapper over the internal WeakMap storage to provide a clean public interface.
 */

import type { Application } from '@nextrush/core';
import type { DiagnosticsReport } from './types.js';
import { getClassDiagnosticsInternal } from '../bootstrap/pipeline.js';

/**
 * Retrieve the diagnostics report for an application.
 *
 * Returns undefined if diagnostics were not enabled during registration
 * (diagnostics: false or not specified in options).
 *
 * @param app The application instance
 * @returns Diagnostics report if enabled, undefined otherwise
 */
export function getClassDiagnostics(app: Application): DiagnosticsReport | undefined {
  return getClassDiagnosticsInternal(app) as DiagnosticsReport | undefined;
}
