---
description: 'API reference format, type signatures, parameter tables, and lookup-optimized documentation for NextRush packages.'
applyTo: '**/api/**/*.md, **/api/**/*.mdx, **/packages/**/*.md, **/packages/**/*.mdx'
---

# NextRush API Reference Documentation

API reference documentation is **lookup material**, not teaching material.
Optimize for speed, accuracy, and predictability.

Do not explain concepts here — link to concept or guide pages instead.
For writing standards, see `docs-standards.instructions.md`.
For MDX components, see `docs-mdx-ui.instructions.md`.

---

## Scope

Use these rules when documenting:

- Exported functions
- Classes and their methods
- Interfaces and types
- Middleware APIs
- Plugin APIs
- Context properties and methods

Do NOT use these rules for tutorials, concept explanations, or guides.

---

## Core Rules

1. **Optimized for scanning** — predictable structure, easy to skim, easy to search
2. **Complete** — every parameter, default, return value, and error documented
3. **Accurate** — verified against source code. Outdated API docs are bugs.
4. **TypeScript-first** — all examples in TypeScript. Document exported types explicitly.

---

## Function Documentation

````markdown
### `functionName()`

One sentence: what it does and when to use it.

**Signature:**

```ts
function functionName(param1: ParamType, options?: OptionsType): ReturnType;
```
````

Then use **TypeTable** for parameters and options:

```mdx
<TypeTable
  title="Parameters"
  types={{
    param1: { type: 'ParamType', description: 'What this parameter controls' },
    options: { type: 'OptionsType', description: 'Configuration object', optional: true },
  }}
/>

<TypeTable
  title="Options"
  types={{
    timeout: { type: 'number', description: 'Request timeout in ms', default: '5000' },
    retries: { type: 'number', description: 'Retry attempts', default: '0' },
  }}
/>
```

**Returns:** `ReturnType` — description.

**Throws:** (only if applicable)

| Error | Condition |
| ----- | --------- |

**Example:**

```ts
import { functionName } from '@nextrush/package';

const result = functionName('value', { timeout: 3000 });
```

---

## Type and Interface Documentation

````markdown
### `TypeName`

One sentence: what this type represents.

```ts
interface TypeName {
  property1: string;
  property2?: number;
}
```
````

Then use TypeTable for properties:

```mdx
<TypeTable
  title="Properties"
  types={{
    property1: { type: 'string', description: 'Description' },
    property2: { type: 'number', description: 'Description', optional: true },
  }}
/>
```

---

## Class Documentation

````markdown
### `ClassName`

One sentence: what this class does.

#### Constructor

```ts
new ClassName(param: Type, options?: Options)
```
````

Use TypeTable for constructor parameters. Document public properties and methods individually.

---

## Context API Documentation

Context properties require behavior clarity:

- State the type
- Describe behavior (side effects, headers set, lifecycle timing)
- Show minimal example

```markdown
#### `ctx.json(data)`

Send a JSON response.
```

```mdx
<TypeTable
  title="Parameters"
  types={{
    data: { type: 'unknown', description: 'Data to serialize as JSON' },
  }}
/>
```

**Behavior:**

- Sets `Content-Type: application/json`
- Serializes with `JSON.stringify`
- Does not call `ctx.next()`

```ts
ctx.json({ ok: true });
```

---

## Middleware API Documentation

Every middleware entry must include:

1. What the middleware does (one sentence)
2. Signature
3. Default behavior (zero-config)
4. Configuration options (TypeTable)
5. Minimal example

````mdx
### `middlewareName()`

Create [purpose] middleware.

**Signature:**

```ts
function middlewareName(options?: MiddlewareOptions): Middleware;
```
````

**Default Behavior:** [What happens with no options]

<TypeTable
title="Options"
types={{
    option1: { type: 'string', description: 'Description', default: '"value"' },
  }}
/>

**Example:**

```ts
import { middlewareName } from '@nextrush/middleware-name';

app.use(middlewareName());
```

````

---

## Plugin API Documentation

Plugin entries must include:

1. Installation (use `PackageInstall`)
2. Initialization API
3. Context extensions (if any)
4. Application extensions (if any)
5. Events (if any)

Do not re-explain plugin concepts — link to the concepts page.

---

## Versioning and Deprecation

Use Fumadocs Callout components for deprecation and breaking changes:

```mdx
<Callout type="warn" title="Deprecated">
  This API is deprecated and will be removed in vX.Y.Z.
  Use `newApi()` instead.
</Callout>

<Callout type="error" title="Breaking Change in v3">
  The API signature changed. See the migration guide for details.
</Callout>
````

---

## Table Column Order

Always follow this order for manual tables:

1. Name
2. Type
3. Required or Default
4. Description

Prefer TypeTable component over manual Markdown tables for type/property documentation.

---

## Type Formatting

- Primitives: `string`, `number`, `boolean`
- Unions: `'a' | 'b'`
- Arrays: `Type[]`
- Functions: `(arg: Type) => ReturnType`
- Named types: link to their definitions

---

## Examples Rules

Every API must include:

- At least one basic usage example
- An options example if configurable
- Error example if errors are common

Examples must be runnable, minimal, and include imports.

---

## Cross-Referencing

- Link related APIs within the same page
- Link to guides for usage patterns
- Link types to their definitions
- Avoid broken or circular links

---

## API Reference Checklist

Before publishing:

- [ ] Signatures verified against source code
- [ ] Default values verified against source code
- [ ] All exports documented
- [ ] All parameters and options documented
- [ ] Examples tested and runnable
- [ ] TypeTable used for property/option documentation
- [ ] Errors documented where applicable
- [ ] Links to related pages are correct
