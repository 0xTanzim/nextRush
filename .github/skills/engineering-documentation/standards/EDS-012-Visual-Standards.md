# EDS-012 — Visual Standards

> A diagram is a tool for lowering cognitive load, not decoration. If it doesn't help the reader build an accurate mental model faster than prose would, it doesn't belong on the page. **But when a diagram earns its place, it must be the *right, modern* diagram — not a generic flowchart standing in for a system it doesn't actually model.**

This standard governs *diagrams* — Mermaid, ASCII, tables. Interactive MDX components (Tabs, Steps, Cards, CodeGroups) are the sibling standard **EDS-016**; read both when a page is visual-heavy. Accessibility of every visual is **EDS-017**.

**Mermaid is the default diagram engine, and the [`mermaid` skill](../../../mermaid/SKILL.md) (`~/.kiro/skills/mermaid/SKILL.md`) is the syntax source of truth.** It documents 25+ diagram types with a per-type reference file. **Load it and read the specific reference file (`references/<type>.md`) before authoring any diagram type you don't have memorized** — do not guess syntax from memory. Guessing a diagram's syntax is the same class of error as guessing an API signature.

---

## The one rule

Add a visual only when the plain-text alternative would be harder to follow. A diagram that restates the sentence above it is noise. A diagram that replaces two paragraphs of "first this, then that, then the other" is gold. When in doubt, write the prose first and add the diagram only if the prose is still hard to hold in your head.

## The quality bar: precise and modern, never basic-by-default

The most common failure is **reaching for a generic `flowchart` for everything.** A flowchart of boxes-and-arrows where the subject is really a *sequence of messages*, a *state machine*, a *system's containers*, or a *data flow* is a missed opportunity — it under-models the system and looks amateur. **Pick the most specific diagram type that truthfully models the subject.** A NextRush system deserves system-design-grade visuals: C4/architecture for topology, sequence for the request lifecycle, state for connection/request lifecycles, ER for data, block/packet for structure.

This is a hard quality gate, the same weight as a code example that doesn't compile: **a page whose only diagrams are basic flowcharts, where a more precise type was available and appropriate, is not done.**

## Choose the diagram to fit the question (the catalog)

Read the linked `mermaid` skill reference before authoring each.

| The reader is asking… | Use | Skill reference |
|---|---|---|
| "How is the whole system / its containers & context structured?" | **C4** (context/container/component) or **Architecture** diagram | `c4.md`, `architecture.md` |
| "How do these packages/services/modules connect?" | **Architecture** or **Block** diagram | `architecture.md`, `block.md` |
| "Who talks to whom, and in what order?" (request lifecycle, handshakes) | **Sequence** diagram (or **ZenUML** for code-style) | `sequenceDiagram.md`, `zenuml.md` |
| "What states can this be in, and how does it transition?" | **State** diagram | `stateDiagram.md` |
| "What's the decision/branch logic or pipeline?" | **Flowchart** | `flowchart.md` |
| "How is the data / schema shaped and related?" | **ER** diagram | `entityRelationshipDiagram.md` |
| "What is the class / type structure & inheritance?" | **Class** diagram | `classDiagram.md` |
| "How is a packet / binary layout / protocol framed?" | **Packet** diagram | `packet.md` |
| "How does data/traffic flow and split by volume?" | **Sankey** diagram | `sankey.md` |
| "How do metrics compare over a range?" | **XY chart** (line/bar) | `xyChart.md` |
| "How does X score across multiple dimensions?" | **Radar** chart | `radar.md` |
| "How is this hierarchy / size distribution composed?" | **Treemap** or **Mindmap** | `treemap.md`, `mindmap.md` |
| "What happens over time / release history?" | **Timeline** or **Gitgraph** | `timeline.md`, `gitgraph.md` |
| "What's the project plan / phased rollout?" | **Gantt** | `gantt.md` |
| "How does the user move through the experience?" | **User Journey** | `userJourney.md` |
| "Four-quadrant / trade-off positioning?" | **Quadrant** chart | `quadrantChart.md` |
| "How do requirements trace to implementation?" | **Requirement** diagram | `requirementDiagram.md` |

