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
];

export function Features() {
  return (
    <section aria-labelledby="framework-capabilities" className="relative bg-fd-muted/40 py-24">
      <hr className="section-divider absolute inset-x-0 top-0" />
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 id="framework-capabilities" className="section-accent mb-6 text-3xl font-bold md:text-4xl">
            An explicit stack, not a magic box
          </h2>
          <p className="mb-8 text-lg text-fd-muted-foreground">
            Keep the request path understandable and add capabilities only where they solve a real application need.
          </p>
          <RequestLifecycle />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            const color = `var(${feature.colorVar})`;
            return (
              <div
                key={feature.title}
                className={`group rounded-2xl p-6 card-glow card-gradient-border transition-transform hover:-translate-y-1${
                  feature.emphasis ? ' ring-1 ring-[var(--brand-link)]/20' : ''
                }`}
                style={{ '--feature-color': color } as React.CSSProperties}
              >
                <div
                  className={`mb-4 inline-flex items-center justify-center rounded-xl ${
                    feature.emphasis ? 'size-16' : 'size-14'
                  }`}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} ${feature.emphasis ? 18 : 12}%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} ${feature.emphasis ? 26 : 22}%, transparent)`,
                  }}
                >
                  <Icon className={feature.emphasis ? 'size-8' : 'size-7'} style={{ color }} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-fd-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
