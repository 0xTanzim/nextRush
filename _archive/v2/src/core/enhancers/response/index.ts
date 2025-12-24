/**
 * Response Enhancer Modules for NextRush v2
 *
 * Exports all response enhancement utilities.
 *
 * @packageDocumentation
 */

// MIME Types
export {
    getContentTypeFromExtension,
    getSmartContentType, getSupportedMimeTypes, isBinaryMimeType, isTextMimeType
} from './mime-types.js';

// File Handler
export {
    generateETag, sendDownload, sendFile, streamToResponse, type FileOptions,
    type FileStats
} from './file-handler.js';

// API Responses
export {
    sendBadRequest,
    sendCreated, sendError, sendForbidden, sendNoContent, sendNotFound, sendPaginated, sendSuccess, sendUnauthorized, type ErrorResponse, type PaginatedResponse, type PaginationMeta, type SuccessResponse
} from './api-responses.js';

// Cache Control
export {
    setCache, setCacheControl, setContentLength, setContentType, setCorsHeaders,
    setETag,
    setLastModified, setNoCache,
    setSecurityHeaders, type CacheOptions,
    type SecurityOptions
} from './cache-control.js';

// Data Converters
export {
    convertToCSV,
    parseCSV, type CsvOptions
} from './data-converters.js';

// Template Helpers
export {
    conditional, escapeHtmlEntities, formatValue, getNestedValue,
    isTruthy, renderTemplate, unescapeHtmlEntities, type TemplateOptions
} from './template-helpers.js';
