import { Globe, Lock, Package, Puzzle, Shield, Zap } from 'lucide-react';
import { RequestLifecycle } from '@/components/home/request-lifecycle';

const features = [
  {
    icon: Zap,
    title: 'Segment-trie routing',
    description: 'Route matching scales with URL segments rather than route count, while keeping application code explicit.',
    colorVar: '--warning',
    emphasis: true,
  },
  {
    icon: Shield,
    title: 'Typed request flow',
    description: 'Context, routes, middleware, and errors share TypeScript contracts without loosening to `any`.',
    colorVar: '--brand-link',
    emphasis: true,
  },
  {
    icon: Package,
    title: 'Small core, optional modules',
    description: 'Start with the functional core, then add middleware, streaming, or class-based composition when needed.',
    colorVar: '--learning-middleware',
    emphasis: true,
  },
  {
    icon: Globe,
    title: 'Web-standard adapters',
    description: 'Write against Request, Response, streams, and AbortSignal; adapters carry runtime-specific details.',
    colorVar: '--learning-context',
    emphasis: false,
  },
  {
    icon: Puzzle,
    title: 'Class runtime when it helps',
    description: 'Controllers, modules, request scopes, guards, and lifecycle hooks remain an opt-in path.',
    colorVar: '--status-success',
    emphasis: false,
  },
  {
    icon: Lock,
    title: 'Security as composition',
    description: 'Add CORS, headers, CSRF protection, rate limits, and validation as intentional middleware choices.',
    colorVar: '--danger',
    emphasis: false,
  },
] as const;

export function Features() {
  return (
    /* First soft band — rare full-width wash, not every other section */
    <section aria-labelledby="framework-capabilities" className="relative bg-surface-band-soft py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Diagram first, then heading — breaks heading→cards monotony */}
        <div className="mx-auto mb-10 max-w-4xl home-card rounded-2xl px-4 py-6 sm:px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.1em] text-fd-muted-foreground/70">
            Request lifecycle
          </p>
          <RequestLifecycle />
        </div>

        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
          <h2
            id="framework-capabilities"
            className="section-accent mb-3 text-3xl font-bold tracking-tight md:text-4xl"
          >
            An explicit stack, not a magic box
          </h2>
          <p className="text-base font-medium text-fd-foreground/70 md:text-lg">
            Keep the request path understandable and add capabilities only where they solve a real application need.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            const color = `var(${feature.colorVar})`;
            return (
              <div
                key={feature.title}
                className={
                  feature.emphasis
                    ? 'home-card group rounded-2xl p-6 shadow-[0_10px_32px_-18px_rgba(0,0,0,0.14)] transition-transform hover:-translate-y-0.5 dark:shadow-[0_10px_32px_-18px_rgba(0,0,0,0.45)]'
                    : 'home-card group rounded-2xl p-6 opacity-95 transition-opacity hover:opacity-100'
                }
                style={{ '--feature-color': color } as React.CSSProperties}
              >
                <div
                  className={`mb-4 inline-flex items-center justify-center rounded-lg ${
                    feature.emphasis ? 'size-11' : 'size-9'
                  }`}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} ${feature.emphasis ? 18 : 14}%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} ${feature.emphasis ? 26 : 20}%, transparent)`,
                  }}
                >
                  <Icon className={feature.emphasis ? 'size-5' : 'size-4'} style={{ color }} aria-hidden="true" />
                </div>
                <h3
                  className={`mb-2 tracking-tight ${
                    feature.emphasis ? 'text-lg font-semibold' : 'text-base font-semibold text-fd-foreground/90'
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={
                    feature.emphasis
                      ? 'text-sm leading-relaxed text-fd-muted-foreground'
                      : 'text-sm leading-relaxed text-fd-muted-foreground/85'
                  }
                >
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
