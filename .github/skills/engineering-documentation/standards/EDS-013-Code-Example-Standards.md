# EDS-013 — Code Example Standards

> Code examples exist to teach an idea — not to demonstrate every API or show off a clever one-liner. A great example is one the reader can copy, run, understand, and then *modify* for their own case.

This standard governs the code *on* a page. How that code is presented — line highlighting, tabs, code groups, filenames — is EDS-016.

---

## Teach exactly one idea per example

Each block demonstrates one concept. An example that shows middleware *and* routing *and* validation *and* auth teaches none of them, because the reader can't tell which part is the point. If a topic needs several ideas, use several small examples that build (see "build progressively" below), not one that does everything.

## Explain before and after — never a naked block

Code rarely teaches itself. Before the block, say what it does, why, and what to watch for. After it, explain what happened, which line matters most, and the mistake beginners make here. The block is the middle of a sentence, not the whole sentence.

## Make examples complete and runnable

This is non-negotiable and the most common failure. An example must run as written:

- **Real imports** — every symbol used is imported. No "assume the imports."
- **No `...` or `// rest of code`** where the reader needs the code. If you must elide, elide something irrelevant and say so.
- **No placeholder that breaks execution** — `YOUR_KEY_HERE` is fine as a value; `foo()` standing in for a real call is not.
- If a block genuinely can't run standalone, say so and link a runnable version.

A reader who copies your example and hits an error learns that the docs can't be trusted — the single most expensive thing documentation can teach.

## Use production-realistic domains

Draw from real work: `UserService`, `AuthMiddleware`, `PaymentController`, `CacheAdapter`, `NotificationQueue`. Avoid `Foo`, `Bar`, `Animal`, `Widget`. Realistic names and domains let the reader map the example onto their own system without translating twice.

## Keep examples as small as the idea allows

Show the least code that teaches the point. Strip everything unrelated — unused imports, dead variables, incidental business logic, boilerplate the reader doesn't need to see. Length should track the *idea's* complexity, not the framework's.

## Model good engineering

Examples are copied verbatim into real code, so they must model the practices you'd defend in review: validate input, handle errors, don't hardcode secrets, use safe defaults. Never teach an insecure pattern "for simplicity" — a reader will ship it. If a real example needs error handling to be correct, include it; if that makes the block too big, the topic needs splitting, not shortcutting.

## Comment the *why*, not the *what*

```ts
// Bad — narrates the obvious
const app = createApp(); // create the app

// Good — explains intent
// Register auth before routes so every handler runs behind it.
app.use(auth());
```

A comment earns its place by adding information the code can't. Delete the rest.

## Show structure when it matters

When *where code lives* is part of the lesson, show the tree:

```text
src/
├── app.ts
├── routes/
├── middleware/
└── services/
```

Otherwise skip it — not every example needs a folder map.

## Build progressively

For a feature with real depth, evolve it across a few blocks rather than dropping one large one:

```text
basic route → route params → add validation → production-ready handler
```

Each step adds one idea and the reader keeps up. One 60-line block at the end teaches far less than four 15-line blocks that build.

## Show the result

Where it helps the reader confirm success, include the expected output — an HTTP response, a JSON body, terminal output. Especially in tutorials (EDS-008), knowing what "working" looks like is half the value.

## Keep examples current

Examples match the shipping version — current API, current recommended practice, current package names. An example that used to work is worse than no example. This is checked at publish time (EDS-015).

## Avoid

Toy domains where a real one is clearer. Huge dumps. Hidden setup. Unexplained code. Inconsistent formatting across the page. Clever code that impresses instead of teaches. Any insecure or sloppy pattern.

## Success

The reader can answer *what problem does this solve, why is it written this way, which part matters, and could I adapt it?* — and then they change the example instead of depending on it. When they start modifying rather than copying, the example has done its job.
