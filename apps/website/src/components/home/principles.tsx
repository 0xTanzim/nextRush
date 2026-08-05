import { Boxes, Eye, Gauge, Layers } from 'lucide-react';

const principles = [
  {
    icon: Eye,
    title: 'Explicit',
    description: 'Every behavior is declared in your code—no magic hooks, no hidden middleware.',
    keyword: 'No surprises',
    colorVar: '--brand-link',
  },
  {
    icon: Layers,
    title: 'Composable',
    description: 'Start with a small core. Add routers, middleware, and modules only when you need them.',
    keyword: 'Opt-in surface',
    colorVar: '--learning-middleware',
  },
  {
    icon: Gauge,
    title: 'Predictable',
    description: 'Trace any request from adapter to response without guessing framework behavior.',
    keyword: 'Reasonable paths',
    colorVar: '--learning-context',
  },
  {
    icon: Boxes,
    title: 'Portable',
    description: 'One application model across Node.js, Bun, Deno, and Edge—adapters own the rest.',
    keyword: 'Runtime free',
    colorVar: '--status-success',
  },
] as const;

export function Principles() {
  return (
    /* Same canvas — cards create separation, not a full-width wash */
    <section aria-labelledby="framework-principles" className="relative bg-transparent py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
          <h2 id="framework-principles" className="section-accent mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            Built around four principles
          </h2>
          <p className="text-base font-medium text-fd-foreground/70 md:text-lg">
            Every decision optimizes for clarity, composability, and long-term maintainability.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {principles.map((principle) => {
            const Icon = principle.icon;
            const color = `var(${principle.colorVar})`;
            return (
              <div
                key={principle.title}
                className="home-card flex flex-col rounded-xl p-6 text-left transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(0,0,0,0.12)]"
              >
                <div
                  className="mb-4 inline-flex size-9 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 17%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
                  }}
                >
                  <Icon className="size-5" style={{ color }} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight">{principle.title}</h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-fd-muted-foreground">
                  {principle.description}
                </p>
                <span
                  className="inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide"
                  style={{
                    color,
                    backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                  }}
                >
                  {principle.keyword}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
