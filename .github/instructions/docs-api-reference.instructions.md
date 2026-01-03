---
description: 'Standards for writing precise, scannable, and accurate API reference documentation for NextRush packages.'
applyTo: '**/api/**/*.md, **/packages/**/*.md'
---

# NextRush API Reference Documentation Instructions

This file defines how to write **API reference documentation** for NextRush packages.

API reference documentation is **lookup material**, not teaching material.
Optimize for **speed, accuracy, and predictability**.

Do not explain concepts here — link to concept or guide pages instead.

---

## Scope

Use these rules when documenting:

* Exported functions
* Classes
* Interfaces and types
* Middleware APIs
* Plugin APIs
* Context properties and methods

Do **not** use these rules for:

* Tutorials or guides
* Concept explanations
* Architecture discussions
* Marketing or landing pages

---

## Core Principles

### 1. Optimized for Scanning

API docs must be:

* Predictable in structure
* Easy to skim
* Easy to search
* Easy to copy

Avoid long paragraphs.

---

### 2. Complete and Explicit

Every API entry must document:

* Parameters
* Defaults
* Return values
* Errors
* Side effects (if any)

Missing information is treated as incorrect documentation.

---

### 3. Strict Accuracy

* Verify signatures against source code
* Verify default values
* Test all examples
* Update docs immediately when APIs change

Outdated API docs are considered bugs.

---

## Function Documentation

Document every exported function using this structure.

````markdown
### `functionName(...)`

One sentence describing what the function does and when to use it.

**Signature:**
```ts
function functionName(
  param1: ParamType,
  options?: OptionsType
): ReturnType
````

**Parameters:**

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |

**Options:** (only if applicable)

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |

**Returns:**
`ReturnType` — Description of the returned value.

**Throws:** (only if applicable)

| Error | Condition |
| ----- | --------- |

**Example:**

```ts
import { functionName } from '@nextrush/package';

functionName('value', { option: true });
```

**See Also:**

* Related APIs
* Related guides

````

---

## Type & Interface Documentation

Document every exported type or interface.

```markdown
### `TypeName`

One sentence describing what this type represents.

```ts
interface TypeName {
  property1: string;
  property2?: number;
}
````

**Properties:**

| Property | Type | Required | Default | Description |
| -------- | ---- | -------- | ------- | ----------- |

**Example:**

```ts
const value: TypeName = {
  property1: 'example'
};
```

````

---

## Class Documentation

For exported classes:

```markdown
### `ClassName`

One sentence describing the responsibility of this class.

#### Constructor
```ts
new ClassName(param: Type, options?: Options)
````

**Parameters:**

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |

**Example:**

```ts
const instance = new ClassName('value');
```

#### Properties

##### `instance.propertyName`

**Type:** `PropertyType`
Description.

#### Methods

##### `instance.methodName(...)`

One sentence description.

**Signature:**

```ts
methodName(param: Type): ReturnType
```

**Example:**

```ts
instance.methodName('value');
```

````

---

## Context API Documentation

Context APIs must be documented with **behavior clarity**.

For each property or method:
- State the type
- Describe behavior
- List side effects
- Mention lifecycle timing if relevant

```markdown
#### `ctx.json(data)`

Send a JSON response.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|

**Behavior:**
- Sets `Content-Type: application/json`
- Serializes with `JSON.stringify`
- Does not call `ctx.next()`

```ts
ctx.json({ ok: true });
````

````

---

## Middleware API Documentation

Middleware documentation must include:

1. What the middleware does
2. How to create it
3. Default behavior
4. Configuration options
5. Example usage

```markdown
### `middlewareName(options?)`

Create middleware.

**Signature:**
```ts
function middlewareName(options?: MiddlewareOptions): Middleware
````

**Default Behavior:**
Describe what happens with no options.

**Example:**

```ts
app.use(middlewareName());
```

````

---

## Plugin API Documentation

Plugin documentation must include:

- Installation
- Initialization API
- Context extensions
- Application extensions
- Events (if any)

Do not re-explain plugin concepts here — link to the plugin guide.

---

## Tables & Formatting Rules

### Table Column Order

Always use this order:
1. Name
2. Type
3. Required or Default
4. Description

---

### Type Formatting

Use inline code formatting:

- Primitives: `string`, `number`, `boolean`
- Unions: `'a' | 'b'`
- Arrays: `Type[]`
- Functions: `(arg: Type) => ReturnType`
- Named types: link to definitions

---

## Versioning & Deprecation

### Deprecation

```markdown
::: warning Deprecated
This API is deprecated and will be removed in vX.Y.Z.
Use `newApi()` instead.
:::
````

### Breaking Changes

```markdown
::: danger Breaking Change
The API signature changed in vX.Y.Z.
See the migration guide for details.
:::
```

---

## Examples Rules

Every API must include:

* At least one basic example
* An options example if configurable
* Error example if errors are common

Examples must be:

* Runnable
* Minimal
* Context-complete

---

## Cross-Referencing

* Link related APIs within the same page
* Link to guides for usage patterns
* Link types to their definitions

Avoid broken or circular links.

---

## TypeScript-First

* Use TypeScript by default
* Mention inferred types where useful
* Document exported types explicitly

---

## Final API Documentation Checklist

Before publishing:

### Accuracy

* [ ] Signatures verified
* [ ] Defaults verified
* [ ] Examples tested

### Completeness

* [ ] All exports documented
* [ ] All parameters documented
* [ ] All options documented

### Usability

* [ ] API can be found quickly
* [ ] Examples can be copied directly
* [ ] Errors are documented clearly

---

## Final Rule

> **If a developer cannot answer “how do I call this?” in under 10 seconds, the API documentation has failed.**