Within that, still pick the *simplest form that fully answers the question* — precision is not the same as complexity. A focused 6-node architecture diagram beats a 40-node one.

## Where each renders — match the diagram to the surface (honesty rule)

Never author a diagram a surface can't render. Three surfaces, three capabilities:

| Surface | Engine | What renders |
|---|---|---|
| **Docs site** (`apps/website`, Fumadocs) | mermaid **11.x** | **All core + modern types**: flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline, gitgraph, quadrant, requirement, **sankey, xychart, block, packet, architecture, treemap, radar, user-journey, kanban**. **C4 = experimental** (renders, but treat as unstable — prefer `architecture` for topology unless C4's formal notation is the point). **ZenUML = NOT wired yet** (needs `registerExternalDiagrams` + `@mermaid-js/mermaid-zenuml` — a tooling task; until wired, use `sequenceDiagram`). |
| **GitHub** (repo `ARCHITECTURE.md`, RFCs, blog source) | GitHub mermaid | Core + most modern types. Safe for package **`ARCHITECTURE.md`** — use rich Mermaid here. |
| **npm** (package **`README.md`**) | none | **No Mermaid at all.** Package READMEs use **ASCII** diagrams or link to the docs-site/ARCHITECTURE version. This is the portability rule. |

**README vs ARCHITECTURE:** a package's `README.md` (npm landing) is ASCII-only; its `ARCHITECTURE.md` (GitHub) is where the advanced Mermaid system diagrams live. Don't put Mermaid in a README; don't waste an ARCHITECTURE page on ASCII when a real architecture/sequence/state diagram models it better.

## Style for a professional look

Plain default Mermaid is fine, but system-design diagrams read better with deliberate styling — consistent node classes, subgraphs to group layers, and a direction that matches reading flow. Use the skill's config references (`config-theming.md`, `config-layouts.md`, `config-directives.md`) for `classDef`, `subgraph`, and `direction`. On the docs site the `<Mermaid>` component already themes light/dark — don't hardcode colors that break one mode; encode meaning in shape/label/grouping, not color alone (EDS-017).

## One idea per diagram, built up small → large

A diagram explains exactly one thing. If it has crossing arrows, tiny labels, or five concepts fighting for attention, split it. Teach complex systems with *several small diagrams that build*, not one poster:

```text
small diagram → explain → larger diagram → explain → full picture
```

## Always explain the diagram

A diagram without its explanation is half a thought. After every visual, say in one or two sentences what the reader is looking at and what to notice. Never assume the picture is self-evident — the author sees the whole system; the reader sees shapes.

## Label with real names

Use `Application`, `Router`, `Middleware`, `Adapter` — the actual names from the system, matching the code and the surrounding prose. Never `A`, `B`, `Node1`. Meaningful labels are what let the diagram connect to everything else the reader is learning.

## Keep it consistent

Same component names, same arrow direction, same layout conventions across every diagram in the doc set. A reader should not have to relearn your visual language on each page. Solid arrow = synchronous flow; dashed = async/event, applied uniformly. Keep a repo-wide diagram legend (documented once, globally — not repeated per page).

## Balance text and visuals

The rhythm is prose → visual → prose (EDS-016's composition rule). Don't stack three diagrams with no connective text between them, and don't open a page with a diagram before the reader knows why it matters.

## Accessibility (owned by EDS-017)

Every diagram needs an adjacent written explanation that carries the same idea — a screen reader can't read the picture, and the diagram may fail to render. Never encode meaning in color alone. Give raster images real alt text.

## When *not* to use a diagram

Simple API methods, small code snippets, obvious relationships, basic config. A clear sentence beats an unnecessary diagram every time. The absence of a diagram is not a gap — and a *wrong* or *basic-by-default* diagram is worse than none.

## Success

The reader never thinks *"what am I looking at?"* — they think *"oh, now I get it."* If removing a diagram makes the explanation harder, it earned its place. If a generic flowchart could be replaced by a truer sequence/state/architecture diagram, it must be. If removing it changes nothing, remove it.
