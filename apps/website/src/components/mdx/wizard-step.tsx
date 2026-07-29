import type { ReactNode } from 'react';

interface WizardStepProps {
  /** Step number (displayed in a circle) */
  number: number;
  /** Step title */
  title: ReactNode;
  /** Step content */
  children: ReactNode;
}

interface WizardFlowProps {
  children: ReactNode;
}

/**
 * WizardFlow — wraps WizardStep children into a numbered vertical timeline.
 *
 * @example
 * ```mdx
 * <WizardFlow>
 *   <WizardStep number={1} title="Project name">
 *     Where to create the project. Defaults to `my-nextrush-app`.
 *   </WizardStep>
 *   <WizardStep number={2} title="Style">
 *     <Cards>...</Cards>
 *   </WizardStep>
 * </WizardFlow>
 * ```
 */
export function WizardFlow({ children }: WizardFlowProps) {
  return <div className="not-prose my-6">{children}</div>;
}

export function WizardStep({ number, title, children }: WizardStepProps) {
  return (
    <div className="flex gap-4 group">
      {/* Number circle + connector line */}
      <div className="flex-shrink-0 flex flex-col items-center w-8">
        <div className="size-8 rounded-full bg-[var(--rush-blue)] text-white flex items-center justify-center text-sm font-bold shadow-sm">
          {number}
        </div>
        <div className="w-px flex-1 bg-[var(--bg-border)] group-last:hidden mt-1 mb-1" />
      </div>

      {/* Content */}
      <div className="pb-5 group-last:pb-0 min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--text-primary)] mt-1">
          {title}
        </h3>
        <div className="mt-2 text-[var(--text-secondary)] [&_p]:text-[var(--text-secondary)]">
          {children}
        </div>
      </div>
    </div>
  );
}
