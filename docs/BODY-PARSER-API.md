# 🔧 Body Parser API Reference

> **Complete API Documentation for NextRush Body Parser** 📚

## 📋 Quick Reference

| Method                 | Description                | Example                                   |
| ---------------------- | -------------------------- | ----------------------------------------- |
| `UltimateBodyParser()` | Create new parser instance | `new UltimateBodyParser(options)`         |
| `parse(request)`       | Parse request body         | `await parser.parse(req)`                 |
| `middleware()`         | Express-style middleware   | `app.use(parser.middleware())`            |
| `json()`               | JSON-only middleware       | `app.post('/api', parser.json())`         |
| `urlencoded()`         | Form-only middleware       | `app.post('/form', parser.urlencoded())`  |
| `multipart()`          | Upload-only middleware     | `app.post('/upload', parser.multipart())` |
| `text()`               | Text-only middleware       | `app.post('/text', parser.text())`        |
| `raw()`                | Raw buffer middleware      | `app.post('/binary', parser.raw())`       |

## 🏗️ Constructor

### `new UltimateBodyParser(options?)`

Creates a new Ultimate Body Parser instance.

```typescript
const parser = new UltimateBodyParser({
  maxSize: 50 * 1024 * 1024, // 🔢 Max body size (50MB)
  encoding: 'utf8', // 📝 Text encoding
  strict: false, // 🛡️ Strict type checking
  preserveRaw: false, // 💾 Keep original buffer
  timeout: 30000, // ⏱️ Parse timeout (30s)
  bufferPool: true, // 🔄 Enable buffer pooling
  streaming: false, // 📊 Enable streaming mode
});
```

#### Options

| Property      | Type      | Default  | Description                              |
| ------------- | --------- | -------- | ---------------------------------------- |
| `maxSize`     | `number`  | `50MB`   | 🔢 Maximum body size in bytes            |
| `encoding`    | `string`  | `'utf8'` | 📝 Text encoding for string conversion   |
| `strict`      | `boolean` | `false`  | 🛡️ Enable strict type validation         |
| `preserveRaw` | `boolean` | `false`  | 💾 Keep original buffer in `req.rawBody` |
| `timeout`     | `number`  | `30000`  | ⏱️ Parse timeout in milliseconds         |
| `bufferPool`  | `boolean` | `true`   | 🔄 Enable buffer reuse for performance   |
| `streaming`   | `boolean` | `false`  | 📊 Use streaming for large uploads       |

## 🎯 Core Methods

### `parse(request): Promise<ParseResult>`

Parses the request body and returns a detailed result.

```typescript
const result = await parser.parse(request);

// 📦 Result structure
interface ParseResult {
  success: boolean; // ✅ Parse success status
  parser: string; // 🎯 Parser used ('json', 'form', etc.)
  contentType: string; // 📋 Request content type
  size: number; // 📏 Body size in bytes
  data: any; // 🎁 Parsed data
  timestamp: string; // ⏰ Parse timestamp
  duration: number; // ⚡ Parse duration in ms
  error?: ParseError; // ❌ Error details (if failed)
}
```

**Example:**

```typescript
app.post('/api/parse', async (req, res) => {
  try {
    const result = await parser.parse(req);
    console.log(`🎯 Used ${result.parser} parser (${result.duration}ms)`);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### `middleware(options?): Function`

Returns Express-compatible middleware for automatic parsing.

```typescript
// 🌟 Global middleware (recommended)
app.use(parser.middleware());

// 🎯 Route-specific middleware
app.post('/api/data', parser.middleware({ maxSize: 1024 }), (req, res) => {
  console.log('📦 Parsed:', req.body);
  res.json({ received: req.body });
});

