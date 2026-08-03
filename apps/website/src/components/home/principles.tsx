import { Boxes, Eye, Gauge, Layers } from 'lucide-react';

const principles = [
  {
    icon: Eye,
    title: 'Explicit',
    description: 'No hidden behavior',
    colorVar: '--rush-blue',
  },
  {
    icon: Layers,
    title: 'Composable',
    description: 'Add only what you need',
    colorVar: '--rush-purple',
  },
  {
    icon: Gauge,
    title: 'Predictable',
    description: 'Reason about every request',
    colorVar: '--rush-cyan',
  },
  {
    icon: Boxes,
    title: 'Portable',
    description: 'One codebase, every runtime',
    colorVar: '--rush-green',
  },
] as const;

export function Principles() {
  return (
    <section aria-labelledby="framework-principles" className="relative py-20 md:py-24">
      <hr className="section-divider absolute inset-x-0 top-0" />
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 id="framework-principles" className="mb-3 text-3xl font-bold md:text-4xl">
            Built around four principles
          </h2>
          <p className="text-lg text-fd-muted-foreground">
            Every decision optimizes for clarity, composability, and long-term maintainability.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {principles.map((principle) => {
            const Icon = principle.icon;
            const color = `var(${principle.colorVar})`;
            return (
              <div
                key={principle.title}
                className="flex flex-col items-center rounded-xl border border-fd-border bg-fd-card/40 p-4 text-center transition-colors hover:border-[color-mix(in_srgb,var(--rush-blue)_35%,var(--color-fd-border))] sm:p-5"
              >
                <div
                  className="mb-3 inline-flex size-12 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
                  }}
                >
                  <Icon className="size-6" style={{ color }} aria-hidden="true" />
                </div>
                <h3 className="mb-1 text-lg font-semibold">{principle.title}</h3>
                <p className="text-sm text-fd-muted-foreground">{principle.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}