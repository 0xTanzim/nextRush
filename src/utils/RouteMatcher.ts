import { Request, Route } from '../types';
import { RouteError, ValidationError } from '../types/Errors';

export class RouteMatcher {
  static matchRoute(req: Request, routes: Route[]): Route | undefined {
    try {
      if (!req) {
        throw new ValidationError('Request object is required');
      }

      if (!routes || !Array.isArray(routes)) {
        throw new RouteError('Routes array is invalid or empty');
      }

      if (!req.method) {
        throw new ValidationError('Request method is required');
      }

      if (!req.pathname) {
        throw new ValidationError('Request pathname is required');
      }

      return routes.find((route) => {
        try {
          if (!route || typeof route !== 'object') {
            console.warn('Invalid route object found, skipping:', route);
            return false;
          }

          if (!route.method || !route.path || !route.handler) {
            console.warn('Route missing required properties, skipping:', route);
            return false;
          }

          // Method matching
          if (route.method !== req.method) {
            return false;
          }

          // String path matching
          if (typeof route.path === 'string') {
            return route.path === req.pathname;
          }

          // RegExp path matching
          if (route.path instanceof RegExp) {
            try {
              const match = req.pathname.match(route.path);
              if (match) {
                // Extract named groups as params
                if (match.groups) {
                  req.params = { ...req.params, ...match.groups };
                }
                // Extract numbered groups as params
                if (match.length > 1) {
                  req.params = req.params || {};
                  for (let i = 1; i < match.length; i++) {
                    req.params[`param${i}`] = match[i];
                  }
                }
                return true;
              }
              return false;
            } catch (regexError) {
              console.error('Error matching regex route:', regexError);
              throw new RouteError(
                'Invalid regex pattern in route',
                route.path.toString()
              );
            }
          }

          // Unknown path type
          throw new RouteError(
            `Invalid route path type: ${typeof route.path}`,
            String(route.path)
          );
        } catch (error) {
          console.error('Error processing route:', error);
          return false;
        }
      });
    } catch (error) {
      console.error('Error in route matching:', error);
      throw error;
    }
  }

  static findMatchingMethods(req: Request, routes: Route[]): string[] {
    try {
      const matchingMethods: string[] = [];

      for (const route of routes) {
        try {
          if (!route || typeof route !== 'object') continue;

          let pathMatches = false;

          if (typeof route.path === 'string') {
            pathMatches = route.path === req.pathname;
          } else if (route.path instanceof RegExp) {
            pathMatches = route.path.test(req.pathname);
          }

          if (pathMatches && route.method) {
            matchingMethods.push(route.method);
          }
        } catch (error) {
          console.warn('Error checking route for allowed methods:', error);
        }
      }

      return [...new Set(matchingMethods)]; // Remove duplicates
    } catch (error) {
      console.error('Error finding matching methods:', error);
      return [];
    }
  }

  static validateRoute(route: Route): void {
    if (!route || typeof route !== 'object') {
      throw new ValidationError('Route must be an object');
    }

    if (!route.method || typeof route.method !== 'string') {
      throw new ValidationError('Route method must be a non-empty string');
    }

    if (!route.path) {
      throw new ValidationError('Route path is required');
    }

    if (typeof route.path !== 'string' && !(route.path instanceof RegExp)) {
      throw new ValidationError('Route path must be a string or RegExp');
    }

    if (!route.handler || typeof route.handler !== 'function') {
      throw new ValidationError('Route handler must be a function');
    }

    // Validate HTTP method
    const validMethods = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'OPTIONS',
      'HEAD',
    ];
    if (!validMethods.includes(route.method.toUpperCase())) {
      throw new ValidationError(
        `Invalid HTTP method: ${route.method}. Allowed: ${validMethods.join(
          ', '
        )}`
      );
    }
  }
}
