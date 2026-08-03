import type { ReactNode } from 'react';

interface SetupStepProps {
  /** Step number (displayed in a circle on the connector line) */
  number: number;
  /** Step title (rendered as an H3 so it joins the page's TOC) */
  title: ReactNode;
  /** Step content — prose, code blocks, and MDX components all render normally */
  children: ReactNode;
}

interface SetupTimelineProps {
  children: ReactNode;
}

/**
 * SetupTimeline — a connected, numbered vertical timeline for onboarding setup
 * steps (Create → Install → Run).
 *
 * Distinct from the generic Fumadocs `<Steps>` and from `<WizardFlow>`:
 *
 * - Fumadocs `<Steps>` renders a 1px left border as its connector — too subtle
 *   to read as "keep going" on a fast-scan onboarding page (feedback
 *   create-nextrush/doc2.md #2: "the 3 steps still don't feel connected").
 * - `<WizardFlow>` has the prominent connector this page wants, but wraps its
 *   children in `not-prose`, which strips `.prose` styling and breaks the
 *   rendering of fenced code blocks and `<ScaffoldCommand>` inside a step.
 *
 * `SetupTimeline` keeps the prominent circle + connector-line design (so the
 * steps read as one journey, not three independent cards) while leaving
 * `.prose` in effect so code, commands, and inline markup render correctly.
 *
 * @example
 * ```mdx
 * <SetupTimeline>
 *   <SetupStep number={1} title="Create the project">
 *     Run the scaffolder:
 *     <ScaffoldCommand commands={{ pnpm: 'pnpm create nextrush@latest' }} />
 *   </SetupStep>
 *   <SetupStep number={2} title="Install">…</SetupStep>
 *   <SetupStep number={3} title="Run">…</SetupStep>
 * </SetupTimeline>
 * ```
 */
export function SetupTimeline({ children }: SetupTimelineProps) {
  return <div className="setup-timeline my-8">{children}</div>;
}

export function SetupStep({ number, title, children }: SetupStepProps) {
  return (
    <div className="setup-step group">
      {/* Number circle + connector line (hidden after the last step) */}
      <div className="setup-step__rail" aria-hidden>
        <div className="setup-step__circle">{number}</div>
        <div className="setup-step__line" />
      </div>

      {/* Content — prose stays in effect so code blocks render correctly */}
      <div className="setup-step__body">
        <h3 className="setup-step__title">{title}</h3>
        <div className="setup-step__content">{children}</div>
      </div>
    </div>
  );
}
