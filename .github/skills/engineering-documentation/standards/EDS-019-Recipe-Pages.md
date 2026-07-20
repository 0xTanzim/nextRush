# EDS-019 — Recipe & Cookbook Pages

> A recipe is a **complete, runnable, end-to-end solution** to a realistic scenario — JWT auth, file uploads with validation, a rate-limited REST API, server-sent events. The reader copies the whole thing, runs it, and adapts it. It's the "just give me the working answer" page.

Recipes are how-to pages (Diátaxis), but where a **Guide** (EDS-009) teaches *a technique*, a recipe delivers *a whole working feature*. Guide: "how request validation works and how to apply it." Recipe: "here's a complete, production-shaped file-upload endpoint with validation, size limits, and error handling."

---

## Recipe vs. Guide (the distinction that matters)

| | Guide (EDS-009) | Recipe (EDS-019) |
|---|---|---|
| Goal | Teach a technique well | Hand over a complete solution |
| Scope | One task, explained | One scenario, fully built |
| Reader leaves with | Understanding to apply | Working code to adapt |
| Explanation | Heavy — every step | Lighter — the whole, then the key parts |

If you're explaining *how something works step by step*, write a guide. If you're providing *the entire answer to "how do I build X"*, write a recipe.

## Structure

```text
What you'll build (+ result) → When to use this recipe → Prerequisites
   → The complete solution (full, runnable) → How it works (the key parts)
   → Variations → Production notes → Related recipes
```

## Rules specific to recipes

- **Show the complete, runnable solution.** This is the defining rule. The full code must work when copied — real imports, all files, no `...` (EDS-013). A recipe that doesn't run is worthless; a reader came here specifically to *not* assemble pieces.
- **Show the result up front.** The endpoint, the response, the behavior — so the reader confirms this is the recipe they want before reading the code.
- **Explain the key parts, not every line.** Unlike a guide, a recipe leads with the whole solution, then annotates the decisions that matter (the auth check, the size limit, the error path). The reader can run first, understand second.
- **State when to use it — and when not.** A recipe is opinionated and specific; tell the reader the scenario it fits so they don't apply it to the wrong one.
- **Offer realistic variations.** The two or three common adaptations ("swap Zod for Valibot," "store to S3 instead of disk") so the reader can adjust without starting over.
- **Keep production quality.** Recipes get copied into real apps verbatim — validation, error handling, and safe defaults are not optional (EDS-013). A recipe that models sloppy code ships sloppy code everywhere it's copied.

## Anti-patterns

- Fragments the reader must assemble — a recipe is the *whole* thing.
- Skipping error handling or validation "for brevity" (it ships to prod).
- No result shown, so the reader can't tell if it's the right recipe.
- Line-by-line teaching that turns it into a slow guide — recipes are faster than that.
- A toy scenario nobody actually builds (EDS-013).

## Success

The reader copies the recipe, it runs, they understand the parts that matter, and they adapt it to their own case. They got a complete, trustworthy solution — not a puzzle to finish.
