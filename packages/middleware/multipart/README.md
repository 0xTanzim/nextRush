# @nextrush/multipart

Streaming multipart/form-data file upload middleware for NextRush. Built on [busboy](https://github.com/mscdex/busboy) for battle-tested, high-performance parsing.

## Features

- **Streaming parser** — files never fully buffered unless needed
- **Pluggable storage** — MemoryStorage (default) or DiskStorage, or bring your own
- **Security by default** — filename sanitization, path traversal prevention, prototype pollution protection
- **Size limits** — configurable per-file, total files, fields, and parts
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
      destination: './uploads',
      createDirectory: true,
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
    },
  })
);
```

## Storage Strategies

### MemoryStorage (Default)

Buffers file contents in memory. Best for small files or when you need immediate access to the buffer.

```typescript
import { MemoryStorage } from '@nextrush/multipart';

app.use(multipart({ storage: new MemoryStorage() }));

// Access the buffer
router.post('/upload', (ctx) => {
  const file = ctx.state.files[0];
  console.log(file.buffer); // Buffer
});
```

### DiskStorage

Writes files to the filesystem. Best for large files or persistent storage.

```typescript
import { DiskStorage } from '@nextrush/multipart';

app.use(
  multipart({
    storage: new DiskStorage({
      destination: './uploads',
      filename: (info) => `${Date.now()}-${info.sanitizedName}`,
      createDirectory: true,
    }),
  })
);

// Access the file path
router.post('/upload', (ctx) => {
  const file = ctx.state.files[0];
  console.log(file.path); // './uploads/1234567890-photo.jpg'
});
```

### Custom Storage

Implement the `StorageStrategy` interface:

```typescript
import type { StorageStrategy, StorageResult, FileInfo } from '@nextrush/multipart';
import type { Readable } from 'node:stream';

class S3Storage implements StorageStrategy {
  async handle(stream: Readable, info: FileInfo): Promise<StorageResult> {
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
| `limits.maxFileSize` | `number \| string` | `'5mb'` | Max size per file |
| `limits.maxFiles` | `number` | `10` | Max number of files |
| `limits.maxFields` | `number` | `50` | Max number of fields |
| `limits.maxParts` | `number` | `100` | Max total parts |
| `limits.maxFieldSize` | `number \| string` | `'1mb'` | Max size per field value |
| `limits.maxFieldNameSize` | `number` | `200` | Max field name length |
| `limits.maxHeaderPairs` | `number` | `2000` | Max header pairs per part |

## Accessing Uploaded Data

After the middleware runs, uploaded files and fields are available on `ctx.state`:

```typescript
router.post('/upload', (ctx) => {
  // Files
  for (const file of ctx.state.files) {
    file.fieldName;     // Form field name
    file.originalName;  // Client-provided filename
    file.sanitizedName; // Safe filename for storage
    file.mimeType;      // MIME type (e.g., 'image/png')
    file.encoding;      // Transfer encoding
    file.size;          // File size in bytes
    file.truncated;     // Whether the file was truncated (exceeded size limit)
    file.buffer;        // File contents (MemoryStorage only)
    file.path;          // File path on disk (DiskStorage only)
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
| `FILES_LIMIT_EXCEEDED` | 413 | Too many files |
| `FIELDS_LIMIT_EXCEEDED` | 413 | Too many fields |
| `PARTS_LIMIT_EXCEEDED` | 413 | Too many parts |
| `INVALID_CONTENT_TYPE` | 415 | Not a multipart/form-data request |
| `INVALID_FIELD_NAME` | 400 | Prototype pollution attempt |
| `INVALID_FILE_TYPE` | 415 | MIME type not in `allowedTypes` |
| `STORAGE_ERROR` | 500 | Storage strategy failure |
| `PARSE_ERROR` | 400 | Malformed multipart data |
| `REQUEST_ABORTED` | 499 | Client disconnected |

## Security

- **Path traversal prevention**: Filenames are stripped of directory components
- **Null byte injection**: Null bytes and control characters are replaced
- **Prototype pollution**: Field names like `__proto__`, `constructor`, `prototype` are rejected
- **Hidden file prevention**: Leading dots are stripped from filenames
- **Size limits**: All limits enforced at the streaming level

## Runtime Compatibility

| Runtime | Status | Notes |
|---------|--------|-------|
| Node.js 22+ | **Supported** | Native Node streams, full functionality |
| Bun | **Supported** | Via Bun's `node:stream` compatibility layer |
| Deno | **Supported** | Via Deno's Node compatibility layer |
| Edge (CF Workers, Vercel Edge) | **Not supported** | busboy requires `node:stream` and `node:events` |

> **Note**: This package uses busboy which depends on Node.js stream internals.
> Edge runtimes do not provide Node.js stream APIs. Use platform-native
> multipart parsing for edge deployments.

## License

MIT
