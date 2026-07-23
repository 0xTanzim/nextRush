/**
 * The whole framework on one line: Request → Application → Middleware → Router
 * → Handler → Response. Placed right after the hero as the page's single mental
 * anchor — every section below explains one stop on this flow, and the numbered
 * "Core mental model" timeline re-uses these same accent colors so a reader
 * recognizes each concept by color, not by re-reading its name.
 */

/** Concept stops carry an accent that matches the timeline below; plumbing
 *  stops (Request/Handler/Response) stay neutral so the eye lands on concepts.
 *  Sourced from the locked learning-color map (TOKENS.md 5) via the Semantic
 *  layer — this object is the one place the mapping is authored in code, per
 *  design.md 6's learningColor() convention; mental-model.tsx's timeline
 *  reads the same --learning-* tokens directly, so the two never drift. */
const stepAccent: Record<string, string> = {
  Application: 'var(--learning-application)',
  Middleware: 'var(--learning-middleware)',
  Router: 'var(--learning-router)',
  Context: 'var(--learning-context)',
};

export function MentalModelFlow({ steps }: { steps: string[] }) {
  return (
    <div className="not-prose my-6">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {steps.map((step, i) => {
          const accent = stepAccent[step];
          return (
            <li key={step} className="flex items-center gap-1.5">
              <span
                className="rounded-full border px-3 py-1.5 text-sm font-medium"
                style={
                  accent
                    ? {
                        // Accent as a tint + border, text stays --text-primary so the
                        // label is readable on every hue (green/cyan would fail as fg).
                        borderColor: `color-mix(in srgb, ${accent} 45%, var(--color-fd-border))`,
                        background: `color-mix(in srgb, ${accent} 12%, var(--color-fd-card))`,
                        color: 'var(--text-primary)',
                      }
                    : {
                        borderColor: 'var(--color-fd-border)',
                        background: 'var(--color-fd-card)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                {step}
              </span>
              {i < steps.length - 1 ? (
                <span className="text-[var(--text-subtle)]" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
