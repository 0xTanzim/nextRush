---
description: 'API reference documentation standards for NextRush packages. Defines consistent format for documenting functions, types, interfaces, and examples across all NextRush packages.'
applyTo: 'apps/docs/src/api/**/*.md, apps/docs/src/packages/**/*.md, docs/api/**/*.md, packages/**/docs/**/*.md, *.md'
---

# NextRush API Documentation Standards

This instruction file defines how to write **API reference documentation** for NextRush packages.

API docs are lookup material, not learning material. Optimize for **findability and precision**.

---

## Core Principles

### 1. Scannable, Not Readable

API docs are scanned, not read. Design for:
- Quick visual scanning
- Predictable structure
- Copy-paste examples

### 2. Complete, Not Minimal

Include everything a developer needs:
- All parameters
- All return values
- All type definitions
- Working examples

### 3. Accurate, Not Aspirational

Document what exists today:
- Test all code examples
- Verify default values against source
- Update when code changes

---

## Function Documentation Template

Every exported function must be documented as follows:

```markdown
### `functionName(param1, param2, options?)`

[One sentence describing what this function does and when to use it.]

**Signature:**

```typescript
function functionName(
  param1: ParamType,
  param2: AnotherType,
  options?: OptionsType
): ReturnType
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `param1` | `ParamType` | Yes | - | What this parameter does |
| `param2` | `AnotherType` | Yes | - | What this parameter does |
| `options` | `OptionsType` | No | `{}` | Configuration options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option1` | `string` | `'default'` | What this option does |
| `option2` | `number` | `100` | What this option does |
| `option3` | `boolean` | `false` | What this option does |

**Returns:**

`ReturnType` - Description of what is returned

**Throws:**

| Error | Condition |
|-------|-----------|
| `TypeError` | When param1 is not a string |
| `RangeError` | When param2 is negative |

**Example:**

```typescript
import { functionName } from '@nextrush/package';

// Basic usage
const result = functionName('value', 42);

// With options
const result = functionName('value', 42, {
  option1: 'custom',
  option2: 200
});
```

**See Also:**

- [`relatedFunction()`](#relatedfunction)
- [Related Guide](/guides/related-topic)
```

---

## Type Documentation Template

Every exported type/interface must be documented:

```markdown
### `TypeName`

[One sentence describing what this type represents.]

```typescript
interface TypeName {
  /**
   * Description of property1
   * @default 'default value'
   */
  property1: string;

  /**
   * Description of property2
   */
  property2: number;

  /**
   * Optional property with default behavior
   * @default undefined
   */
  property3?: boolean;
}
```

**Properties:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `property1` | `string` | Yes | `'default'` | What this property does |
| `property2` | `number` | Yes | - | What this property does |
| `property3` | `boolean` | No | `undefined` | What this property does |

**Example:**

```typescript
const config: TypeName = {
  property1: 'custom',
  property2: 42,
  property3: true
};
```
```

---

## Class Documentation Template

For classes:

```markdown
### `ClassName`

[One sentence describing what this class does.]

#### Constructor

```typescript
new ClassName(param1: Type, options?: Options)
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param1` | `Type` | Yes | What this parameter does |
| `options` | `Options` | No | Configuration options |

**Example:**

```typescript
import { ClassName } from '@nextrush/package';

const instance = new ClassName('value', {
  option: true
});
```

#### Properties

##### `instance.propertyName`

**Type:** `PropertyType`

[Description of what this property contains.]

```typescript
console.log(instance.propertyName); // PropertyType
```

#### Methods

##### `instance.methodName(param)`

[Description of what this method does.]

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param` | `Type` | Yes | What this parameter does |

**Returns:** `ReturnType`

**Example:**

```typescript
const result = instance.methodName('value');
```
```

---

## Context API Documentation

The Context object requires special documentation format:

```markdown
## Context API

The `Context` object (`ctx`) provides access to request data and response methods.

### Request Properties

#### `ctx.method`

**Type:** `'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'`

The HTTP method of the request.

```typescript
app.use(async (ctx) => {
  console.log(ctx.method); // 'GET'
});
```

#### `ctx.path`

**Type:** `string`

The request path without query string.

```typescript
// Request: GET /users/123?include=posts
console.log(ctx.path); // '/users/123'
```

### Response Methods

#### `ctx.json(data)`

Send a JSON response.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `unknown` | Data to serialize as JSON |

