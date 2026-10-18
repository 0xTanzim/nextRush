/**
 * @nextrush/runtime - JSON body serialization
 *
 * One helper produces the JSON body for every JSON response method on both
 * adapter families, so a value with no JSON representation fails the same way
 * everywhere: a typed error naming the offending value class, thrown before the
 * response is touched (see `response-builder.ts` and the Node context).
 *
 * @packageDocumentation
 */

/**
 * Name a value's class for the failure message.
 *
 * @remarks
 * Only the classes that make `JSON.stringify` return no text are named here.
 * Every other unrepresentable value makes it *throw*, and the engine's own
 * message names the class (a BigInt, a circular structure) — see
 * {@link unrepresentableMessage}.
 */
function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'a function';
  if (typeof value === 'symbol') return 'a Symbol';
  return typeof value;
}

/**
 * Build the message for a value `JSON.stringify` threw on.
 *
 * @remarks
 * The engine text is consulted before falling back to the value's own class
 * because the offending class is often *inside* the value (`{ id: row.bigId }`),
 * and every engine names it — only the wording around it differs, which is why
 * this matches a class name and never the full engine message. The engine text
 * itself stays on `cause` for server-side diagnosis rather than reaching a
 * client.
 */
function unrepresentableMessage(value: unknown, cause: unknown): string {
  const engineText = cause instanceof Error ? cause.message : '';

  if (/circular/i.test(engineText)) {
    return (
      'A JSON response body cannot be a circular structure: the value contains a ' +
      'reference to itself. Send a plain copy without the cycle instead.'
    );
  }

  if (/bigint/i.test(engineText)) {
    return (
      'A JSON response body cannot be a BigInt: JSON has no arbitrary-precision ' +
      'integer. Convert it to a Number or a string first.'
    );
  }

  return (
    `A JSON response body cannot be ${describeValue(value)}: JSON has no ` +
    'representation for it. Convert it to a plain value before sending it.'
  );
}

/** A `TypeError` carrying the engine's own failure text as `cause`. */
function serializationError(message: string, cause?: unknown): TypeError {
  return cause === undefined ? new TypeError(message) : new TypeError(message, { cause });
}

/**
 * Serialize a response body to JSON text.
 *
 * @param value - The value the application asked to send as JSON.
 * @returns The JSON text to write as the response body.
 * @throws {TypeError} When the value has no JSON representation — a `BigInt`, a
 *   circular structure, a function, a `Symbol`, or a top-level `undefined`
 *   (which `JSON.stringify` reports by returning `undefined`, not by throwing).
 *   The message names the value class and the fix, so the failure is actionable
 *   from the server log alone.
 */
export function serializeJson(value: unknown): string {
  let json: string | undefined;

  try {
    json = JSON.stringify(value);
  } catch (cause) {
    throw serializationError(unrepresentableMessage(value, cause), cause);
  }

  if (json === undefined) {
    throw serializationError(
      `A JSON response body cannot be ${describeValue(value)}: JSON.stringify produced ` +
        'no text. Send `null`, or a value carrying its own enumerable properties.'
    );
  }

  return json;
}
