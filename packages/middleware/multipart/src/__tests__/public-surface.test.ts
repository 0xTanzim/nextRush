/**
 * @nextrush/multipart - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as multipartApi from '../index';
import type { DiskStorageOptions, FileInfo, MultipartErrorCode, MultipartField, MultipartLimits, MultipartOptions, MultipartState, ParsedResult, ScanResult, StorageResult, StorageStrategy, UploadedFile } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(multipartApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'multipart',
      'DiskStorage',
      'MemoryStorage',
      'parseMultipart',
      'BoundaryScanner',
      'MultipartError',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [DiskStorageOptions, ParsedResult, ScanResult, FileInfo, MultipartErrorCode, MultipartField, MultipartLimits, MultipartOptions, MultipartState, StorageResult, StorageStrategy, UploadedFile];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
