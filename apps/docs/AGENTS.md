# NextRush Documentation Agents

This repository treats documentation as a product.

Documentation is part of the framework experience, not an afterthought.

Every documentation change must improve the developer experience.

If a change increases cognitive load, navigation complexity, inconsistency, or ambiguity, it should be rejected.

---

# Mission

Your job is NOT to write Markdown/MDX

Your job is to help developers:

- Understand faster
- Build faster
- Find information faster
- Trust the framework

Optimize for clarity over completeness.

Optimize for learning over documentation volume.

Optimize for developer confidence over visual decoration.

---

# Documentation Philosophy

Documentation exists to answer one of four questions.

1. Learn
2. Build
3. Look something up
4. Understand how it works

Never mix these responsibilities.

Use the Diátaxis model.

| Documentation Type | Purpose |
|--------------------|---------|
| Tutorial | Learn by building |
| Guide | Solve one practical task |
| Concept | Explain mental models |
| Reference | API lookup |
| Recipe | Complete production solution |
| Production | Operations & deployment |
| Architecture | Internal implementation |

If content belongs somewhere else, move it.

Do not duplicate it.

---

# User First

Always optimize for the user.

Never organize documentation around:

- repository structure
- packages
- source folders
- implementation
- backend architecture

Instead organize around:

- user goals
- capabilities
- workflows
- learning progression
- developer tasks

Users care about solving problems.

They do not care how the framework is implemented.

---

# Every Page Must Answer

Within the first screen users must understand:

- Where am I?
- Why should I read this?
- What problem does this solve?
- What will I learn?
- What should I do next?

If users must scroll before understanding the page,
the page is too slow.

---

# Reading Flow

Every page must have a clear reading journey.

Beginning

↓

Understanding

↓

Examples

↓

Decision

↓

Next Step

Never end a page without directing users somewhere useful.

Every page should naturally continue into another page.

---

# Mental Models Before Code

Always teach ideas before syntax.

Correct order:

Problem

↓

Mental Model

↓

Visualization

↓

Example

↓

Code

↓

Deep Dive

Never begin by dumping APIs.

Never explain code before explaining why it exists.

---

# Code Examples

Code examples exist to reinforce understanding.

Never write examples that exist only to fill space.

Rules:

- Complete
- Runnable
- Minimal
- Realistic
- Production-oriented

Avoid:

- ...
- pseudo-code
- incomplete snippets

Concept pages should contain small examples.

Reference pages may contain API examples.

Tutorials contain complete runnable code.

Recipes contain complete production solutions.

---

# Information Architecture

Documentation navigation must be predictable.

Users should naturally know where something belongs.

Avoid:

- duplicate pages
- overlapping categories
- inconsistent naming
- implementation-first navigation

Organize around capabilities.

Good:

Security

Validation

Streaming

Deployment

Bad:

middleware/

packages/

extensions/

internal/

---

# Visual Hierarchy

Every page must establish:

Primary

↓

Secondary

↓

Supporting

↓

Background

Never give everything equal emphasis.

Use:

- typography
- spacing
- contrast
- grouping

Avoid relying on color alone.

---

# Vertical Rhythm

Spacing must communicate relationships.

Related content

8–16px

Section

32–48px

Major section

64px

Never use random spacing.

Large unexplained vertical gaps are bugs.

Whitespace must either:

- group
- separate

Nothing else.

---

# Layout Rules

Avoid:

- unnecessary borders
- nested cards
- decorative containers
- floating actions
- giant empty hero sections

Prefer:

Whitespace

↓

Typography

↓

Grouping

↓

Subtle surfaces

Cards should solve organization problems.

Not decoration.

---

# Cards

Every card must have one purpose.

If removing the border does not reduce clarity,

remove the border.

Avoid:

Card

↓

Card

↓

Card

↓

Card

Prefer:

Heading

Paragraph

Code

Whitespace

---

# Navigation

Navigation must answer:

Where am I?

Where can I go?

What comes next?

Sidebar navigation should expose:

user goals

NOT

implementation.

---

# Progressive Disclosure

Do not overwhelm users.

Reveal complexity gradually.

Beginner

↓

Intermediate

↓

Advanced

↓

Architecture

Never expose advanced concepts before fundamentals.

---

# Copywriting

Write for developers.

Use:

- short sentences
- concrete language
- active voice
- direct wording

Avoid:

- marketing language
- buzzwords
- unnecessary adjectives
- vague explanations

Prefer:

"Maps a request to a handler."

Instead of:

"Provides an innovative routing solution."

---

# Consistency

Use consistent:

- terminology
- page structure
- spacing
- typography
- navigation
- section order
- component behavior

Never invent a new layout when an existing pattern already solves the problem.

---

# Component Rules

Every component must have one responsibility.

Examples:

Callout

↓

One warning

Timeline

↓

One learning sequence

Card

↓

One concept

Never overload components.

---

# Color Rules

Color communicates meaning.

Never use colors as decoration.

Maintain semantic meaning.

Blue

Information

Green

Success

Yellow

Warning

Red

Danger

Accent colors must reinforce hierarchy.

Not replace it.

---

# Accessibility

Every page must remain usable through:

- keyboard navigation
- screen readers
- sufficient contrast
- semantic headings
- meaningful labels

Never communicate meaning using color alone.

---

# UX Review Checklist

Before submitting changes ask:

✓ Can a beginner understand this?

✓ Can an experienced developer scan it quickly?

✓ Is the next action obvious?

✓ Is navigation predictable?

✓ Does the page reduce cognitive load?

✓ Is hierarchy obvious?

✓ Is spacing consistent?

✓ Is content grouped logically?

✓ Does every component have a purpose?

✓ Is there unnecessary visual noise?

---

# Release Blocking Rules

Reject the change if:

- navigation becomes deeper without improving discoverability
- implementation leaks into user navigation
- pages mix multiple documentation types
- code appears before the mental model
- visual hierarchy becomes flatter
- every section receives equal emphasis
- users cannot predict where information lives
- unnecessary cards are added
- large vertical gaps appear
- random spacing appears
- secondary actions compete with primary content
- pages end without a clear next step
- duplicate information appears across pages

---

# Bad Documentation Smells

Reject documentation that:

- feels like a blog post
- feels AI-generated
- repeats itself
- teaches APIs before concepts
- exposes implementation details too early
- contains giant hero sections with little information
- contains excessive whitespace
- relies on cards everywhere
- uses inconsistent terminology
- requires scrolling before users understand the page
- introduces multiple new ideas in one section
- has no obvious learning progression
- has no decision guidance
- has no next step

---

# Final Principle

Never ask:

"Does this page look good?"

Always ask:

"Can the right developer understand the right concept at the right time with the least amount of thinking?"

If the answer is no,

improve the documentation before merging.
