import { ArrowRight, BookOpen, Layers, Rocket } from 'lucide-react';
import Link from 'next/link';
import { DOCS_GETTING_STARTED, DOCS_GETTING_STARTED_OVERVIEW } from '@/lib/docs-links';

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
      <section aria-labelledby="explore-next" className="relative bg-transparent py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 id="explore-next" className="section-accent mb-3 text-3xl font-bold tracking-tight md:text-4xl">
              Choose your next step
            </h2>
            <p className="text-base font-medium text-fd-foreground/70 md:text-lg">
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
                      ? 'home-card group relative rounded-2xl p-6 ring-1 ring-[var(--brand-link)]/30 shadow-[0_12px_40px_-16px_var(--brand-link)] md:scale-[1.02]'
                      : 'home-card group rounded-2xl p-6'
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

      {/* Second soft band — packages as one parent surface, not floating cards on stripes */}
      <section aria-labelledby="packages" className="relative bg-surface-band py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-8 max-w-6xl text-center lg:mb-10 lg:text-left">
            <h2
              id="packages"
              className="section-accent section-accent-start mb-3 text-3xl font-bold tracking-tight md:text-4xl lg:text-left"
            >
              Small packages. Explicit composition.
            </h2>
            <p className="mx-auto max-w-2xl text-base font-medium text-fd-foreground/70 md:text-lg lg:mx-0">
              Install only what your application needs — start with the core, then add capabilities as your application
              grows.
            </p>
          </div>

          {/* One ecosystem container: category rail → package cards */}
          <div className="home-panel mx-auto max-w-6xl overflow-hidden rounded-2xl">
            <div
              className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 border-b border-[color-mix(in_srgb,var(--brand-link)_8%,var(--border-subtle))] px-4 py-3 sm:justify-start sm:gap-x-0 sm:px-6"
              aria-hidden="true"
            >
              {packageGroups.map((group, index) => (
                <span key={group.title} className="flex items-center text-sm">
                  {index > 0 ? (
                    <span className="mx-2 hidden text-fd-border sm:inline" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <span
                    className={
                      index === 0
                        ? 'font-semibold text-[var(--brand-link)]'
                        : 'font-medium text-fd-muted-foreground'
                    }
                  >
                    {group.title}
                  </span>
                </span>
              ))}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:gap-5 lg:p-8">
              {packageGroups.map((group, index) => (
                <section
                  key={group.title}
                  className={`home-card rounded-xl p-5 ${index === 0 ? 'ring-1 ring-[var(--brand-link)]/12' : ''}`}
                >
                  <h3 className="mb-1 text-base font-semibold tracking-tight">{group.title}</h3>
                  <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground/60">
                    {index === 0 ? 'Start here' : index === 3 ? 'Dev tooling' : 'Optional'}
                  </p>
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
                          <span className="mt-1 block text-sm leading-relaxed text-fd-muted-foreground">
                            {description}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="border-t border-[color-mix(in_srgb,var(--brand-link)_6%,var(--border-subtle))] px-5 py-4 text-center sm:px-6 lg:px-8 lg:text-left">
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
        </div>
      </section>
    </>
  );
}
