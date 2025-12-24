/**
 * Core Utilities for NextRush v2
 *
 * Shared utility functions used across the framework.
 *
 * @packageDocumentation
 */

// IP Detection
export {
    detectClientIP,
    detectClientIPDetailed, isLoopbackIP, isPrivateIP, isValidIP, type IPDetectionOptions,
    type IPDetectionResult
} from './ip-detector';

// URL Parsing
export {
    buildURL, detectProtocol, extractHostname, extractPath,
    extractSearch, joinPaths,
    matchesPattern, normalizePath, parseURLComponents, type ParsedURLComponents,
    type URLParseOptions
} from './url-parser';

// Response Guards
export {
    ResponseGuard, canSetHeaders, canWriteResponse, createGuardedMethod, getResponseState, guardedSetHeader, guardedWrite, type ResponseState
} from './response-guard';
