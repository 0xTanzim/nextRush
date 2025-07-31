# 📋 Request Enhancer

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Properties](#-properties)
  - [⚙️ Methods](#️-methods)
    - [🌐 Basic Request Info](#-basic-request-info)
    - [🔒 Security & Protocol](#-security--protocol)
    - [🍪 Cookie Handling](#-cookie-handling)
    - [🛡️ Validation & Sanitization](#️-validation--sanitization)
    - [🔍 Analytics & Fingerprinting](#-analytics--fingerprinting)
    - [🕵️ User Agent Parsing](#️-user-agent-parsing)
    - [⏱️ Timing & Performance](#️-timing--performance)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The `RequestEnhancer` class in the NextRush framework enhances the standard Node.js `IncomingMessage` object with additional properties and methods for easier request handling. It provides utilities for accessing request metadata, validating input, parsing cookies, security features, and advanced analytics capabilities.

## 🔧 Public APIs

### 📋 Properties

| Property          | Type                     | Description                                      |
| ----------------- | ------------------------ | ------------------------------------------------ |
| `params`          | `Record<string, string>` | Route parameters extracted from the URL          |
| `query`           | `ParsedUrlQuery`         | Query parameters parsed from the URL             |
| `body`            | `any`                    | Parsed request body (JSON, form data, etc.)      |
| `pathname`        | `string`                 | The pathname portion of the URL                  |
| `originalUrl`     | `string`                 | The original URL of the request                  |
| `path`            | `string`                 | Alias for pathname                               |
| `files`           | `Record<string, any>`    | Uploaded files (populated by file middleware)    |
| `cookies`         | `Record<string, string>` | Parsed cookies from the request                  |
| `session`         | `Record<string, any>`    | Session data associated with the request         |
| `locals`          | `Record<string, any>`    | Custom data attached to the request              |
| `startTime`       | `number`                 | Timestamp when the request was received          |
| `fresh`           | `boolean`                | Indicates if the request is fresh                |
| `stale`           | `boolean`                | Indicates if the request is stale                |
| `middlewareStack` | `string[]`               | Debug info about middleware execution (optional) |

### ⚙️ Methods

#### 🌐 Basic Request Info

| Method           | Signature                                        | Description                                       |
| ---------------- | ------------------------------------------------ | ------------------------------------------------- |
| `param(name)`    | `(name: string) => string \| undefined`          | Gets a route parameter by name                    |
| `header(name)`   | `(name: string) => string \| undefined`          | Gets a header value by name                       |
| `get(name)`      | `(name: string) => string \| undefined`          | Alias for `header()`                              |
| `is(type)`       | `(type: string) => boolean`                      | Checks if request Content-Type matches type       |
| `accepts(types)` | `(types: string \| string[]) => string \| false` | Checks if request accepts specified content types |

#### 🔒 Security & Protocol

| Method       | Signature       | Description                                          |
| ------------ | --------------- | ---------------------------------------------------- |
| `ip()`       | `() => string`  | Returns client IP (supports X-Forwarded-For headers) |
| `secure()`   | `() => boolean` | Checks if the request is secure (HTTPS)              |
| `protocol()` | `() => string`  | Returns the request protocol (`http` or `https`)     |
| `hostname()` | `() => string`  | Returns the hostname from request headers            |
| `fullUrl()`  | `() => string`  | Returns the complete URL of the request              |

#### 🍪 Cookie Handling

| Method           | Signature                      | Description                         |
| ---------------- | ------------------------------ | ----------------------------------- |
| `parseCookies()` | `() => Record<string, string>` | Parses cookies from request headers |

#### 🛡️ Validation & Sanitization

| Method                         | Signature                            | Description                                   |
| ------------------------------ | ------------------------------------ | --------------------------------------------- |
| `validate(rules)`              | `(rules: any) => any`                | Validates request data against provided rules |
| `sanitize(value, options)`     | `(value: any, options?: any) => any` | Sanitizes input data with specified options   |
| `sanitizeObject(obj, options)` | `(obj: any, options?: any) => any`   | Sanitizes an entire object recursively        |
| `sanitizeValue(value, rule)`   | `(value: any, rule: any) => any`     | Sanitizes a value based on validation rule    |
| `isValidEmail(email)`          | `(email: string) => boolean`         | Validates if string is a valid email address  |
| `isValidUrl(url)`              | `(url: string) => boolean`           | Validates if string is a valid URL            |

#### 🔍 Analytics & Fingerprinting

| Method          | Signature      | Description                                    |
| --------------- | -------------- | ---------------------------------------------- |
| `fingerprint()` | `() => string` | Generates a unique fingerprint for the request |

#### 🕵️ User Agent Parsing

| Method             | Signature                                                                                               | Description                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `userAgent()`      | `() => { raw: string, browser: string, os: string, device: string, isMobile: boolean, isBot: boolean }` | Parses and returns user agent information |
| `parseBrowser(ua)` | `(ua: string) => string`                                                                                | Extracts browser name from user agent     |
| `parseOS(ua)`      | `(ua: string) => string`                                                                                | Extracts operating system from user agent |
| `parseDevice(ua)`  | `(ua: string) => string`                                                                                | Extracts device type from user agent      |
| `isBot(ua)`        | `(ua: string) => boolean`                                                                               | Checks if user agent indicates a bot      |
| `isMobile(ua)`     | `(ua: string) => boolean`                                                                               | Checks if user agent indicates mobile     |

#### ⏱️ Timing & Performance

| Method               | Signature                                                                       | Description                            |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| `timing()`           | `() => { start: number, duration: number, timestamp: string }`                  | Returns timing information for request |
| `getRequestTiming()` | `() => { start: number, duration: number, timestamp: string }`                  | Alias for `timing()`                   |
| `rateLimit()`        | `() => { limit: number, remaining: number, reset: number, retryAfter: number }` | Returns rate limiting information      |

## 💻 Usage Examples

### Basic Request Information

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/info', (req, res) => {
  console.log('IP Address:', req.ip());
  console.log('Protocol:', req.protocol());
  console.log('Hostname:', req.hostname());
  console.log('Full URL:', req.fullUrl());
  console.log('Is Secure:', req.secure());

  res.json({
    ip: req.ip(),
    protocol: req.protocol(),
    hostname: req.hostname(),
    fullUrl: req.fullUrl(),
    secure: req.secure(),
  });
});
```

### Content Type Checking

```typescript
app.post('/upload', (req, res) => {
  if (req.is('json')) {
    console.log('JSON content detected');
  } else if (req.is('multipart')) {
    console.log('Multipart form data detected');
  }

  const acceptsJson = req.accepts(['json', 'html']);
  if (acceptsJson === 'json') {
    res.json({ message: 'JSON response' });
  } else {
    res.send('<h1>HTML Response</h1>');
  }
});
```

### Validation and Sanitization

```typescript
app.post('/register', (req, res) => {
  const validationRules = {
    email: {
      required: true,
      type: 'email',
      message: 'Please provide a valid email address',
    },
    name: {
      required: true,
      minLength: 3,
      maxLength: 50,
      sanitize: { trim: true, removeHtml: true },
    },
    age: {
      type: 'number',
      custom: (value: number) => value >= 18,
      message: 'Age must be 18 or older',
    },
  };

  const { isValid, errors, sanitized } = req.validate(validationRules);

  if (!isValid) {
    return res.status(400).json({ errors });
  }

  res.json({
    message: 'Registration successful',
    data: sanitized,
  });
});
```

### Manual Sanitization

```typescript
app.post('/sanitize', (req, res) => {
  const userInput = req.body.content;

  // Basic sanitization
  const cleaned = req.sanitize(userInput, {
    trim: true,
    removeHtml: true,
    escape: true,
  });

  // Object sanitization
  const cleanedObject = req.sanitizeObject(req.body, {
    trim: true,
    removeSpecialChars: true,
  });

  res.json({
    original: userInput,
    cleaned,
    cleanedObject,
  });
});
```

### User Agent Analysis

```typescript
app.get('/device-info', (req, res) => {
  const userAgentInfo = req.userAgent();
  const fingerprint = req.fingerprint();

  res.json({
    fingerprint,
    userAgent: userAgentInfo,
    isMobile: userAgentInfo.isMobile,
    isBot: userAgentInfo.isBot,
  });
});
```

### Request Timing and Performance

```typescript
app.get('/timing', (req, res) => {
  const timing = req.timing();
  const rateLimitInfo = req.rateLimit();

  res.json({
    timing,
    rateLimit: rateLimitInfo,
    performance: {
      requestDuration: timing.duration,
      timestamp: timing.timestamp,
    },
  });
});
```

### Cookie Handling

```typescript
app.get('/profile', (req, res) => {
  const cookies = req.parseCookies();
  const sessionId = cookies.sessionId;
  const preferences = cookies.preferences;

  if (!sessionId) {
    return res.status(401).json({ error: 'No session found' });
  }

  res.json({
    sessionId,
    preferences: preferences ? JSON.parse(preferences) : {},
    allCookies: Object.keys(cookies),
  });
});
```

## ⚙️ Configuration Options

The `RequestEnhancer` is automatically applied to all requests by the `Application` class. No additional configuration is required, but you can customize behavior through validation rules and sanitization options:

### Validation Rules

```typescript
const validationRules = {
  fieldName: {
    required: boolean, // Field is mandatory
    type: 'email' | 'url' | 'number', // Built-in type validation
    minLength: number, // Minimum string length
    maxLength: number, // Maximum string length
    custom: (value) => boolean, // Custom validation function
    message: string, // Custom error message
    sanitize: SanitizeOptions, // Sanitization options
  },
};
```

### Sanitization Options

```typescript
const sanitizeOptions = {
  trim: boolean, // Remove leading/trailing whitespace
  lowercase: boolean, // Convert to lowercase
  uppercase: boolean, // Convert to uppercase
  removeHtml: boolean, // Strip HTML tags
  escape: boolean, // Escape HTML entities
  removeSpecialChars: boolean, // Remove special characters
};
```

## 📝 Notes

- **Automatic Enhancement**: The `RequestEnhancer` is automatically applied to all incoming requests by the `Application` class
- **IP Detection**: The `ip()` method supports proxy headers (`X-Forwarded-For`, `X-Real-IP`) for accurate client IP detection
- **Cookie Parsing**: Cookies are automatically parsed and available via the `cookies` property and `parseCookies()` method
- **Validation Framework**: The `validate()` method provides comprehensive validation with custom rules and automatic sanitization
- **Security Features**: Built-in protection against common attacks through sanitization and validation
- **Performance Tracking**: Request timing and performance metrics are automatically tracked
- **User Agent Analysis**: Comprehensive user agent parsing for device detection and analytics
- **Rate Limiting**: Rate limit information is available (when rate limiting middleware is active)
- **Memory Efficiency**: Enhancement is done in-place without creating new objects
- **Type Safety**: Full TypeScript support with proper type definitions for all methods and properties
