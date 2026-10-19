/**
 * @nextrush/runtime - the ordered header map of a recorded response
 *
 * One implementation of the header semantics every adapter exposes through
 * `ctx.set()`: case-insensitive lookup, write-order preservation, multi-value
 * fields, accumulated `Set-Cookie`, and array values that replace a field before
 * contributing each element.
 *
 * The list is allocated on the first write, so a response whose only header is
 * the body method's content type never allocates one. Case-insensitive compares
 * never lower-case the field: a header name is an ASCII token, so a length check
 * plus a per-character fold is both allocation-free and cheap.
 *
 * @packageDocumentation
 */

/**
 * One header value as it will be flushed: the writing caller's field casing and
 * a single value. A multi-value field is repeated, one entry per value, so
 * `set-cookie` never has to be joined and re-split.
 */
export type OutgoingHeaderEntry = readonly [name: string, value: string];

/** Writable entry storage; {@link HeaderList.entries} narrows it to readonly. */
type MutableHeaderEntry = [name: string, value: string];

const SET_COOKIE = 'set-cookie';
const LOWERCASE_S = 0x73;

/**
 * Whether two header names are equal ignoring ASCII case, without allocating.
 *
 * @remarks
 * Header names are validated against RFC 9110's `token` grammar before they
 * reach here, so every character is ASCII; folding bit 0x20 is therefore exact.
 */
export function sameHeaderName(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if ((left.charCodeAt(index) | 0x20) !== (right.charCodeAt(index) | 0x20)) return false;
  }
  return true;
}

/**
 * An ordered, case-insensitive header map with multi-value support.
 *
 * @remarks
 * Order is write order, except that a scalar write to an existing field keeps
 * that field's position and replaces its value in place.
 */
export class HeaderList {
  private _entries: MutableHeaderEntry[] | undefined;

  /**
   * Apply the `ctx.set()` semantics to one field.
   *
   * @param field - The caller's field name; its casing is what flushes.
   * @param value - A scalar replaces the field; `set-cookie` accumulates; an
   *   array replaces the field and then contributes each element in order.
   */
  set(field: string, value: string | string[]): void {
    if (Array.isArray(value)) {
      this.remove(field);
      for (const element of value) {
        this._append(field, element);
      }
      return;
    }

    if (isSetCookie(field)) {
      this._append(field, value);
      return;
    }

    const entries = (this._entries ??= []);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry !== undefined && sameHeaderName(entry[0], field)) {
        entries[index] = [field, value];
        return;
      }
    }
    entries.push([field, value]);
  }

  /** Remove every value of a field, case-insensitively. */
  remove(field: string): void {
    const entries = this._entries;
    if (entries === undefined) return;

    const kept = entries.filter(([name]) => !sameHeaderName(name, field));
    this._entries = kept.length === 0 ? undefined : kept;
  }

  /** The first value recorded for a field, case-insensitively. */
  get(field: string): string | undefined {
    return this.first(field)?.[1];
  }

  /** Whether a field has at least one value. */
  has(field: string): boolean {
    return this.first(field) !== undefined;
  }

  /** Every value recorded for a field, in write order. */
  getAll(field: string): string[] {
    const entries = this._entries;
    if (entries === undefined) return [];

    const values: string[] = [];
    for (const [name, value] of entries) {
      if (sameHeaderName(name, field)) values.push(value);
    }
    return values;
  }

  /** The entries in write order, or `undefined` while nothing has been written. */
  entries(): readonly OutgoingHeaderEntry[] | undefined {
    return this._entries;
  }

  private first(field: string): MutableHeaderEntry | undefined {
    const entries = this._entries;
    if (entries === undefined) return undefined;

    for (const entry of entries) {
      if (sameHeaderName(entry[0], field)) return entry;
    }
    return undefined;
  }

  private _append(field: string, value: string): void {
    const entries = (this._entries ??= []);
    // Reuse the casing already recorded for this field so a multi-value field
    // flushes under one name, whatever casing each write used.
    for (const [name] of entries) {
      if (sameHeaderName(name, field)) {
        entries.push([name, value]);
        return;
      }
    }
    entries.push([field, value]);
  }
}

/**
 * Whether a scalar write to this field accumulates instead of replacing.
 *
 * @remarks
 * The length and first-character checks are constant-time, so no case folding
 * runs for a field that could not be `set-cookie`.
 */
function isSetCookie(field: string): boolean {
  return (
    field.length === SET_COOKIE.length &&
    (field.charCodeAt(0) | 0x20) === LOWERCASE_S &&
    sameHeaderName(field, SET_COOKIE)
  );
}
