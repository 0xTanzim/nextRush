import { ArrowRight, BookOpen, Layers, Rocket } from 'lucide-react';
import Link from 'next/link';
import { DOCS_GETTING_STARTED, DOCS_GETTING_STARTED_OVERVIEW } from '@/lib/docs-links';
import { RequestLifecycle } from '@/components/home/request-lifecycle';

const nextSteps = [
  {
    icon: Rocket,
    title: 'Start with the mental model',
    description: 'See how applications, routers, middleware, and adapters fit together before writing code.',
    href: DOCS_GETTING_STARTED,
    action: 'Read introduction',
    color: '--brand-link',
  },
  {
    icon: Layers,
    title: 'Explore the architecture',
    description: 'Trace the request lifecycle, package boundaries, runtime support, and performance methodology.',
    href: DOCS_GETTING_STARTED_OVERVIEW,
    action: 'View framework map',
    color: '--learning-context',
  },
  {
    icon: BookOpen,
    title: 'Build from the docs',
    description: 'Move from concepts to guides, recipes, and API reference when you know what you need.',
    href: '/docs',
    action: 'Browse documentation',
    color: '--learning-middleware',
  },
] as const;

const packageGroups = [
  {
    title: 'Core',
    packages: [
      ['nextrush', 'Functional HTTP core'],
      ['@nextrush/core', 'Application and Context'],
    ],
  },
  {
    title: 'Class-based',
    packages: [
      ['@nextrush/class', 'Controllers, modules, and lifecycle'],
      ['@nextrush/di', 'Dependency injection'],
    ],
  },
  {
    title: 'Capabilities',
    packages: [
      ['@nextrush/events', 'Typed application events'],
      ['@nextrush/stream', 'SSE and NDJSON responses'],
    ],
  },
  {
    title: 'Tooling',
    packages: [
      ['create-nextrush', 'Project scaffolding'],
      ['@nextrush/dev', 'Development server and builds'],
    ],
  },
] as const;

export function HomeExplore() {
  return (
    <>
      <section aria-labelledby="explore-next" className="relative py-24">
        <hr className="section-divider absolute inset-x-0 top-0" />
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 id="explore-next" className="mb-4 text-3xl font-bold md:text-4xl">
              Choose your next step
            </h2>
            <p className="text-lg text-fd-muted-foreground">
              Learn the model first, then move into architecture or task-focused documentation.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {nextSteps.map((step, index) => {
              const Icon = step.icon;
              const isPrimary = index === 0;
              return (
                <Link
                  key={step.title}
                  href={step.href}
                  className={
                    isPrimary
                      ? 'group relative rounded-xl p-6 card-glow card-gradient-border ring-1 ring-[var(--brand-link)]/40 shadow-[0_12px_40px_-16px_var(--brand-link)] md:col-span-1 md:row-span-1 md:scale-[1.02]'
                      : 'group rounded-xl p-6 card-glow card-gradient-border'
                  }
                >
                  {isPrimary && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand-link)] px-2.5 py-0.5 text-xs font-semibold text-white">
                      Start here
                    </span>
                  )}
                  <span
                    className="mb-5 inline-flex size-10 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(${step.color}) 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, var(${step.color}) 12%, transparent)`,
                    }}
                  >
                    <Icon className="size-5" style={{ color: `var(${step.color})` }} aria-hidden="true" />
                  </span>
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="mb-5 text-fd-muted-foreground">{step.description}</p>
                  <span className="inline-flex items-center gap-1 font-medium" style={{ color: `var(${step.color})` }}>
                    {step.action}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="packages" className="relative bg-fd-muted/40 py-24">
        <hr className="section-divider absolute inset-x-0 top-0" />
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-3xl text-center lg:mb-8 lg:max-w-none lg:text-left">
            <h2 id="packages" className="mb-4 text-3xl font-bold md:text-4xl">
              Small packages. Explicit composition.
            </h2>
            <p className="text-lg text-fd-muted-foreground">
              Install only what your application needs — start with the core, then add capabilities as your application grows.
            </p>
          </div>
          <div className="mb-12 rounded-xl border border-fd-border bg-fd-card/40 px-4 py-6">
            <RequestLifecycle />
          </div>
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packageGroups.map((group) => (
              <section key={group.title} className="rounded-xl p-5 card-glow card-gradient-border">
                <h3 className="mb-4 text-lg font-semibold">{group.title}</h3>
                <ul className="space-y-4">
                  {group.packages.map(([name, description]) => (
                    <li key={name}>
                      <a
                        href={`https://www.npmjs.com/package/${name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                      >
                        <span className="block font-mono text-sm font-semibold text-[#057088] dark:text-[var(--learning-context)] group-hover:underline">
                          {name}
                        </span>
                        <span className="mt-1 block text-sm text-fd-muted-foreground">{description}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href="https://www.npmjs.com/~0xtanzim"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              View all packages on npm
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