**Behavior:**
- Sets `Content-Type: application/json`
- Serializes data with `JSON.stringify()`
- Does not call `ctx.next()` automatically

```typescript
ctx.json({ users: [] });
ctx.json({ error: 'Not found' });
```

#### `ctx.send(data)`

Send a response body.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `string \| Buffer \| Readable` | Response body |

**Behavior:**
- Sets `Content-Type` based on data type
- Strings: `text/plain`
- Buffers: `application/octet-stream`
- Streams: pipes to response

```typescript
ctx.send('Hello World');
ctx.send(Buffer.from([0x48, 0x69]));
```
```

---

## Middleware Documentation Format

For middleware packages:

```markdown
# @nextrush/[middleware-name]

> [One-liner description]

## Installation

```bash
pnpm add @nextrush/[middleware-name]
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { middlewareName } from '@nextrush/[middleware-name]';

const app = createApp();

app.use(middlewareName());

app.listen(3000);
```

## API

### `middlewareName(options?)`

Create the middleware function.

**Signature:**

```typescript
function middlewareName(options?: MiddlewareOptions): Middleware
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option1` | `string` | `'value'` | What this option does |
| `option2` | `number` | `100` | What this option does |

**Returns:** `Middleware` - Middleware function for use with `app.use()`

**Example with all options:**

```typescript
app.use(middlewareName({
  option1: 'custom',
  option2: 200
}));
```

## Default Behavior

When used with no options:

```typescript
app.use(middlewareName());
```

The middleware will:
1. [What it does first]
2. [What it does second]
3. [What it does third]

## Configuration Recipes

### Recipe: [Use Case Name]

```typescript
app.use(middlewareName({
  // Configuration for this use case
}));
```

### Recipe: [Another Use Case]

```typescript
app.use(middlewareName({
  // Configuration for this use case
}));
```

## TypeScript Types

```typescript
import type {
  MiddlewareOptions,
  // Other exported types
} from '@nextrush/[middleware-name]';
```

### `MiddlewareOptions`

```typescript
interface MiddlewareOptions {
  option1?: string;
  option2?: number;
}
```
```

---

## Plugin Documentation Format

For plugin packages:

```markdown
# @nextrush/[plugin-name]

> [One-liner description]

## Installation

```bash
pnpm add @nextrush/[plugin-name]
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { pluginName } from '@nextrush/[plugin-name]';

const app = createApp();

app.plugin(pluginName({
  // Required options
}));

app.listen(3000);
```

## Why Use This Plugin?

[2-3 paragraphs explaining the problem this plugin solves]

## API

### `pluginName(options)`

Create the plugin instance.

**Signature:**

```typescript
function pluginName(options: PluginOptions): Plugin
```

**Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `required1` | `string` | Yes | - | What this does |
| `optional1` | `number` | No | `100` | What this does |

**Returns:** `Plugin` - Plugin instance for use with `app.plugin()`

## Context Extensions

This plugin extends the context with:

### `ctx.pluginMethod()`

[Description]

```typescript
app.get('/example', async (ctx) => {
  await ctx.pluginMethod();
});
```

## Application Extensions

This plugin extends the application with:

### `app.pluginProperty`

[Description]

```typescript
console.log(app.pluginProperty);
```

## Events

This plugin emits the following events:

| Event | Payload | Description |
|-------|---------|-------------|
| `eventName` | `EventPayload` | When this event fires |

```typescript
app.on('eventName', (payload) => {
  console.log(payload);
});
```
```

---

## Documentation Consistency Rules

### Parameter Tables

Always use this column order:
1. Parameter/Option/Property name
2. Type
3. Required (Yes/No) or Default
4. Description

### Type Formatting

```markdown
<!-- Primitives -->
`string`, `number`, `boolean`, `null`, `undefined`

<!-- Arrays -->
`string[]`, `Array<string>`

<!-- Objects -->
`Record<string, unknown>`, `object`

<!-- Unions -->
`string | number`, `'option1' | 'option2'`

<!-- Functions -->
`(param: Type) => ReturnType`

<!-- Complex types -->
`OptionsType` (linked to type definition)
```

### Code Block Headers

Always specify the language:

```typescript
// TypeScript (default for NextRush)
```

```javascript
// JavaScript (when showing alternative)
```

```bash
# Shell commands
```

```json
// JSON configuration
```

### Default Value Documentation

Always document defaults, even when `undefined`:

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Whether feature is enabled |
| `timeout` | `30000` | Timeout in milliseconds |
| `callback` | `undefined` | Optional callback function |

---

## API Versioning

When APIs change between versions:

### Deprecation

```markdown
### `oldFunction()`

