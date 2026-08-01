# EDS-005 — Engineering Storytelling

> Great documentation doesn't just explain a technology. It tells the story of the engineering problem that made the technology necessary — because people remember stories and forget definitions.

Storytelling here is not entertainment. It's the technique for making a concept *stick*: give it context, tension, and a resolution, and the reader understands *why* instead of merely memorizing *what*. This applies most to Concept, Architecture, and Guide pages; Reference pages stay factual (EDS-011).

---

## Start with the problem, never the solution

A reader doesn't care about middleware until they feel the pain middleware removes. So open with the pain:

> Every request needs authentication, logging, validation, and error handling. Copy that into all 200 routes and you've built something impossible to change safely.

Now "middleware" arrives as relief, not vocabulary. This is the same why-before-how rule from EDS-001, applied to the *opening line* specifically.

## Walk the engineering journey

The most memorable explanations follow the path the original engineers walked:

```text
Problem → why it hurts → the obvious fix → why the obvious fix fails
   → the better idea → how it works → the trade-off it accepts
```

The middle — *why the obvious fix fails* — is where understanding actually happens, and it's the part weak docs skip. Don't skip it. Showing why the naive approach breaks is what teaches judgment.

## Teach through the decision, not just the result

Instead of "the framework uses adapters," show the fork in the road:

> The framework could couple directly to Node's `http` module — simpler to build. But then Bun, Deno, and edge runtimes each need a rewrite. So it hides the runtime behind an adapter: one core, many backends, proven identical by a conformance suite.

The reader now understands the *reasoning*, which transfers to their own designs. The result alone doesn't.

## Use real engineering situations

Draw examples from work developers actually do: authentication, payments, APIs, database transactions, background jobs, file uploads, rate limiting, caching, deployment. A reader recognizing their own problem is halfway to understanding the solution. Toy domains (`Animal`, `Shape`) force them to translate twice.

## Introduce tension honestly

Engineering is trade-offs, and trade-offs are inherently dramatic: *we want flexibility, but flexibility adds complexity; we want a tiny API, but the internals still have to be powerful.* Naming the tension is more honest and more memorable than pretending a design is free. The tension must be real, though — never manufacture suspense the topic doesn't have.

## Reveal one idea at a time

Don't explain middleware, routing, plugins, lifecycle, and adapters at once. Teach middleware; connect it to routing; connect routing to the app; connect the app to adapters. Each idea rests on the last. A page that introduces five concepts in parallel overwhelms; a page that chains them builds.

## Build the picture in the reader's head

Prefer showing a flow to describing it:

```text
Request → Auth → Logging → Validation → Handler → Response
```

A three-line diagram often replaces a paragraph and is remembered longer (EDS-012). Follow it with the sentence that says what to notice.

## Compare, don't attack

When contrasting with Express, Fastify, or Nest, explain what they do, why it works, and why this project chose differently — as engineering, not rivalry. "If you've used Express, you'll recognize…" helps a migrating reader; "unlike Express's outdated approach…" just sounds insecure and dates badly.

## End with the idea worth keeping

Close on insight, not recap (EDS-004): *"Adapters aren't about supporting many runtimes today — they're about supporting the runtime that doesn't exist yet, without touching the core."* That's the sentence the reader repeats to a teammate.

## Avoid

- Starting with a definition or an API.
- Skipping the "why the obvious fix fails" middle.
- Information dumps disguised as narrative.
- Fake stories, forced drama, or artificial suspense.
- Storytelling that buries the technical facts — the narrative serves comprehension, never replaces accuracy (guardrail from `SKILL.md`).

## Success

The reader finishes thinking *"I understand why engineers built this,"* not *"I memorized another API."* Story is the vehicle; understanding is the cargo. If the story ever competes with accuracy, accuracy wins and the story gets shorter.
