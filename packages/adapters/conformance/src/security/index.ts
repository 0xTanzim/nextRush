/**
 * Security harness surface for `@nextrush/adapter-conformance` (tasks 2.1–2.2).
 *
 * @packageDocumentation
 */

export {
  CLIENT_IP_FIXTURES,
  DOT_SEGMENT_PATHS,
  FORGED_FORWARDED_CHAINS,
  MALFORMED_HEADERS,
  PATH_TARGET_VARIANTS,
} from './fixtures';
export {
  PRIMARY_SECURITY_ADAPTERS,
  primarySecurityDrivers,
  securityScenario,
  securityScenarioMap,
  type PrimarySecurityAdapter,
  type SecurityScenarioInit,
  type SecurityScenarioResult,
} from './scenario';
