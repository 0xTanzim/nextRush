/**
 * @nextrush/form-data - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as formDataApi from '../index';
import type { DiskStorageOptions, FileInfo, FormDataErrorCode, FormDataField, FormDataLimits, FormDataOptions, FormDataState, ParsedResult, ScanResult, StorageResult, StorageStrategy, UploadedFile } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(formDataApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'formData',
      'DiskStorage',
      'MemoryStorage',
      'parseMultipart',
      'BoundaryScanner',
      'FormDataError',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [DiskStorageOptions, ParsedResult, ScanResult, FileInfo, FormDataErrorCode, FormDataField, FormDataLimits, FormDataOptions, FormDataState, StorageResult, StorageStrategy, UploadedFile];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