::: warning Deprecated
This function is deprecated and will be removed in v4.0.0.
Use [`newFunction()`](#newfunction) instead.
:::

[Rest of documentation]
```

### Version-Specific Behavior

```markdown
### `functionName()`

**Version differences:**

| Version | Behavior |
|---------|----------|
| v3.0.0 | Original behavior |
| v3.1.0 | Added `option2` parameter |
| v3.2.0 | Changed default for `option1` |
```

### Breaking Changes

```markdown
::: danger Breaking Change in v3.0.0
This function's signature changed from `func(a, b)` to `func(options)`.
See [migration guide](/guides/migration-v3) for details.
:::
```

---

## Examples Quality Standards

### Every API Must Have Examples

No function should be documented without at least:
1. Basic usage example
2. Example with options (if applicable)

### Example Requirements

```typescript
// ✅ Good: Complete, runnable, shows result
import { json } from '@nextrush/body-parser';

const app = createApp();
app.use(json({ limit: '1mb' }));

app.post('/users', async (ctx) => {
  console.log(ctx.body); // { name: 'Alice' }
  ctx.json({ received: true });
});

// Request:
// curl -X POST -H "Content-Type: application/json" \
//      -d '{"name":"Alice"}' http://localhost:3000/users

// Response:
// {"received":true}
```

```typescript
// ❌ Bad: Incomplete, no context
app.use(json({ limit: '1mb' }));
```

### Show Both Success and Error Cases

```typescript
// Success case
const result = validateEmail('user@example.com');
console.log(result); // true

// Error case
const invalid = validateEmail('not-an-email');
console.log(invalid); // false
```

---

## Cross-Referencing

### Internal Links

Link to related APIs within the same package:

```markdown
See [`relatedFunction()`](#relatedfunction) for more details.
```

### External Links

Link to other packages or guides:

```markdown
See [@nextrush/router](/packages/router) for routing documentation.
See [Middleware Guide](/guides/middleware) for usage patterns.
```

### Type Links

Link types to their definitions:

```markdown
**Returns:** [`Context`](/api/types#context) - The request context
```

---

## TypeScript-First Documentation

### Show Types Inline

```typescript
// Good: Types visible
const app: Application = createApp();
const ctx: Context = /* ... */;

// Also acceptable: Inferred types mentioned in text
const app = createApp(); // Returns Application
```

### Export All Types

Document that types are exported:

```typescript
// Types can be imported for use in your code
import type {
  Application,
  Context,
  Middleware,
  Plugin
} from '@nextrush/core';
```

### Generic Type Documentation

```markdown
### `createStore<T>(initial: T): Store<T>`

Create a typed store.

**Type Parameters:**

| Parameter | Constraint | Description |
|-----------|------------|-------------|
| `T` | `object` | The store state type |

**Example:**

```typescript
interface UserState {
  name: string;
  email: string;
}

const store = createStore<UserState>({
  name: '',
  email: ''
});
```
```

---

## Automated API Docs

### JSDoc Standards

Source code should use JSDoc that can generate docs:

```typescript
/**
 * Parse JSON request bodies and populate ctx.body.
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use(json({ limit: '1mb' }));
 * ```
 *
 * @see {@link JsonOptions} for available options
 * @since 3.0.0
 */
export function json(options?: JsonOptions): Middleware {
  // ...
}
```

### TypeDoc Integration

When using TypeDoc for auto-generated API docs:
- Ensure JSDoc is complete in source
- Link auto-generated pages from hand-written guides
- Review generated docs for accuracy

---

## Final Checklist

Before publishing API documentation:

### Accuracy
- [ ] All function signatures match source code
- [ ] All default values verified
- [ ] All type definitions accurate
- [ ] All examples tested

### Completeness
- [ ] All exported functions documented
- [ ] All exported types documented
- [ ] All parameters documented
- [ ] All options documented
- [ ] At least one example per function

### Consistency
- [ ] Table column order consistent
- [ ] Type formatting consistent
- [ ] Example style consistent
- [ ] Cross-references use correct format

### Usability
- [ ] Can find any function in < 10 seconds
- [ ] Can copy-paste examples directly
- [ ] Types are importable as shown
- [ ] Error conditions documented
