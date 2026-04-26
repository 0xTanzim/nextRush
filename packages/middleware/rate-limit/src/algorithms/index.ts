import type { Algorithm, RateLimitAlgorithm } from '../types';
import { fixedWindow } from './fixed-window';
import { slidingWindow } from './sliding-window';
import { tokenBucket } from './token-bucket';

export { fixedWindow, FixedWindowAlgorithm } from './fixed-window';
export { slidingWindow, SlidingWindowAlgorithm } from './sliding-window';
export { tokenBucket, TokenBucketAlgorithm } from './token-bucket';

/**
 * Map of algorithm names to implementations
 */
export const algorithms: Record<RateLimitAlgorithm, Algorithm> = {
  'token-bucket': tokenBucket,
  'sliding-window': slidingWindow,
  'fixed-window': fixedWindow,
};

/**
 * Get algorithm by name
 */
export function getAlgorithm(name: RateLimitAlgorithm): Algorithm {
  const algo = algorithms[name];
  if (!algo) {
    throw new Error(`Unknown rate limit algorithm: "${name}". Available: token-bucket, sliding-window, fixed-window`);
  }
  return algo;
}
