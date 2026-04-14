import { Globe, Lock, Package, Puzzle, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'High Performance',
    description:
      '35,000+ requests per second target on hello-world class routes (radix tree routing; hardware varies).',
    colorVar: '--warning',
  },
  {
    icon: Shield,
    title: 'Type Safe',
    description:
      'Full TypeScript with zero `any`. Catch errors at compile time, not in production.',
    colorVar: '--rush-blue',
  },
  {
    icon: Package,
    title: 'Modular',
    description: '30 packages in the monorepo. Install what you need. Core is under 3,000 lines of code.',
    colorVar: '--rush-purple',
  },
  {
    icon: Globe,
    title: 'Multi-Runtime',
    description: 'Node.js, Bun, Deno, and Edge. Write once, deploy anywhere.',
    colorVar: '--rush-cyan',
  },
  {
    icon: Puzzle,
    title: 'Plugin System',
    description: 'Extend with ease. Controllers, WebSocket, static files — all via plugins.',
    colorVar: '--rush-green',
  },
  {
    icon: Lock,
    title: 'Security Built-In',
    description: 'Helmet, CORS, rate limiting. Production security out of the box.',
    colorVar: '--danger',
  },
];

export function Features() {
  return (
    <section className="relative py-24">
      <hr className="section-divider absolute top-0 left-0 right-0" />
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-lg text-fd-muted-foreground max-w-2xl mx-auto">
            NextRush is designed for developers who value clarity over magic. Every feature earns
            its place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            const color = `var(${feature.colorVar})`;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-xl card-glow card-gradient-border"
                style={{ '--feature-color': color } as React.CSSProperties}
              >
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  <Icon className="size-5" style={{ color }} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-fd-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