// 🛡️ With error handling
app.use(
  parser.middleware({
    onError: (error, req, res, next) => {
      console.error('❌ Parse error:', error.message);
      res.status(400).json({
        error: 'Invalid request format',
        details: error.message,
      });
    },
  })
);
```

## 🧬 Parser-Specific Methods

### `json(options?): Function`

JSON-only parsing middleware.

```typescript
app.post(
  '/api/json',
  parser.json({
    strict: true, // 🛡️ Strict JSON validation
    maxSize: 10 * 1024, // 🔢 10KB limit
    allowEmpty: false, // ❌ Reject empty bodies
  }),
  (req, res) => {
    // req.body is guaranteed to be valid JSON ✨
    res.json({ processed: req.body });
  }
);
```

#### JSON Options

| Property     | Type       | Default     | Description                    |
| ------------ | ---------- | ----------- | ------------------------------ |
| `strict`     | `boolean`  | `false`     | 🛡️ Strict JSON validation      |
| `maxSize`    | `number`   | `50MB`      | 🔢 Maximum JSON size           |
| `allowEmpty` | `boolean`  | `true`      | ✅ Allow empty request bodies  |
| `reviver`    | `function` | `undefined` | 🔄 JSON.parse reviver function |

### `urlencoded(options?): Function`

Form data parsing middleware.

```typescript
app.post(
  '/forms/submit',
  parser.urlencoded({
    extended: true, // 🎯 Parse nested objects
    maxFields: 100, // 🔢 Max form fields
    maxFieldSize: 1024, // 📏 Max field value size
  }),
  (req, res) => {
    // req.body contains form data ✨
    res.redirect('/success');
  }
);
```

#### URL-Encoded Options

| Property       | Type      | Default | Description                        |
| -------------- | --------- | ------- | ---------------------------------- |
| `extended`     | `boolean` | `true`  | 🎯 Parse nested objects and arrays |
| `maxFields`    | `number`  | `1000`  | 🔢 Maximum number of fields        |
| `maxFieldSize` | `number`  | `100KB` | 📏 Maximum field value size        |
| `arrayLimit`   | `number`  | `100`   | 📊 Maximum array elements          |

### `multipart(options?): Function`

File upload parsing middleware.

```typescript
app.post(
  '/upload',
  parser.multipart({
    maxFiles: 5, // 🔢 Max files per request
    maxFileSize: 50 * 1024 * 1024, // 📏 50MB per file
    allowedTypes: ['image/*', 'application/pdf'], // 🎭 Allowed MIME types
    tempDir: '/tmp/uploads', // 📁 Temporary directory
  }),
  (req, res) => {
    // req.body contains files and fields ✨
    const { file, title } = req.body;
    console.log(`📦 Uploaded: ${file.filename} (${file.data.length} bytes)`);
    res.json({ success: true });
  }
);
```

#### Multipart Options

| Property         | Type       | Default       | Description                  |
| ---------------- | ---------- | ------------- | ---------------------------- |
| `maxFiles`       | `number`   | `10`          | 🔢 Maximum files per request |
| `maxFileSize`    | `number`   | `50MB`        | 📏 Maximum size per file     |
| `maxTotalSize`   | `number`   | `200MB`       | 📊 Maximum total upload size |
| `allowedTypes`   | `string[]` | `['*/*']`     | 🎭 Allowed MIME types        |
| `tempDir`        | `string`   | `os.tmpdir()` | 📁 Temporary file directory  |
| `keepExtensions` | `boolean`  | `true`        | 🔤 Preserve file extensions  |

### `text(options?): Function`

Plain text parsing middleware.

```typescript
app.post(
  '/api/text',
  parser.text({
    encoding: 'utf8', // 📝 Text encoding
    maxSize: 1024, // 🔢 1KB limit
    type: 'text/plain', // 🎭 Expected content type
  }),
  (req, res) => {
    // req.body is a string ✨
    console.log('📄 Text:', req.body);
    res.send(`Received: ${req.body.length} characters`);
  }
);
```

#### Text Options

| Property   | Type     | Default    | Description              |
| ---------- | -------- | ---------- | ------------------------ |
| `encoding` | `string` | `'utf8'`   | 📝 Character encoding    |
| `maxSize`  | `number` | `50MB`     | 🔢 Maximum text size     |
| `type`     | `string` | `'text/*'` | 🎭 Expected content type |

### `raw(options?): Function`

Raw buffer parsing middleware.

```typescript
app.post(
  '/api/binary',
  parser.raw({
    maxSize: 10 * 1024 * 1024, // 🔢 10MB limit
    type: 'application/octet-stream', // 🎭 Expected type
  }),
  (req, res) => {
    // req.body is a Buffer ✨
    console.log('🔢 Binary data:', req.body.length, 'bytes');
    res.json({ size: req.body.length });
  }
);
```

#### Raw Options

| Property  | Type     | Default | Description              |
| --------- | -------- | ------- | ------------------------ |
| `maxSize` | `number` | `50MB`  | 🔢 Maximum buffer size   |
| `type`    | `string` | `'*/*'` | 🎭 Expected content type |

## 📊 Static Methods

### `UltimateBodyParser.registerParser(ParserClass)`

Register a custom parser type.

```typescript
class XMLParser extends BaseParser {
  name = 'xml';

