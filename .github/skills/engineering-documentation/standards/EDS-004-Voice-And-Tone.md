# EDS-004 — Voice & Tone

> The best documentation doesn't feel like documentation. It feels like an experienced engineer sitting beside you, explaining something they understand deeply and want you to understand too.

This standard governs *how the writing reads*. It applies to every page, every type, every mode. If a page is technically perfect but reads like a generated manual, it fails here.

> This file is written the way it asks you to write. If your output reads choppier — every line a fragment, a blank line between each — you are not meeting the standard, you are demonstrating the problem.

---

## The voice

Calm, confident, clear, and honest. You are a senior engineer teaching a peer: patient but never condescending, precise but never academic, warm but never chatty. You respect the reader's intelligence and their time.

Avoid the four voices that ruin docs: **robotic** (generated-sounding filler), **academic** (jargon as a flex), **marketing** ("blazingly fast, effortless, magical"), and **overly casual** (memes and exclamation points standing in for substance). Professional does not mean formal, and simple does not mean shallow.

## Write with natural rhythm

This is the rule the old version of this skill broke most, so it comes first. **Vary your sentence length.** Follow a long, explanatory sentence with a short one. Mix in a question. Let paragraphs breathe at two-to-four sentences, not one fragment each.

Prose that puts every clause on its own line, padded with blank lines, does not read as clarity — it reads as a machine that couldn't decide where sentences end. Compare:

> **Bad (choppy):**
> Middleware runs first.
>
> It handles cross-cutting concerns.
>
> Then the router matches.

> **Good (natural rhythm):**
> Middleware runs before the router, which is what makes it the right home for cross-cutting concerns like auth and logging. Do that work once, in the pipeline, instead of repeating it in every handler.

Whitespace is a tool, not a default. Use a blank line to separate ideas, not to separate sentences.

## Use plain English

Assume an intelligent reader who may not be a native English speaker. Prefer the common word: *use* over *utilize*, *help* over *facilitate*, *start* over *commence*, *show* over *demonstrate*, *about* over *regarding*. Expand an acronym on first use. The engineering should be the hard part of the page — never the vocabulary.

## Explain the idea before you name it

Introduce the concept, *then* attach the official term. "Imagine every service constructing its own database connection, logger, and config by hand — now imagine changing one of them" lands the problem; *then* you say "this is what dependency injection solves." Readers remember the idea and hang the name on it. Name-first, they get a definition with nothing to attach it to.

## Lead with the problem

Every feature exists because of a problem. Open there, not at the API. Readers came to solve something; meet them at the something.

## Create a little curiosity

You don't have to answer every question in the first sentence. A well-placed *"but there's a catch"* or *"which one should finish first?"* pulls the reader forward. Used sparingly, tension is what makes a technical page readable instead of merely correct. Don't manufacture fake suspense — the tension should be a real engineering question.

## Sound like an engineer, not a brochure

Replace praise with reasoning. Instead of *"this powerful feature makes everything easy,"* write *"this removes the per-route boilerplate, at the cost of one indirection you have to know about."* Engineers trust reasoning and distrust adjectives. Never claim a feature is perfect; name what it costs.

## Prefer active voice

*"The router matches the request"* beats *"the request is matched by the router."* Active voice is shorter, clearer, and names who does what. Passive is fine when the actor genuinely doesn't matter, but that's the exception.

## End with insight, not a recap

Don't close a section by repeating it. Close with the idea worth keeping: *"Middleware isn't valuable because it runs early — it's valuable because it lets you solve a cross-cutting problem once instead of two hundred times."* Readers remember insights; they skip summaries.

## Avoid

- Marketing language, buzzwords, empty praise ("powerful," "seamless," "blazingly fast").
- Robotic transitions used on autopilot — *furthermore, moreover, additionally, it is important to note.* Use them only when they genuinely aid flow.
- Repetitive sentence openings (every paragraph starting "You can…").
- Definitions with no context; code with no explanation.
- One-fragment-per-line padding and gratuitous blank lines.
- Walls of text — the opposite failure. Break a 12-line paragraph into two or three.

## The test

A reader should finish a page thinking *"that was surprisingly easy to understand,"* not *"that sounded impressive."* The first means the writing got out of the way of the engineering. That's the whole goal.
