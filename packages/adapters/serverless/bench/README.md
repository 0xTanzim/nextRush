# Cold-start benchmark — `@nextrush/adapter-serverless`

Measures serverless **cold start**: the time from a fresh process start to the
first Lambda invocation's result — module load + app build + `ready()` + first
request. Each sample is a separate Node process (one process = one cold start).

```bash
pnpm --filter @nextrush/adapter-serverless bench:cold-start [samples]   # default 20
```

## Recorded baseline

> Local hardware, **Node v26.4.0**, 20 fresh processes per path. Hardware- and
> Node-version-dependent — reproduce on your own target. Not a published figure.

| Path | Median | Mean | Min | Max |
|------|-------:|-----:|----:|----:|
| functional | 65.6ms | 66.2ms | 60.9ms | 75.5ms |
| + class/DI runtime (`@nextrush/class`) | 79.5ms | 80.0ms | 74.6ms | 99.8ms |
| **delta** (reflect-metadata + decorator/DI machinery) | **~13.9ms** | | | |

## Reading the numbers

- The absolute figure **includes full Node process startup and ESM module
  resolution** (across workspace `dist` symlinks), not just framework init — so
  it is a *process-inclusive* cold start, not the framework's isolated init cost.
  On a bundled, single-file Lambda deployment the module-resolution portion
  shrinks substantially.
- The **delta (~14ms)** is the actionable framework figure: what a class/DI app
  pays over a functional one at cold start, dominated by loading
  `reflect-metadata`. If cold start is critical (high-fan-out, low-traffic
  functions), prefer the functional style on the serverless path.
- The class-path sample loads the class runtime but does not exercise a decorated
  controller — raw Node can't evaluate decorator syntax without a build step, and
  the reflect-metadata load is the figure that matters for cold start regardless.
