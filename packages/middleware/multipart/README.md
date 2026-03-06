# @nextrush/multipart

Zero-dependency multipart/form-data file upload middleware for NextRush. Uses Web Streams API — works on Node.js, Bun, Deno, and Edge runtimes.

## Features

- **Zero dependencies** — custom streaming parser, no busboy or formidable
- **Web Streams API** — uses `ReadableStream`, works on all runtimes
- **Pluggable storage** — MemoryStorage (default) or DiskStorage, or bring your own
- **Security by default** — filename sanitization, path traversal prevention, prototype pollution protection, body size enforcement
- **Size limits** — configurable per-file, total files, fields, parts, and total body size
- **MIME type filtering** — exact match and wildcard (`image/*`) support
- **Zero-config** — works out of the box with sensible defaults

## Installation

```bash
pnpm add @nextrush/multipart
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { multipart } from '@nextrush/multipart';

const app = createApp();
const router = createRouter();

// Add multipart middleware
app.use(multipart());

router.post('/upload', (ctx) => {
  const { files, fields } = ctx.state;
  ctx.json({
    uploaded: files.map((f) => ({
      name: f.sanitizedName,
      size: f.size,
      type: f.mimeType,
    })),
    fields,
  });
});

app.route('/', router);
app.listen(3000);
```

## Configuration

```typescript
import { multipart, MemoryStorage, DiskStorage } from '@nextrush/multipart';

// Memory storage (default)
app.use(multipart());

// Disk storage
app.use(
  multipart({
    storage: new DiskStorage({
      dest: './uploads',
    }),
  })
);

// Full options
app.use(
  multipart({
    storage: new MemoryStorage(),
    allowedTypes: ['image/*', 'application/pdf'],
    abortOnError: true,
    limits: {
      maxFileSize: '10mb',
      maxFiles: 5,
      maxFields: 20,
      maxFieldSize: '1mb',
      maxBodySize: '50mb',
    },
  })
);
```

## Storage Strategies

### MemoryStorage (Default)

Buffers file contents in memory. Best for small files or when you need immediate access to the buffer.

> **⚠️ Production note:** MemoryStorage holds the entire file in memory. For production workloads with large uploads, use `DiskStorage` or a custom `StorageStrategy` to avoid memory pressure. Always configure `limits.maxFileSize` and `limits.maxBodySize` to cap memory usage.

```typescript
import { MemoryStorage } from '@nextrush/multipart';

app.use(multipart({ storage: new MemoryStorage() }));

// Access the buffer
router.post('/upload', (ctx) => {
  const file = ctx.state.files[0];
  console.log(file.buffer); // Uint8Array
});
```

### DiskStorage

Streams files directly to the filesystem. Best for large files or persistent storage.

```typescript
import { DiskStorage } from '@nextrush/multipart';

app.use(
  multipart({
    storage: new DiskStorage({
      dest: './uploads',
      filename: (info) => `${Date.now()}-${info.sanitizedName}`,
    }),
  })
);

// Access the file path
router.post('/upload', (ctx) => {
  const file = ctx.state.files[0];
  console.log(file.path); // './uploads/1234567890-photo.jpg'
});
```

Default filename uses `crypto.randomUUID()` prefix for collision resistance.

### Custom Storage

Implement the `StorageStrategy` interface:

```typescript
import type { StorageStrategy, StorageResult, FileInfo } from '@nextrush/multipart';

class S3Storage implements StorageStrategy {
  async handle(stream: ReadableStream<Uint8Array>, info: FileInfo): Promise<StorageResult> {
    // Upload to S3...
    return { size: uploadedBytes, path: s3Key };
  }

  async remove(result: StorageResult): Promise<void> {
    // Delete from S3...
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage` | `StorageStrategy` | `MemoryStorage` | Where to store uploaded files |
| `allowedTypes` | `string[]` | `undefined` | Allowed MIME types (supports wildcards) |
| `abortOnError` | `boolean` | `true` | Stop processing on first error |
| `filename` | `(info: FileInfo) => string` | `undefined` | Custom filename generator |
| `limits.maxFileSize` | `number \| string` | `'5mb'` | Max size per file |
| `limits.maxFiles` | `number` | `10` | Max number of files |
| `limits.maxFields` | `number` | `50` | Max number of fields |
| `limits.maxParts` | `number` | `100` | Max total parts |
| `limits.maxFieldSize` | `number \| string` | `'1mb'` | Max size per field value |
| `limits.maxFieldNameSize` | `number` | `200` | Max field name length |
| `limits.maxHeaderPairs` | `number` | `2000` | Max header pairs per part |
| `limits.maxBodySize` | `number \| string` | `'10mb'` | Max total request body size |

