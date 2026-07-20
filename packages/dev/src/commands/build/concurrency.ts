/**
 * Bounded concurrency pool for parallel task execution
 *
 * Limits the number of concurrent operations to prevent resource exhaustion.
 */

/**
 * Pool configuration
 */
export interface PoolOptions {
  /** Maximum concurrent tasks (default: CPU count) */
  concurrency?: number;
}

/**
 * Execute tasks with bounded concurrency
 * @param tasks Array of task functions
 * @param options Configuration
 * @returns Array of results matching task order
 */
export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  options: PoolOptions = {}
): Promise<T[]> {
  const concurrency = options.concurrency ?? getDefaultConcurrency();
  const results: T[] = new Array<T>(tasks.length);
  let nextIndex = 0;
  let activeCount = 0;
  let error: Error | null = null;

  return new Promise<T[]>((resolve, reject) => {
    function processNext(): void {
      // If error occurred, stop processing
      if (error) {
        if (activeCount === 0) reject(error);
        return;
      }

      if (nextIndex >= tasks.length && activeCount === 0) {
        resolve(results);
        return;
      }

      while (activeCount < concurrency && nextIndex < tasks.length) {
        const taskIndex = nextIndex++;
        activeCount++;

        const task = tasks[taskIndex];
        if (!task) {
          activeCount--;
          continue;
        }
        task()
          .then((result) => {
            results[taskIndex] = result;
            activeCount--;
            processNext();
          })
          .catch((err: unknown) => {
            error = err instanceof Error ? err : new Error(String(err));
            activeCount--;
            processNext();
          });
      }
    }

    processNext();
  });
}

/**
 * Fallback concurrency used only when a caller does not pass an explicit value.
 *
 * CPU-derived concurrency is computed by the caller (see swc-builder's
 * `resolveConcurrency`) because reading `node:os` requires an async import in ESM;
 * the previous `require('node:os')` here never ran in the ESM bundle and always fell
 * through to this constant (RFC-019, F-16). This is now just the documented floor.
 */
function getDefaultConcurrency(): number {
  return 4;
}
