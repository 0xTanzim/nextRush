# Faultline Risk Model

Use qualitative bands. Do not report arithmetic scores as if they were measured probabilities.

## Severity

- **Critical:** plausible path to catastrophic data loss, major security/privacy breach, safety harm, irreversible financial harm, or prolonged core-service failure.
- **High:** major user impact, cross-tenant exposure, significant integrity failure, or substantial outage with limited workaround.
- **Medium:** localized or recoverable impact, partial degradation, or meaningful workflow disruption.
- **Low:** minor inconvenience, narrow edge behavior, or easily reversible impact.

Severity is contextual. Explain the consequence, not just the label.

## Likelihood

- **Expected:** likely during ordinary operation or deterministically triggered by normal behavior.
- **Likely:** credible and relatively easy to trigger under expected use or common environmental variation.
- **Possible:** requires a less common condition or specific timing but has a plausible path.
- **Unlikely:** requires unusual preconditions or multiple independent conditions.
- **Rare:** highly unusual, but retain where the impact is severe and the path is credible.

Do not use likelihood labels as statistical probabilities unless measured data exists.

## Confidence

- **High:** directly supported by code, architecture, documentation, logs, tests, or explicit requirement.
- **Medium:** technically plausible and supported by known design details, but one or more assumptions remain.
- **Low:** speculative or dependent on unknown implementation details.

Low-confidence high-impact risks should usually be `investigate`, not presented as confirmed defects.

## Priority matrix

| Severity \ Likelihood | Expected | Likely | Possible | Unlikely | Rare |
|---|---|---|---|---|---|
| Critical | Critical | Critical | High | High | Medium / investigate |
| High | Critical | High | High | Medium | Low / investigate |
| Medium | High | Medium | Medium | Low | Low |
| Low | Medium | Low | Low | Low | Low |

Override upward when a credible rare scenario has catastrophic or irreversible consequences. Explain any override.

## Disposition

- `mitigate`: design or control change required before release/spec approval.
- `accept`: explicitly accepted by an accountable decision-maker with rationale and residual risk.
- `defer`: known risk intentionally postponed, with owner and revisit trigger.
- `investigate`: insufficient evidence; gather information before deciding.

Never silently downgrade a risk because it is difficult to solve.

## Detection and reversibility

Record these separately when material:

- **Detection:** would monitoring or users notice the failure quickly, late, or not at all?
- **Reversibility:** can the effect be rolled back, compensated, restored, or is it irreversible?
- **Blast radius:** one operation, one user, one tenant, a region, or the whole system?

These help explain why severity/likelihood alone may not tell the whole story.
