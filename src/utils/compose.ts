/**
 * Compose Utilities - Function composition helpers
 */

export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

export function composeMiddleware(...middlewares: Function[]) {
  return (req: any, res: any, next: Function) => {
    let index = -1;

    function dispatch(i: number): Promise<void> {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'));
      index = i;
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(req, res, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
