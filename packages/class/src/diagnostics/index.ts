/**
 * @nextrush/class Diagnostics
 *
 * Opt-in introspection and debugging for class-based registration.
 * Zero-cost when disabled.
 */

export type {
  CircularDependency,
  DiagnosticsReport,
  DuplicateRoute,
  ProviderEntry,
  RouteEntry,
  TimingEntry,
} from './types.js';

export { collectDiagnostics } from './collector.js';
