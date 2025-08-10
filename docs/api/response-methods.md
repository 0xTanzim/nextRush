# 📤 Response Methods - Complete API Reference

> **41 Enhanced Response Methods for NextRush v2**

NextRush v2 provides 41 comprehensive response methods that combine the best of Express.js with modern enhancements, all accessible via `ctx.res.*` or through convenient `ctx.*` shortcuts.

## 📋 **Table of Contents**

- [🚀 Convenience Methods (Recommended)](#-convenience-methods-recommended)
- [📝 Core Response Methods](#-core-response-methods)
- [📄 File Operations](#-file-operations)
- [🔄 Redirect Methods](#-redirect-methods)
- [🏷️ Header Management](#️-header-management)
- [🍪 Cookie Operations](#-cookie-operations)
- [🎨 Template Rendering](#-template-rendering)
- [💾 Cache Control](#-cache-control)
- [🌐 CORS & Security](#-cors--security)
- [📊 API Response Helpers](#-api-response-helpers)
- [🔧 Utility Methods](#-utility-methods)
- [⚡ Performance Methods](#-performance-methods)
- [🎯 Method Reference](#-method-reference-all-41-methods)

---

## 🚀 **Convenience Methods (Recommended)**

_These methods provide better developer experience for 99% use cases_

### **ctx.json(data: unknown): void**

Send JSON response with proper content-type.

```typescript
app.get('/api/users', ctx => {
  ctx.json({ users: [], total: 0 }); // ✅ Clean & simple!
});
```

### **ctx.send(data: string | Buffer | object): void**

Smart send with auto content-type detection.

```typescript
app.get('/api/data', ctx => {
  ctx.send({ data: 'object' }); // → JSON
  ctx.send('Hello World'); // → Text
  ctx.send(buffer); // → Binary
});
```

### **ctx.redirect(url: string, status?: number): void**

Simple redirects with optional status code.

```typescript
app.post('/login', ctx => {
  ctx.redirect('/dashboard'); // 302 redirect
  ctx.redirect('/moved', 301); // 301 redirect
});
```

### **ctx.cookie(name: string, value: string, options?: CookieOptions): NextRushResponse**

Easy cookie setting with options.

```typescript
app.post('/auth', ctx => {
  ctx.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000, // 1 hour
  });
});
```

---

## 📝 **Core Response Methods**

### **ctx.res.json(data: unknown): void**

Send JSON response with proper headers.

```typescript
app.get('/api/users', ctx => {
  ctx.res.json({
    users: [{ id: 1, name: 'John' }],
    meta: { total: 1, page: 1 },
  });
});
```

### **ctx.res.send(data: string | Buffer | object): void**

Smart response method that detects content type.

```typescript
app.get('/api/smart', ctx => {
  ctx.res.send({ data: 'auto-detected as JSON' });
  ctx.res.send('Plain text response');
  ctx.res.send(Buffer.from('binary data'));
});
```

### **ctx.res.html(data: string): void**

Send HTML response with correct content-type.

```typescript
app.get('/page', ctx => {
  ctx.res.html(`
    <html>
      <body><h1>Welcome!</h1></body>
    </html>
  `);
});
```

### **ctx.res.text(data: string): void**

Send plain text response.

```typescript
app.get('/api/message', ctx => {
  ctx.res.text('Hello, World!');
});
```

### **ctx.res.xml(data: string): void**

Send XML response with correct content-type.

```typescript
app.get('/api/feed', ctx => {
  ctx.res.xml(`
    <?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>My Feed</title>
      </channel>
    </rss>
  `);
});
```

### **ctx.res.csv(data: unknown[], filename?: string): void**

Send CSV response with optional download filename.

```typescript
app.get('/api/export', ctx => {
  const users = [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 },
  ];
  ctx.res.csv(users, 'users.csv');
});
```

### **ctx.res.stream(stream: NodeJS.ReadableStream, contentType?: string): void**

Stream response data.

```typescript
app.get('/api/large-file', ctx => {
  const readStream = createReadStream('large-file.json');
  ctx.res.stream(readStream, 'application/json');
});
```

---

## 📄 **File Operations**

### **ctx.res.sendFile(filePath: string, options?: FileOptions): void**

Send file with automatic content-type detection.

```typescript
app.get('/download/:filename', ctx => {
  const filename = ctx.params.filename;
  ctx.res.sendFile(`/files/${filename}`, {
    root: '/var/app/public',
    etag: true,
  });
});
```

### **ctx.res.file(filePath: string, options?: FileOptions): NextRushResponse**

Send file with method chaining support.

```typescript
app.get('/image/:id', ctx => {
  ctx.res.cache(3600).file(`/images/${ctx.params.id}.jpg`);
});
```

### **ctx.res.download(filePath: string, filename?: string, options?: FileOptions): void**

Force file download with optional custom filename.

```typescript
app.get('/api/report', ctx => {
  ctx.res.download('/reports/monthly.pdf', 'January-Report.pdf');
});
```

---

## 🔄 **Redirect Methods**

### **ctx.res.redirect(url: string, status?: number): void**

Standard redirect with optional status code.

```typescript
app.post('/login', ctx => {
  if (user.isValid) {
    ctx.res.redirect('/dashboard', 302);
  } else {
    ctx.res.redirect('/login?error=invalid');
  }
});
```

### **ctx.res.redirectPermanent(url: string): void**

301 permanent redirect.

```typescript
app.get('/old-page', ctx => {
  ctx.res.redirectPermanent('/new-page');
});
```

### **ctx.res.redirectTemporary(url: string): void**

307 temporary redirect (preserves HTTP method).

```typescript
app.post('/api/v1/users', ctx => {
  ctx.res.redirectTemporary('/api/v2/users');
});
```

---

## 🏷️ **Header Management**

### **ctx.res.status(code: number): NextRushResponse**

Set HTTP status code with method chaining.

```typescript
app.post('/api/users', ctx => {
  ctx.res.status(201).json({ user: newUser });
});
```

### **ctx.res.set(field: string | Record<string, string>, value?: string): NextRushResponse**

Set response headers.

```typescript
app.get('/api/data', ctx => {
  ctx.res
    .set('X-API-Version', '2.0')
    .set({
      'X-Request-ID': ctx.id,
      'X-Response-Time': `${Date.now() - ctx.startTime}ms`,
    })
    .json({ data: 'response' });
});
```

### **ctx.res.header(field: string, value: string): NextRushResponse**

Set single header with method chaining.

```typescript
app.get('/api/files', ctx => {
  ctx.res
    .header('Content-Disposition', 'attachment')
    .header('X-Download-Count', downloadCount.toString())
    .sendFile(filePath);
});
```

### **ctx.res.type(type: string): NextRushResponse**

Set Content-Type header.

```typescript
app.get('/api/custom', ctx => {
  ctx.res.type('application/vnd.api+json').send(jsonApiData);
});
```

### **ctx.res.length(length: number): NextRushResponse**

Set Content-Length header.

```typescript
app.get('/api/binary', ctx => {
  ctx.res.length(buffer.length).send(buffer);
});
```

### **ctx.res.etag(etag: string): NextRushResponse**

Set ETag header for caching.

```typescript
app.get('/api/data/:id', ctx => {
  const data = await getData(ctx.params.id);
  const etag = generateETag(data);

  ctx.res.etag(etag).json(data);
});
```

### **ctx.res.lastModified(date: Date): NextRushResponse**

Set Last-Modified header.

```typescript
app.get('/api/content/:id', ctx => {
  const content = await getContent(ctx.params.id);

  ctx.res.lastModified(content.updatedAt).json(content);
});
```

### **ctx.res.get(field: string): string | undefined**

Get header value.

```typescript
app.use(async (ctx, next) => {
  await next();

  const contentType = ctx.res.get('content-type');
  console.log(`Response type: ${contentType}`);
});
```

### **ctx.res.removeHeader(field: string): NextRushResponse**

### **ctx.res.remove(field: string): NextRushResponse**

Remove response headers.

```typescript
app.get('/api/clean', ctx => {
  ctx.res
    .remove('X-Powered-By')
    .removeHeader('Server')
    .json({ data: 'clean response' });
});
```

---

## 🍪 **Cookie Operations**

### **ctx.res.cookie(name: string, value: string, options?: CookieOptions): NextRushResponse**

Set cookies with extensive options.

```typescript
app.post('/login', ctx => {
  ctx.res
    .cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      domain: '.example.com',
    })
    .cookie('preferences', JSON.stringify(userPrefs), {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
    .json({ success: true });
});
```

### **ctx.res.clearCookie(name: string, options?: CookieOptions): NextRushResponse**

Clear/delete cookies.

```typescript
app.post('/logout', ctx => {
  ctx.res
    .clearCookie('sessionId')
    .clearCookie('preferences')
    .redirect('/login');
});
```

---

## 🎨 **Template Rendering**

### **ctx.res.render(template: string, data?: unknown): void**

Render templates with data.

```typescript
app.get('/profile', ctx => {
  const user = ctx.state.user;
  ctx.res.render('profile.html', {
    user,
    title: `${user.name}'s Profile`,
  });
});
```

---

## 💾 **Cache Control**

### **ctx.res.cache(seconds: number): NextRushResponse**

Set cache headers for specified duration.

```typescript
app.get('/api/static-data', ctx => {
  ctx.res
    .cache(3600) // Cache for 1 hour
    .json(staticData);
});
```

### **ctx.res.noCache(): NextRushResponse**

Disable caching with appropriate headers.

```typescript
app.get('/api/sensitive', ctx => {
  ctx.res.noCache().json(sensitiveData);
});
```

---

## 🌐 **CORS & Security**

### **ctx.res.cors(origin?: string): NextRushResponse**

Set CORS headers.

```typescript
app.get('/api/public', ctx => {
  ctx.res
    .cors('*') // Allow all origins
    .json(publicData);
});

app.get('/api/restricted', ctx => {
  ctx.res.cors('https://trusted-domain.com').json(restrictedData);
});
```

### **ctx.res.security(): NextRushResponse**

Add security headers (XSS protection, frame options, etc.).

```typescript
app.get('/secure-page', ctx => {
  ctx.res.security().html(securePageHtml);
});
```

---

## 📊 **API Response Helpers**

### **ctx.res.success(data: unknown, message?: string): void**

Structured success response.

```typescript
app.post('/api/users', ctx => {
  const user = await createUser(ctx.body);
  ctx.res.success(user, 'User created successfully');
  // Output: { success: true, data: user, message: '...' }
});
```

### **ctx.res.error(message: string, code?: number, details?: unknown): void**

Structured error response.

```typescript
app.get('/api/users/:id', ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.res.error('User not found', 404);
    // Output: { success: false, error: 'User not found', code: 404 }
    return;
  }

  ctx.res.success(user);
});
```

### **ctx.res.paginate(data: unknown[], page: number, limit: number, total: number): void**

Paginated response with metadata.

```typescript
app.get('/api/users', ctx => {
  const page = parseInt(ctx.query.page as string) || 1;
  const limit = parseInt(ctx.query.limit as string) || 10;

  const { users, total } = await getUsersPaginated(page, limit);

  ctx.res.paginate(users, page, limit, total);
  // Output: {
  //   data: users,
  //   pagination: { page, limit, total, totalPages, hasNext, hasPrev }
  // }
});
```

---

## 🔧 **Utility Methods**

### **ctx.res.getContentTypeFromExtension(ext: string): string**

Get MIME type from file extension.

```typescript
app.get('/api/file-info', ctx => {
  const extension = '.pdf';
  const mimeType = ctx.res.getContentTypeFromExtension(extension);
  // Returns: 'application/pdf'

  ctx.json({ extension, mimeType });
});
```

### **ctx.res.getSmartContentType(filePath: string): string**

Smart content type detection from file path.

```typescript
app.get('/serve/:filename', ctx => {
  const filePath = `/files/${ctx.params.filename}`;
  const contentType = ctx.res.getSmartContentType(filePath);

  ctx.res.type(contentType).sendFile(filePath);
});
```

### **ctx.res.generateETag(stats: unknown): string**

Generate ETag from file stats or data.

```typescript
app.get('/api/data/:id', ctx => {
  const data = await getData(ctx.params.id);
  const etag = ctx.res.generateETag(data);

  ctx.res.etag(etag).json(data);
});
```

### **ctx.res.convertToCSV(data: unknown[]): string**

Convert array of objects to CSV string.

```typescript
app.get('/api/export-manual', ctx => {
  const users = await getUsers();
  const csvData = ctx.res.convertToCSV(users);

  ctx.res
    .type('text/csv')
    .header('Content-Disposition', 'attachment; filename="users.csv"')
    .send(csvData);
});
```

### **ctx.res.getNestedValue(obj: unknown, path: string): unknown**

Get nested object property safely.

```typescript
app.get('/api/nested', ctx => {
  const user = { profile: { settings: { theme: 'dark' } } };
  const theme = ctx.res.getNestedValue(user, 'profile.settings.theme');

  ctx.json({ theme }); // { theme: 'dark' }
});
```

### **ctx.res.isTruthy(value: unknown): boolean**

Check if value is truthy.

```typescript
app.get('/api/check', ctx => {
  const values = ['', 0, false, 'hello', null, undefined, []];
  const results = values.map(val => ({
    value: val,
    isTruthy: ctx.res.isTruthy(val),
  }));

  ctx.json(results);
});
```

---

## ⚡ **Performance Methods**

### **ctx.res.compress(): NextRushResponse**

Hint that response should be compressed.

```typescript
app.get('/api/large-data', ctx => {
  const largeData = await getLargeDataset();

  ctx.res.compress().json(largeData);
});
```

### **ctx.res.time(label?: string): NextRushResponse**

Performance timing helper.

```typescript
app.get('/api/timed', ctx => {
  ctx.res.time('database-query');
  const data = await queryDatabase();

  ctx.res
    .time() // Logs timing
    .json(data);
});
```

---

## 🎯 **Method Reference (All 41 Methods)**

### **Response Content**

1. `json(data)` - Send JSON response
2. `send(data)` - Smart send with auto-detection
3. `html(data)` - Send HTML response
4. `text(data)` - Send text response
5. `xml(data)` - Send XML response
6. `csv(data, filename?)` - Send CSV response
7. `stream(stream, contentType?)` - Stream response

### **File Operations**

8. `sendFile(path, options?)` - Send file
9. `file(path, options?)` - Send file with chaining
10. `download(path, filename?, options?)` - Force download

### **Redirects**

11. `redirect(url, status?)` - Standard redirect
12. `redirectPermanent(url)` - 301 redirect
13. `redirectTemporary(url)` - 307 redirect

### **Status & Headers**

14. `status(code)` - Set status code
15. `set(field, value)` - Set headers
16. `header(field, value)` - Set single header
17. `type(type)` - Set content-type
18. `length(length)` - Set content-length
19. `etag(etag)` - Set ETag
20. `lastModified(date)` - Set last-modified
21. `get(field)` - Get header value
22. `removeHeader(field)` - Remove header
23. `remove(field)` - Remove header (alias)

### **Cookies**

24. `cookie(name, value, options?)` - Set cookie
25. `clearCookie(name, options?)` - Clear cookie

### **Templates**

26. `render(template, data?)` - Render template

### **Caching**

27. `cache(seconds)` - Set cache headers
28. `noCache()` - Disable caching

### **CORS & Security**

29. `cors(origin?)` - Set CORS headers
30. `security()` - Add security headers

### **API Helpers**

31. `success(data, message?)` - Structured success
32. `error(message, code?, details?)` - Structured error
33. `paginate(data, page, limit, total)` - Paginated response

### **Utilities**

34. `getContentTypeFromExtension(ext)` - Get MIME type
35. `getSmartContentType(path)` - Smart content detection
36. `generateETag(stats)` - Generate ETag
37. `convertToCSV(data)` - Convert to CSV
38. `getNestedValue(obj, path)` - Get nested property
39. `isTruthy(value)` - Check truthiness

### **Performance**

40. `compress()` - Compression hint
41. `time(label?)` - Performance timing

---

## 🚀 **Best Practices**

### **Use Convenience Methods First**

```typescript
// ✅ RECOMMENDED: Use convenience methods for common operations
app.get('/api/users', ctx => {
  ctx.json({ users: [] }); // Instead of ctx.res.json()
});

// ✅ ALSO GOOD: Use ctx.res.* for advanced scenarios
app.get('/api/advanced', ctx => {
  ctx.res
    .status(201)
    .cache(3600)
    .cors('*')
    .security()
    .json({ data: 'advanced' });
});
```

### **Method Chaining for Complex Responses**

```typescript
app.get('/api/file', ctx => {
  ctx.res
    .status(200)
    .cache(3600)
    .cors('*')
    .security()
    .header('X-Custom', 'value')
    .cookie('tracking', 'abc123')
    .json({ file: 'data' });
});
```

### **Error Handling Pattern**

```typescript
app.get('/api/users/:id', ctx => {
  try {
    const user = await userService.findById(ctx.params.id);

    if (!user) {
      ctx.res.error('User not found', 404);
      return;
    }

    ctx.res.success(user, 'User retrieved successfully');
  } catch (error) {
    ctx.res.error('Internal server error', 500, error.message);
  }
});
```

---

**🎯 NextRush v2: 41 Enhanced Response Methods = Complete Express.js compatibility + Modern web framework power!**