## Accessing Uploaded Data

After the middleware runs, uploaded files and fields are available on `ctx.state`:

```typescript
router.post('/upload', (ctx) => {
  // Files
  for (const file of ctx.state.files) {
    file.fieldName; // Form field name
    file.originalName; // Client-provided filename
    file.sanitizedName; // Safe filename for storage
    file.mimeType; // MIME type (e.g., 'image/png')
    file.encoding; // Transfer encoding
    file.size; // File size in bytes
    file.truncated; // Whether the file was truncated (exceeded size limit)
    file.buffer; // Uint8Array (MemoryStorage only)
    file.path; // File path on disk (DiskStorage only)
  }

  // Fields
  const { name, description } = ctx.state.fields;
});
```

## Error Handling

The middleware throws `MultipartError` with specific error codes:

```typescript
import { MultipartError } from '@nextrush/multipart';

app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    if (error instanceof MultipartError) {
      ctx.status = error.status;
      ctx.json({
        error: error.code,
        message: error.message,
      });
    }
  }
});
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `FILE_TOO_LARGE` | 413 | File exceeds `maxFileSize` |
| `BODY_SIZE_EXCEEDED` | 413 | Total body exceeds `maxBodySize` |
| `FILES_LIMIT_EXCEEDED` | 413 | Too many files |
| `FIELDS_LIMIT_EXCEEDED` | 413 | Too many fields |
| `PARTS_LIMIT_EXCEEDED` | 413 | Too many parts |
| `INVALID_CONTENT_TYPE` | 415 | Not a multipart/form-data request |
| `INVALID_FIELD_NAME` | 400 | Prototype pollution attempt |
| `INVALID_FILE_TYPE` | 415 | MIME type not in `allowedTypes` |
| `STORAGE_ERROR` | 500 | Storage strategy failure |
| `PARSE_ERROR` | 400 | Malformed multipart data |
| `REQUEST_ABORTED` | 400 | Client disconnected |

## Security

All protections are enabled by default — no opt-in required.

- **Path traversal prevention**: Filenames are stripped of directory components
- **Null byte injection**: Null bytes and control characters are replaced
- **Prototype pollution**: Field names like `__proto__`, `constructor`, `prototype` are rejected
- **Hidden file prevention**: Leading dots are stripped from filenames
- **Windows reserved names**: `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9` are prefixed with `_`
- **Body size enforcement**: Total request body tracked cumulatively against `maxBodySize`
- **Boundary validation**: Boundaries exceeding 70 characters rejected per RFC 2046
- **Error message sanitization**: User-supplied values truncated and stripped of control characters
- **Size limits**: All limits enforced at the streaming level

## Runtime Compatibility

| Runtime | MemoryStorage | DiskStorage | Notes |
|---------|---------------|-------------|-------|
| Node.js 22+ | ✅ | ✅ | Full support |
| Bun | ✅ | ✅ | Full support |
| Deno | ✅ | ✅ | Via Node compat layer |
| Cloudflare Workers | ✅ | ❌ | No filesystem access |
| Vercel Edge | ✅ | ❌ | No filesystem access |

The parser uses Web Streams API (`ReadableStream`) and Web Crypto API (`crypto.randomUUID()`) — both available across all modern runtimes. DiskStorage requires `node:fs` and `node:stream`, limiting it to server runtimes.

## License

MIT
