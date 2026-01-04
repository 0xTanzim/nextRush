import { Globe, Lock, Package, Puzzle, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Blazing Fast',
    description: '30,000+ requests per second with radix tree routing. No compromise on performance.',
    color: '#f59e0b',
  },
  {
    icon: Shield,
    title: 'Type Safe',
    description: 'Full TypeScript with zero `any`. Catch errors at compile time, not in production.',
    color: '#3b82f6',
  },
  {
    icon: Package,
    title: 'Modular',
    description: '27+ packages. Install what you need. Core is under 3,000 lines of code.',
    color: '#8b5cf6',
  },
  {
    icon: Globe,
    title: 'Multi-Runtime',
    description: 'Node.js, Bun, Deno, and Edge. Write once, deploy anywhere.',
    color: '#22d3ee',
  },
  {
    icon: Puzzle,
    title: 'Plugin System',
    description: 'Extend with ease. Controllers, WebSocket, static files — all via plugins.',
    color: '#22c55e',
  },
  {
    icon: Lock,
    title: 'Security Built-In',
    description: 'Helmet, CORS, rate limiting. Production security out of the box.',
    color: '#ef4444',
  },
];

export function Features() {
  return (
    <section className="py-24 border-t border-[#27272a]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto">
            NextRush is designed for developers who value clarity over magic.
            Every feature earns its place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border border-[#27272a] bg-[#18181b]/50 hover:border-[#3f3f46] transition-all duration-200 card-hover"
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <Icon className="size-6" style={{ color: feature.color }} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-[#a1a1aa]">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
