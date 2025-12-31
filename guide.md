# Documentation Authoring Guidelines

Writing documentation is as important as writing the framework itself. Treat it as part of the product, not an afterthought.

Your goals:
- Accuracy: docs must always match the actual code
- Clarity: simple language, short sentences, real examples
- Developer Experience (DX): easy to follow, easy to apply, less friction
- Quality: modern, readable, and professional documentation

---

## 1. Always Read the Code First

Before writing any documentation:

1. Open the relevant feature or package source code
2. Understand:
   - public APIs
   - inputs and outputs
   - side effects
   - limitations and edge cases
3. Confirm that the code and current docs are aligned

> Never write docs based only on assumptions or memory.

---

## 2. Review Existing Docs Before Writing

Follow this order:

1. Read the package `README.md`
2. Check `/docsX` (or the relevant docs directory)
3. Look for:
   - existing explanations
   - missing sections
   - outdated or incorrect content
4. Only then start writing or updating content

---

## 3. Do Not Rush

Documentation requires full attention.

- Take your time
- Reread what you write
- Avoid skipping features or hidden behaviors
- Validate every claim against the codebase
- Prefer correctness over speed

---

## 4. Documentation Quality Requirements

Your documentation must be:

- UX-friendly
- easy to scan and navigate
- clear for beginners but still useful for experts
- consistent in style and terminology
- example-driven where possible

Strive for **world-class developer experience**:
- show how to use, not just what it does
- avoid unnecessary theory
- include copy-paste-ready snippets
- highlight common mistakes and gotchas

---

## 5. Handle Edge Cases

For every feature, consider:

- invalid inputs
- failure modes
- performance limits
- security concerns
- configuration mistakes
- migration or breaking changes

If an edge case exists, **document it clearly**.

---

## 6. Required Structure for Each Doc Page

Each documentation page should ideally include:

1. What the feature is
2. When you should use it
3. API or configuration options
4. Basic example
5. Advanced example
6. Edge cases and caveats
7. Common errors and fixes
8. Related features / links

---

## 7. TODO Workflow (Tracking and Completion)

Use this workflow to manage progress:

### Step-by-step checklist

- [ ] Identify feature/package
- [ ] Read full source code
- [ ] Review existing READMEs
- [ ] Review related docs
- [ ] Draft initial documentation
- [ ] Add examples and edge cases
- [ ] Perform quality review
- [ ] Validate docs against code again
- [ ] Mark as complete

### After completion — Revalidate

After marking done:

- [ ] Re-read with a fresh mind
- [ ] Check clarity and flow
- [ ] Check accuracy against code
- [ ] Fix wording or gaps
- [ ] Ask: “Would a new developer understand this?”

Only then move to the next task.

---

## 8. Quality Review Checklist

Before finalizing:

- [ ] Does everything match the actual implementation?
- [ ] Are examples correct and runnable?
- [ ] Are edge cases documented?
- [ ] Is language simple and clear?
- [ ] Are headings structured and consistent?
- [ ] Are breaking changes, if any, clearly stated?
- [ ] Would this reduce support questions?

---

## 9. Golden Rules

- Never publish outdated documentation
- Never ignore confusing areas — rewrite them
- Think like a developer using this framework for the first time
