/**
 * @nextrush/compression - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as compressionApi from '../index';
import { CompressionErrorCode, COMPRESSION_ENCODINGS, DEFAULT_COMPRESSIBLE_TYPES, DEFAULT_COMPRESSION_LEVEL, DEFAULT_EXCLUDED_TYPES, DEFAULT_OPTIONS, DEFAULT_THRESHOLD, ENCODING_PRIORITY, MAX_BROTLI_LEVEL, MAX_COMPRESSION_RATIO, MAX_IN_MEMORY_SIZE, MAX_ZLIB_LEVEL, NO_BODY_METHODS, NO_COMPRESS_STATUS_CODES, VARY_HEADER } from '../index';
import type { AcceptEncodingEntry, CompressionAlgorithm, CompressionEncoding, CompressionErrorCodeType, CompressionInfo, CompressionMiddleware, CompressionOptions, CompressionResult, CompressionState, NegotiationResult, ResolvedCompressionOptions, RuntimeCapabilities, WebCompressionFormat } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols (default export excluded — vitest module namespace)', () => {
    const actualExports = Object.keys(compressionApi).filter((k) => k !== 'default').sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'brotli',
      'compression',
      'deflate',
      'getCompressionInfo',
      'gzip',
      'secureCompressionOptions',
      'wasCompressed',
      'compress',
      'compressData',
      'compressToBuffer',
      'detectCapabilities',
      'estimateCompressedSize',
      'getBestAvailableEncoding',
      'isCompressionBeneficial',
      'isEncodingSupported',
      'resetCapabilities',
      'acceptsCompression',
      'getAcceptedEncodings',
      'getEncodingQuality',
      'isEncodingAccepted',
      'negotiateEncoding',
      'parseAcceptEncoding',
      'selectEncoding',
      'extractMimeType',
      'getCompressionRecommendation',
      'isAlreadyCompressed',
      'isBinaryContent',
      'isCompressible',
      'isTextContent',
      'matchesAnyPattern',
      'matchesPattern',
      'COMPRESSION_ENCODINGS',
      'DEFAULT_COMPRESSIBLE_TYPES',
      'DEFAULT_COMPRESSION_LEVEL',
      'DEFAULT_EXCLUDED_TYPES',
      'DEFAULT_OPTIONS',
      'DEFAULT_THRESHOLD',
      'ENCODING_PRIORITY',
      'MAX_BROTLI_LEVEL',
      'MAX_COMPRESSION_RATIO',
      'MAX_IN_MEMORY_SIZE',
      'MAX_ZLIB_LEVEL',
      'NO_BODY_METHODS',
      'NO_COMPRESS_STATUS_CODES',
      'VARY_HEADER',
      'CompressionError',
      'CompressionErrorCode',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(compressionApi.default).toBeDefined();
    expect(typeof CompressionErrorCode).toBe('object');
    expect(typeof COMPRESSION_ENCODINGS === 'object').toBe(true);
    expect(typeof DEFAULT_COMPRESSIBLE_TYPES === 'object').toBe(true);
    expect(typeof DEFAULT_COMPRESSION_LEVEL).toBe('number');
    expect(typeof DEFAULT_EXCLUDED_TYPES === 'object').toBe(true);
    expect(typeof DEFAULT_OPTIONS).toBe('object');
    expect(typeof DEFAULT_THRESHOLD).toBe('number');
    expect(typeof ENCODING_PRIORITY === 'object').toBe(true);
    expect(typeof MAX_BROTLI_LEVEL).toBe('number');
    expect(typeof MAX_COMPRESSION_RATIO).toBe('number');
    expect(typeof MAX_IN_MEMORY_SIZE).toBe('number');
    expect(typeof MAX_ZLIB_LEVEL).toBe('number');
    expect(typeof NO_BODY_METHODS === 'object').toBe(true);
    expect(typeof NO_COMPRESS_STATUS_CODES === 'object').toBe(true);
    expect(typeof VARY_HEADER).toBe('string');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      AcceptEncodingEntry,
      CompressionAlgorithm,
      CompressionEncoding,
      CompressionErrorCodeType,
      CompressionInfo,
      CompressionMiddleware,
      CompressionOptions,
      CompressionResult,
      CompressionState,
      NegotiationResult,
      ResolvedCompressionOptions,
      RuntimeCapabilities,
      WebCompressionFormat,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
