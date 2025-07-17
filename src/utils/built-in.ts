/**
 * 🔧 Built-in Utilities - Common utility functions
 */

export function compose(...fns: Function[]) {
  return (value: any) => fns.reduce((acc, fn) => fn(acc), value);
}

export function pipe(...fns: Function[]) {
  return (value: any) => fns.reduce((acc, fn) => fn(acc), value);
}

export function curry(fn: Function) {
  return function curried(...args: any[]) {
    if (args.length >= fn.length) {
      return fn.apply(null, args);
    } else {
      return function (...args2: any[]) {
        return curried.apply(null, args.concat(args2));
      };
    }
  };
}

export function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func: Function, limit: number) {
  let inThrottle: boolean;
  return function (...args: any[]) {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
