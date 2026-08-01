import { Fragment, type CSSProperties } from 'react';

/**
 * The whole framework on one line: Request → Application → Middleware → Router
 * → Handler → Response. Placed right after the hero as the page's single mental
 * anchor — every section below explains one stop on this flow, and the
 * numbered "Core mental model" timeline re-uses these same accent colors so a
 * reader recognizes each concept by color, not by re-reading its name.
 *
 * Feedback (start.md #2/#6, start1.md #16): the old version was a row of pills
 * with a literal "→" glyph between them — it read as a list of equal chips,
 * not a connected diagram, and the chips looked clickable but weren't. This
 * version is a real flow diagram: a ruled connector between stops, and the four
 * concept stops are clickable in-page anchors that jump to the matching
 * `#application` / `#middleware` / `#router` / `#context` heading in the
 * "Core mental model" timeline below — so the diagram doubles as a chapter
 * index, not decoration. Plumbing stops (Request / Handler / Response) stay
 * neutral; concept stops carry their locked learning color (TOKENS.md 5),
 * matching the timeline's per-h3 accent so the eye links the two views.
 */
const CONCEPTS = new Set(['Application', 'Middleware', 'Router', 'Context']);

const stepAccent: Record<string, string> = {
  Application: 'var(--learning-application)',
  Middleware: 'var(--learning-middleware)',
  Router: 'var(--learning-router)',
  Context: 'var(--learning-context)',
};

export function MentalModelFlow({ steps }: { steps: string[] }) {
  return (
    <ol className="mm-flow not-prose" role="list" aria-label="Request flow through NextRush">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isConcept = CONCEPTS.has(step);
        const accent = stepAccent[step];
        const style = isConcept ? ({ '--mm-accent': accent } as CSSProperties) : undefined;
        const slug = step.toLowerCase();

        return (
          <Fragment key={step}>
            {isConcept ? (
              <li className="mm-flow__stop" data-concept="" style={style}>
                <a
                  href={`#${slug}`}
                  aria-label={`Jump to the ${step} concept`}
                  className="mm-flow__link"
                >
                  {step}
                </a>
              </li>
            ) : (
              <li className="mm-flow__stop" style={style}>
                {step}
              </li>
            )}
            {!isLast ? <li className="mm-flow__connector" aria-hidden="true" /> : null}
          </Fragment>
        );
      })}
    </ol>
  );
}