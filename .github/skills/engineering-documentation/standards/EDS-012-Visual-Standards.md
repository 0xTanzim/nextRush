# EDS-012 — Visual Standards

> A diagram is a tool for lowering cognitive load, not decoration. If it doesn't help the reader build an accurate mental model faster than prose would, it doesn't belong on the page.

This standard governs *diagrams* — ASCII, Mermaid, tables, and the like. Interactive MDX components (Tabs, Steps, Cards, CodeGroups) are the sibling standard **EDS-016**; read both when a page is visual-heavy. Accessibility of every visual is **EDS-017**.

---

## The one rule

Add a visual only when the plain-text alternative would be harder to follow. A diagram that restates the sentence above it is noise. A diagram that replaces two paragraphs of "first this, then that, then the other" is gold. When in doubt, write the prose first and add the diagram only if the prose is still hard to hold in your head.

## Choose the diagram to fit the question

| The reader is asking… | Use |
|---|---|
| "How do these layers stack?" | ASCII flow or layer diagram |
| "What's the decision/branch logic?" | Mermaid flowchart |
| "Who talks to whom, and in what order?" | Mermaid sequence diagram |
| "How do these packages/components relate?" | Architecture / dependency diagram |
| "What happens over time?" | Timeline |
| "How does X compare to Y?" | Comparison table |
| "What states can this be in?" | State diagram |

Pick the *simplest* form that answers the question. A three-line ASCII flow often beats an elaborate Mermaid graph.

## ASCII vs Mermaid — and where they render

- **ASCII** is the most portable: it renders in a terminal, on GitHub, on npm, and in any Markdown. Prefer it for simple flows and layer diagrams. Keep it monospaced, aligned, and compact.
- **Mermaid** is richer (sequence, state, class diagrams) and renders on the docs site and GitHub — **but not on npm.** Never put a Mermaid diagram in a package README; use ASCII or link out (this is the same portability rule as EDS-016).

## One idea per diagram

A diagram explains exactly one thing. If it has crossing arrows, tiny labels, or five concepts fighting for attention, split it. Complex systems are taught with *several small diagrams that build*, not one poster:

```text
small diagram → explain → larger diagram → explain → full picture
```

## Always explain the diagram

A diagram without its explanation is half a thought. After every visual, say in one or two sentences what the reader is looking at and what to notice. Never assume the picture is self-evident — the author sees the whole system; the reader sees shapes.

## Label with real names

Use `Application`, `Router`, `Middleware`, `Adapter` — the actual names from the system, matching the code and the surrounding prose. Never `A`, `B`, `Node1`. Meaningful labels are what let the diagram connect to everything else the reader is learning.

## Keep it consistent

Same component names, same arrow direction, same layout conventions across every diagram in the doc set. A reader should not have to relearn your visual language on each page. Solid arrow = synchronous flow; dashed = async/event, applied uniformly.

## Balance text and visuals

The rhythm is prose → visual → prose (EDS-016's composition rule). Don't stack three diagrams with no connective text between them, and don't open a page with a diagram before the reader knows why it matters.

## Accessibility (owned by EDS-017)

Every diagram needs an adjacent written explanation that carries the same idea — a screen reader can't read the picture, and the diagram may fail to render. Never encode meaning in color alone. Give raster images real alt text.

## When *not* to use a diagram

Simple API methods, small code snippets, obvious relationships, basic config. A clear sentence beats an unnecessary diagram every time. The absence of a diagram is not a gap.

## Success

The reader never thinks *"what am I looking at?"* — they think *"oh, now I get it."* If removing a diagram makes the explanation harder, it earned its place. If removing it changes nothing, remove it.
