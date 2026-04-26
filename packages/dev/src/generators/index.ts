/**
 * @nextrush/dev - Generators Module
 *
 * Code generators for NextRush projects.
 *
 * @packageDocumentation
 */

export { generate, generateCli, generateHelp } from './generate.js';

export {
  GENERATORS,
  GENERATOR_ALIASES,
  GENERATOR_TYPES,
  controllerTemplate,
  guardTemplate,
  middlewareTemplate,
  routeTemplate,
  serviceTemplate,
  toCamelCase,
  toPascalCase,
  type GeneratorType,
} from './templates.js';

export { buildFilePath, resolveGeneratorType, validateName } from './generate.js';
