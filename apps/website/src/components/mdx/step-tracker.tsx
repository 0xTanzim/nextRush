const DEFAULT_STEPS = ['Choose', 'Install', 'Verify', 'Done'] as const;

interface StepTrackerProps {
  /** Step labels; defaults to the choose/install/verify/done flow. */
  steps?: readonly string[];
  /** 0-based index of the active step. */
  current?: number;
  className?: string;
}

/**
 * StepTracker — a small horizontal progress strip for onboarding/installation
 * pages (feedback install.md: "people love knowing where they are").
 *
 * A server component: purely presentational, so it renders on every page with
 * zero client JS. Done steps show a ✓, the current step is filled in brand
 * blue, and upcoming steps stay muted. The connector line between steps is
 * drawn with CSS (`::after` on each step except the last), so the DOM stays a
 * clean, accessible `<ol>`.
 *
 * @example
 * ```mdx
 * <StepTracker current={1} />
 * ```
 */
export function StepTracker({ steps, current = 1, className }: StepTrackerProps) {
  const list = steps ?? DEFAULT_STEPS;
  return (
    <ol
      className={`step-tracker not-prose ${className ?? ''}`}
      aria-label="Page progress"
    >
      {list.map((label, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <li
            key={label}
            className={`step-tracker__step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
          >
            <span className="step-tracker__mark" aria-hidden>
              {isDone ? '✓' : i + 1}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}