  canParse(contentType: string): boolean {
    return contentType.includes('application/xml');
  }

  async parse(request: Request): Promise<any> {
    const text = await this.readText(request);
    return this.parseXML(text); // Your XML parsing logic
  }
}

// 🔧 Register the custom parser
UltimateBodyParser.registerParser(XMLParser);
```

### `UltimateBodyParser.getRegisteredParsers(): string[]`

Get list of all registered parser names.

```typescript
const parsers = UltimateBodyParser.getRegisteredParsers();
console.log('🎯 Available parsers:', parsers);
// Output: ['json', 'urlencoded', 'multipart', 'text', 'raw', 'xml']
```

### `UltimateBodyParser.createRequest(data, options?)`

Create a mock request for testing.

```typescript
// 🧪 For unit testing
const mockReq = UltimateBodyParser.createRequest(
  { name: 'NextRush', version: '1.0.0' },
  { contentType: 'application/json' }
);

const result = await parser.parse(mockReq);
expect(result.data.name).toBe('NextRush');
```

## 🛡️ Error Handling

### Error Types

```typescript
// 📦 Parse Error Structure
interface ParseError extends Error {
  type: string; // 🏷️ Error type
  code: string; // 🔢 Error code
  details?: string; // 🔍 Additional details
  parser?: string; // 🎯 Parser that failed
  contentType?: string; // 📋 Request content type
  size?: number; // 📏 Request size
}
```

### Common Error Types

| Type                     | Code  | Description                        |
| ------------------------ | ----- | ---------------------------------- |
| `PAYLOAD_TOO_LARGE`      | `413` | 🔢 Request body exceeds size limit |
| `INVALID_JSON`           | `400` | 📝 Malformed JSON syntax           |
| `INVALID_FORM_DATA`      | `400` | 📋 Invalid URL-encoded data        |
| `MULTIPART_ERROR`        | `400` | 📦 Multipart parsing failed        |
| `UNSUPPORTED_MEDIA_TYPE` | `415` | 🎭 Unsupported content type        |
| `PARSE_TIMEOUT`          | `408` | ⏱️ Parsing took too long           |
| `ENCODING_ERROR`         | `400` | 📝 Text encoding failed            |

### Error Handling Examples

```typescript
// 🛡️ Global error handler
app.use((error, req, res, next) => {
  if (error.type === 'PAYLOAD_TOO_LARGE') {
    return res.status(413).json({
      error: 'File too large',
      maxSize: '50MB',
      yourSize: `${Math.round(error.size / 1024 / 1024)}MB`,
    });
  }

  if (error.type === 'INVALID_JSON') {
    return res.status(400).json({
      error: 'Invalid JSON format',
      details: error.details,
      line: error.line,
      column: error.column,
    });
  }

  // 🎭 Generic error
  res.status(500).json({
    error: 'Parsing failed',
    message: error.message,
  });
});

