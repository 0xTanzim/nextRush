import { ArrowRight } from 'lucide-react';

const stages = ['Request', 'Router', 'Middleware', 'Context', 'Response'] as const;

export function RequestLifecycle() {
  return (
    <div
      aria-label="Request lifecycle: Request, Router, Middleware, Context, Response"
      className="group mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3"
    >
      {stages.map((stage, index) => (
        <div key={stage} className="flex items-center gap-2 sm:gap-3">
          <span className="rounded-lg border border-fd-border bg-fd-card px-4 py-2 font-mono text-sm font-medium text-fd-foreground transition-transform hover:-translate-y-0.5 hover:border-[var(--rush-blue)]/40">
            {stage}
          </span>
          {index < stages.length - 1 && (
            <ArrowRight
              className="lifecycle-arrow size-4 text-fd-muted-foreground transition-transform duration-300 group-hover:translate-x-1"
              style={{ transitionDelay: `${index * 80}ms` }}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}
