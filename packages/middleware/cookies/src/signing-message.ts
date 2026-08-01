/**
 * @nextrush/cookies - Context-Bound Message Construction (RFC-031, SEC-07)
 *
 * The length-prefixed signing message and wire-format split/join helpers
 * used by `signing.ts`. Split out to keep `signing.ts` under the file-size
 * ceiling and to isolate the construction detail from the crypto calls.
 *
 * @packageDocumentation
 */

import { SIGNATURE_SEPARATOR } from './constants.js';

/**
 * Length-prefixed `<len>!name!<len>!value!<len>!issuedAt` message, mirroring
 * `@nextrush/csrf`'s `buildMessage()` construction. Length-prefixing is
 * injective, so a value containing the separator character cannot be
 * confused with a name/issuedAt boundary.
 *
 * @see RFC-031
 */
export function buildSignedMessage(name: string, value: string, issuedAt: number): string {
  const issuedAtStr = String(issuedAt);
  return (
    `${String(name.length)}!${name}!` +
    `${String(value.length)}!${value}!` +
    `${String(issuedAtStr.length)}!${issuedAtStr}`
  );
}

/** Legacy (pre-RFC-031) message: the bare value, no name/issuedAt binding. */
export function buildLegacyMessage(value: string): string {
  return value;
}

/**
 * Split a new-format wire value (`value.issuedAt.signature`) from the right:
 * the signature is the last segment, the issuedAt segment is the one before
 * it (pure decimal digits, no separator itself), and everything before that
 * is the original value — which may itself contain any number of separator
 * characters.
 */
export function splitNewFormat(
  signedValue: string
): { value: string; issuedAt: string; signature: string } | undefined {
  const lastSep = signedValue.lastIndexOf(SIGNATURE_SEPARATOR);
  if (lastSep <= 0) return undefined;

  const secondLastSep = signedValue.lastIndexOf(SIGNATURE_SEPARATOR, lastSep - 1);
  if (secondLastSep === -1) return undefined;

  const issuedAt = signedValue.slice(secondLastSep + 1, lastSep);
  if (!/^\d+$/.test(issuedAt)) return undefined;

  const value = signedValue.slice(0, secondLastSep);
  const signature = signedValue.slice(lastSep + 1);
  if (!value || !signature) return undefined;

  return { value, issuedAt, signature };
}

/** Split a legacy wire value (`value.signature`) from the right. */
export function splitLegacyFormat(
  signedValue: string
): { value: string; signature: string } | undefined {
  const lastSep = signedValue.lastIndexOf(SIGNATURE_SEPARATOR);
  if (lastSep === -1) return undefined;

  const value = signedValue.slice(0, lastSep);
  const signature = signedValue.slice(lastSep + 1);
  if (!value || !signature) return undefined;

  return { value, signature };
}

let legacyAcceptanceWarned = false;

/** Logs the legacy-signature-acceptance warning exactly once per process. */
export function warnLegacyAcceptanceOnce(): void {
  if (legacyAcceptanceWarned) return;
  legacyAcceptanceWarned = true;
  console.warn(
    '[@nextrush/cookies] Accepted a legacy (pre-RFC-031) signed cookie via ' +
      'acceptLegacySignatures. This compatibility path is deprecated from ' +
      'introduction — see the migration guide in README.md.'
  );
}

/**
 * Resets the once-per-process legacy-acceptance warning flag. Exposed for
 * testing only.
 * @internal
 */
export function resetLegacyAcceptanceWarning(): void {
  legacyAcceptanceWarned = false;
}