// 🎯 Route-specific error handling
app.post('/api/data', (req, res) => {
  try {
    if (req.bodyParseError) {
      throw req.bodyParseError;
    }

    // ✨ Process parsed data
    res.json({ received: req.body });
  } catch (error) {
    console.error('❌ Processing error:', error);
    res.status(400).json({
      error: 'Request processing failed',
      type: error.type || 'UNKNOWN',
      details: error.message,
    });
  }
});
```

## 🎯 TypeScript Definitions

```typescript
// 🎯 Core interfaces
interface UltimateBodyParserOptions {
  maxSize?: number;
  encoding?: string;
  strict?: boolean;
  preserveRaw?: boolean;
  timeout?: number;
  bufferPool?: boolean;
  streaming?: boolean;
}

interface ParseResult<T = any> {
  success: boolean;
  parser: 'json' | 'urlencoded' | 'multipart' | 'text' | 'raw';
  contentType: string;
  size: number;
  data: T;
  timestamp: string;
  duration: number;
  error?: ParseError;
}

interface ParsedFile {
  filename: string;
  contentType: string;
  data: Buffer;
  size: number;
  encoding?: string;
}

interface MultipartResult {
  [fieldName: string]: string | ParsedFile | Array<string | ParsedFile>;
}

// 🎯 Extended request interface
interface NextRushRequest extends IncomingMessage {
  body?: any;
  rawBody?: Buffer;
  bodyParseError?: ParseError;
  bodyParser?: string;
  files?: { [fieldName: string]: ParsedFile | ParsedFile[] };
}
```

## 🧪 Testing Utilities

### Mock Request Creation

```typescript
import { UltimateBodyParser } from 'nextrush';

// 📝 JSON mock
const jsonReq = UltimateBodyParser.createRequest(
  { name: 'test', value: 123 },
  { contentType: 'application/json' }
);

// 📋 Form mock
const formReq = UltimateBodyParser.createRequest('name=test&value=123', {
  contentType: 'application/x-www-form-urlencoded',
});

// 📄 Text mock
const textReq = UltimateBodyParser.createRequest('Hello NextRush!', {
  contentType: 'text/plain',
});

// 🔢 Buffer mock
const bufferReq = UltimateBodyParser.createRequest(Buffer.from('binary data'), {
  contentType: 'application/octet-stream',
});
```

### Test Helpers

```typescript
// 🧪 Test helper functions
export const TestHelpers = {
  // ✅ Assert successful parsing
  assertParsed(result: ParseResult, expectedParser: string) {
    expect(result.success).toBe(true);
    expect(result.parser).toBe(expectedParser);
    expect(result.error).toBeUndefined();
  },

  // ❌ Assert parsing error
  assertParseError(result: ParseResult, expectedType: string) {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.type).toBe(expectedType);
  },

  // 📊 Create large test data
  createLargeJSON(sizeInMB: number) {
    const targetSize = sizeInMB * 1024 * 1024;
    const data = { items: [] };
    while (JSON.stringify(data).length < targetSize) {
      data.items.push(`item-${data.items.length}`);
    }
    return data;
  },
};
```

---

## 🎉 That's Everything!

You now have the complete API reference for the Ultimate Body Parser! 🚀

**Key Points to Remember:**

- 🎯 **Auto-detection works 99.9% of the time** - just use `parser.middleware()`
- 🛡️ **Always handle errors gracefully** - parsing can fail
- 📊 **Set appropriate limits** for your use case
- 🧪 **Test with real data** from your application
- ⚡ **Monitor performance** in production

---

**📚 Related Documentation:**

- [Body Parser Ultimate Guide](./BODY-PARSER-ULTIMATE.md)
- [Implementation Guide](./BODY-PARSER-GUIDE.md)
- [API Reference](./API-REFERENCE.md)

_Built with ❤️ by the NextRush Team_ 🚀
